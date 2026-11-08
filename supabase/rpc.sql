-- ============================================================================
--  Vanta Fintech — business logic RPCs
--  Run after schema.sql. Every money movement is a security-definer function
--  so the client never writes to a ledger table directly.
--
--  Client entry points
--  -------------------
--   vanta_dashboard()                                  -> DashboardData json
--   vanta_create_investment(p_plan_slug)               -> activation
--   vanta_claim_earnings(p_investment_id)              -> one daily credit
--   vanta_start_deposit(p_amount, p_msisdn, p_method)  -> opens a MoMo prompt
--   vanta_start_withdrawal(p_amount, p_msisdn)         -> holds + pushes a payout
--
--  Server-only (called with the service role key)
--  ---------------------------------------------
--   vanta_set_deposit_gateway(...)      synchronous /requestToPay answer
--   vanta_set_withdrawal_gateway(...)   synchronous /disburse answer
--   vanta_handle_gateway_event(jsonb)   signed `transaction.finalized` callback
--   vanta_approve_deposit(p_deposit_id) manual/bank confirmation
--   vanta_run_daily_payouts(p_limit)    22:00 accrual job
--
--  Money rules (mirrored in src/lib/supabase/config.ts)
--  ----------------------------------------------------
--   minimum deposit        2,000 UGX
--   minimum withdrawal     5,000 UGX
--   daily earnings mature  every day at 22:00 Africa/Kampala
--   withdrawals accepted   09:00 – 22:00 Africa/Kampala
-- ============================================================================

-- ── Clock + validation helpers ────────────────────────────────────────────
-- Uganda has no daylight saving, so one named zone covers the whole platform.
create or replace function public.vanta_local_now()
returns timestamp
language sql
stable
as $$
  select now() at time zone 'Africa/Kampala';
$$;

-- When day p_index (0-based) of a cycle opened at p_started_at becomes payable:
-- 22:00 on the corresponding local calendar day.
create or replace function public.vanta_maturity_at(p_started_at timestamptz, p_index integer)
returns timestamptz
language sql
immutable
as $$
  select (
    (date_trunc('day', p_started_at at time zone 'Africa/Kampala')
       + make_interval(days => p_index)
       + interval '22 hours')
    at time zone 'Africa/Kampala'
  );
$$;

-- One readable setting, or its published default. Security definer so it can
-- see platform_settings (created by admin.sql); if the table is not there yet
-- — or the stored value is malformed — the default silently wins, so the
-- money RPCs behave exactly like the hardcoded rules before admin.sql ran.
create or replace function public.vanta_setting(p_key text, p_fallback jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select value into v from public.platform_settings where key = p_key;
  return coalesce(v, p_fallback);
exception when others then
  return p_fallback;
end;
$$;

-- Text form of a setting, falling back when unset or not a string.
create or replace function public.vanta_setting_text(p_key text, p_fallback text)
returns text
language sql
stable
as $$
  select coalesce(nullif(public.vanta_setting(p_key, to_jsonb(p_fallback)) #>> '{}', ''), p_fallback);
$$;

-- Numeric form, falling back when the stored value is not a number.
create or replace function public.vanta_setting_number(p_key text, p_fallback numeric)
returns numeric
language plpgsql
stable
as $$
begin
  return public.vanta_setting_text(p_key, p_fallback::text)::numeric;
exception when others then
  return p_fallback;
end;
$$;

-- Withdrawals are only taken inside the desk window, now admin-editable via
-- platform_settings (default 09:00–22:00 Kampala).
create or replace function public.vanta_within_withdrawal_window()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now   time := public.vanta_local_now()::time;
  v_open  time;
  v_close time;
begin
  v_open  := coalesce(public.vanta_setting_text('withdrawal_opens_at', '09:00')::time, time '09:00');
  v_close := coalesce(public.vanta_setting_text('withdrawal_closes_at', '22:00')::time, time '22:00');

  if v_close <= v_open then
    return v_now >= v_open; -- window wraps past midnight: open from closes-at back to opens-at
  end if;
  return v_now >= v_open and v_now < v_close;
exception when others then
  return v_now >= time '09:00' and v_now < time '22:00';
end;
$$;

-- The published rules, readable by the app so screens never hard-code them.
-- security definer because it reaches the clock helpers above, which clients
-- cannot call directly.
create or replace function public.vanta_rules()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min_dep numeric;
  v_min_wd  numeric;
begin
  v_min_dep := public.vanta_setting_number('min_deposit', 10000);
  v_min_wd  := public.vanta_setting_number('min_withdrawal', 5000);

  return jsonb_build_object(
    'currency',              'UGX',
    'timezone',              'Africa/Kampala',
    'min_deposit',           v_min_dep,
    'min_withdrawal',        v_min_wd,
    'earnings_mature_at',    public.vanta_setting_text('earnings_mature_at', '22:00'),
    'withdrawal_opens_at',   public.vanta_setting_text('withdrawal_opens_at', '09:00'),
    'withdrawal_closes_at',  public.vanta_setting_text('withdrawal_closes_at', '22:00'),
    'withdrawals_open',      public.vanta_within_withdrawal_window()
  );
exception when others then
  -- a malformed setting must never take the app's rule panel down
  return jsonb_build_object(
    'currency', 'UGX', 'timezone', 'Africa/Kampala',
    'min_deposit', 10000, 'min_withdrawal', 5000,
    'earnings_mature_at', '22:00',
    'withdrawal_opens_at', '09:00', 'withdrawal_closes_at', '22:00',
    'withdrawals_open', public.vanta_local_now()::time >= time '09:00'
                         and public.vanta_local_now()::time < time '22:00'
  );
end;
$$;

-- Any way a Ugandan writes their number → the gateway's 2567XXXXXXXX form.
-- Mirrors normalizeMsisdn() in src/lib/payments/shashura.ts. Networks here
-- start with 07 (MTN and Airtel after the 2009 split) or 03 (Utel), so the
-- leading digit is not pinned to one operator.
create or replace function public.vanta_normalize_msisdn(p_raw text)
returns text
language sql
immutable
as $$
  select case
    when v ~ '^2560\d{9}$' then '256' || substring(v from 5)  -- +256077… 0-prefixed country code
    when v ~ '^256\d{9}$'  then v                             -- already international
    when v ~ '^0\d{9}$'    then '256' || substring(v from 2)  -- 0772123456
    when v ~ '^\d{9}$'     then '256' || v                    -- 772123456
    else null
  end
  from (select regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g')) as d(v);
$$;

revoke all on function public.vanta_local_now() from public, anon, authenticated;
revoke all on function public.vanta_maturity_at(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.vanta_within_withdrawal_window() from public, anon, authenticated;
revoke all on function public.vanta_normalize_msisdn(text) from public, anon, authenticated;
revoke all on function public.vanta_setting(text, jsonb) from public, anon, authenticated;
revoke all on function public.vanta_setting_text(text, text) from public, anon, authenticated;
revoke all on function public.vanta_setting_number(text, numeric) from public, anon, authenticated;

grant execute on function public.vanta_rules() to anon, authenticated;

-- ── Internal: pay one day of one investment ────────────────────────────────
create or replace function public.vanta_pay_day(p_investment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv     public.investments%rowtype;
  v_due_at  timestamptz;
  v_credit  numeric(14, 2);
  v_ref     text;
  v_name    text;
begin
  select * into v_inv
  from public.investments
  where id = p_investment_id
  for update;

  if not found then
    raise exception 'INVESTMENT_NOT_FOUND';
  end if;

  if v_inv.status <> 'active' then
    raise exception 'INVESTMENT_COMPLETED';
  end if;

  -- one credit per calendar day of the cycle, maturing at 22:00 EAT
  v_due_at := public.vanta_maturity_at(v_inv.started_at, v_inv.days_paid);
  if now() < v_due_at then
    raise exception 'EARNING_NOT_DUE: this credit matures at %', v_due_at;
  end if;

  v_credit := v_inv.daily_return;
  v_ref := 'ERN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- ledger notes carry the published plan name (VINTA Core, VINTAgold, ...)
  select name into v_name from public.plans where slug = v_inv.plan_slug;

  update public.profiles
     set balance      = balance + v_credit,
         total_earned = total_earned + v_credit
   where id = v_inv.user_id;

  insert into public.transactions (user_id, type, amount, reference, note, meta)
  values (
    v_inv.user_id,
    'earning',
    v_credit,
    v_ref,
    format('%s · day %s of %s', coalesce(v_name, v_inv.plan_slug), v_inv.days_paid + 1, v_inv.duration_days),
    jsonb_build_object('investment_id', v_inv.id, 'day', v_inv.days_paid + 1)
  );

  update public.investments
     set days_paid    = days_paid + 1,
         last_paid_at = now()
   where id = v_inv.id
   returning * into v_inv;

  -- cycle finished: release capital
  if v_inv.days_paid >= v_inv.duration_days then
    update public.investments set status = 'completed' where id = v_inv.id;

    update public.profiles
       set balance = balance + v_inv.amount
     where id = v_inv.user_id;

    insert into public.transactions (user_id, type, amount, reference, note, meta)
    values (
      v_inv.user_id,
      'capital_return',
      v_inv.amount,
      'CPL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      coalesce(v_name, v_inv.plan_slug) || ' cycle completed — capital released',
      jsonb_build_object('investment_id', v_inv.id)
    );
  end if;

  return v_credit;
end;
$$;

revoke all on function public.vanta_pay_day(uuid) from public, anon, authenticated;

-- ── Activate a product ─────────────────────────────────────────────────────
create or replace function public.vanta_create_investment(p_plan_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_plan    public.plans%rowtype;
  v_balance numeric(14, 2);
  v_inv     public.investments%rowtype;
  v_l1      uuid;
  v_l2      uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.vanta_assert_not_banned(v_uid);

  select * into v_plan
  from public.plans
  where slug = p_plan_slug and is_active;

  if not found then
    raise exception 'PLAN_NOT_FOUND: %', p_plan_slug;
  end if;

  select balance into v_balance
  from public.profiles
  where id = v_uid
  for update;

  if v_balance is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_balance < v_plan.amount then
    raise exception 'INSUFFICIENT_FUNDS: balance % is below product price %',
      v_balance, v_plan.amount;
  end if;

  update public.profiles
     set balance        = balance - v_plan.amount,
         total_invested = total_invested + v_plan.amount
   where id = v_uid;

  insert into public.investments
    (user_id, plan_slug, amount, daily_return, duration_days, total_return, ends_at)
  values
    (v_uid, v_plan.slug, v_plan.amount, v_plan.daily_return, v_plan.duration_days,
     v_plan.amount + v_plan.daily_return * v_plan.duration_days,
     now() + make_interval(days => v_plan.duration_days))
  returning * into v_inv;

  insert into public.transactions (user_id, type, amount, reference, note, meta)
  values (
    v_uid,
    'investment',
    v_plan.amount,
    'INV-' || upper(substr(replace(v_inv.id::text, '-', ''), 1, 6)),
    v_plan.name || ' product activated',
    jsonb_build_object('plan', v_plan.slug, 'investment_id', v_inv.id)
  );

  -- 1st level: 17% of the ticket
  select referred_by into v_l1 from public.profiles where id = v_uid;

  if v_l1 is not null then
    perform public.vanta_credit_referral(v_l1, v_uid, v_inv.id, 1, 0.17, v_plan.amount);

    -- 2nd level: 1% of the ticket
    select referred_by into v_l2 from public.profiles where id = v_l1;

    if v_l2 is not null then
      perform public.vanta_credit_referral(v_l2, v_uid, v_inv.id, 2, 0.01, v_plan.amount);
    end if;
  end if;

  return jsonb_build_object(
    'investment_id', v_inv.id,
    'plan',          v_plan.slug,
    'amount',        v_plan.amount,
    'daily_return',  v_plan.daily_return,
    'duration_days', v_plan.duration_days,
    'ends_at',       v_inv.ends_at
  );
end;
$$;

-- ── Internal: write a referral commission ──────────────────────────────────
create or replace function public.vanta_credit_referral(
  p_beneficiary uuid,
  p_source      uuid,
  p_investment  uuid,
  p_level       integer,
  p_rate        numeric,
  p_base        numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(14, 2) := round(p_base * p_rate, 2);
begin
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.referral_commissions
    (user_id, source_user_id, investment_id, level, rate, amount)
  values
    (p_beneficiary, p_source, p_investment, p_level, p_rate, v_amount)
  on conflict (investment_id, user_id, level) do nothing;

  if not found then
    return 0; -- commission already credited for this investment
  end if;

  update public.profiles
     set balance         = balance + v_amount,
         referral_earned = referral_earned + v_amount
   where id = p_beneficiary;

  insert into public.transactions (user_id, type, amount, reference, note, meta)
  values (
    p_beneficiary,
    'referral',
    v_amount,
    'REF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    format('%s level · %s%% of %s', p_level, (p_rate * 100)::int, p_base),
    jsonb_build_object('level', p_level, 'source_user', p_source, 'investment_id', p_investment)
  );

  return v_amount;
end;
$$;

revoke all on function public.vanta_credit_referral(uuid, uuid, uuid, integer, numeric, numeric)
  from public, anon, authenticated;

-- ── Claim one daily earning ────────────────────────────────────────────────
create or replace function public.vanta_claim_earnings(p_investment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.vanta_assert_not_banned(v_uid);

  if not exists (
    select 1 from public.investments
    where id = p_investment_id and user_id = v_uid
  ) then
    raise exception 'NOT_YOUR_INVESTMENT';
  end if;

  return public.vanta_pay_day(p_investment_id);
end;
$$;

-- ── Deposits — SHASHURA collections ───────────────────────────────────────
-- Internal: credit a deposit whose money is confirmed. Idempotent: a row that
-- already settled is left alone, so callback and enquiry polls cannot double
-- count. The investor is credited the amount they approved on their phone; the
-- gateway's processing fee is recorded on the deposit as our cost.
create or replace function public.vanta_settle_collection(
  p_deposit_id uuid,
  p_tid        text,
  p_network    text,
  p_charge     numeric,
  p_net        numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep public.deposits%rowtype;
begin
  select * into v_dep
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'DEPOSIT_NOT_FOUND';
  end if;

  if v_dep.status in ('credited', 'approved') then
    return 0; -- already in the wallet
  end if;

  update public.deposits
     set status        = 'credited',
         tid           = coalesce(p_tid, v_dep.tid),
         network       = coalesce(p_network, v_dep.network),
         gateway_state = 'TS',
         charge        = coalesce(p_charge, v_dep.charge),
         net_amount    = coalesce(p_net, v_dep.amount - coalesce(p_charge, 0)),
         failure_code  = null,
         failure_message = null,
         settled_at    = now()
   where id = v_dep.id;

  update public.profiles
     set balance = balance + v_dep.amount
   where id = v_dep.user_id;

  update public.transactions
     set status = 'completed',
         note   = coalesce(p_network, v_dep.method) || ' · ' || v_dep.msisdn || ' · settled'
   where user_id = v_dep.user_id
     and type = 'deposit'
     and status = 'pending'
     and (reference = v_dep.reference or meta ->> 'deposit_id' = v_dep.id::text);

  return v_dep.amount;
end;
$$;

-- Internal: a collection that will not be paid. Nothing moved, so the ledger
-- row opened for the attempt is simply rejected.
create or replace function public.vanta_fail_collection(
  p_deposit_id uuid,
  p_code       text,
  p_message    text,
  p_state      text default 'TF'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep public.deposits%rowtype;
begin
  select * into v_dep
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'DEPOSIT_NOT_FOUND';
  end if;

  if v_dep.status in ('credited', 'approved', 'rejected') then
    return v_dep.status;
  end if;

  update public.deposits
     set status          = 'failed',
         gateway_state   = upper(coalesce(p_state, 'TF')),
         failure_code    = p_code,
         failure_message = p_message
   where id = p_deposit_id;

  update public.transactions
     set status = 'rejected',
         note   = coalesce('declined · ' || p_message, note)
   where user_id = v_dep.user_id
     and type = 'deposit'
     and status = 'pending'
     and (reference = v_dep.reference or meta ->> 'deposit_id' = v_dep.id::text);

  return 'failed';
end;
$$;

revoke all on function public.vanta_settle_collection(uuid, text, text, numeric, numeric)
  from public, anon, authenticated;
revoke all on function public.vanta_fail_collection(uuid, text, text, text)
  from public, anon, authenticated;

-- Opens a top-up: validates the rules, books the pending ledger row and hands
-- back the gateway reference the app then sends to /requestToPay.
create or replace function public.vanta_start_deposit(
  p_amount numeric,
  p_msisdn text,
  p_method text default 'MTN MoMo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_number text;
  v_dep    public.deposits%rowtype;
  v_ref    text;
  v_min    numeric;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.vanta_assert_not_banned(v_uid);

  -- floor and ceiling come from the desk settings when the admin has moved them
  v_min := public.vanta_setting_number('min_deposit', 10000);
  if p_amount is null or p_amount < v_min then
    raise exception 'MIN_DEPOSIT: the minimum deposit is % UGX', to_char(v_min, 'FM999,999,999');
  end if;

  -- mobile money has no cents, and the gateway is called with the same integer
  if p_amount <> floor(p_amount) then
    raise exception 'ODD_AMOUNT: enter a whole number of shillings';
  end if;

  if p_amount > 5000000 then
    raise exception 'MAX_DEPOSIT: the maximum single deposit is 5,000,000 UGX';
  end if;

  v_number := public.vanta_normalize_msisdn(p_msisdn);
  if v_number is null then
    raise exception 'MSISDN_INVALID: enter the mobile money number to charge (077…, 070…)';
  end if;

  -- one live prompt per investor, so a stale attempt cannot race a new one
  if exists (
    select 1 from public.deposits d
    where d.user_id = v_uid
      and d.status in ('pending', 'awaiting_pin')
      and d.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'DEPOSIT_PENDING: your last top-up is still awaiting approval on your phone';
  end if;

  insert into public.deposits (user_id, amount, method, msisdn, status)
  values (v_uid, p_amount, coalesce(nullif(trim(p_method), ''), 'MTN MoMo'), v_number, 'pending')
  returning * into v_dep;

  -- the gateway reference is derived from the row id, so it is unique forever
  v_ref := 'DEP-' || upper(substr(replace(v_dep.id::text, '-', ''), 1, 10));
  update public.deposits set reference = v_ref where id = v_dep.id;

  insert into public.transactions (user_id, type, amount, status, reference, note, meta)
  values (
    v_uid,
    'deposit',
    p_amount,
    'pending',
    v_ref,
    coalesce(nullif(trim(p_method), ''), 'MTN MoMo') || ' · ' || v_number || ' · awaiting approval',
    jsonb_build_object('deposit_id', v_dep.id, 'channel', 'shashura')
  );

  return jsonb_build_object(
    'deposit_id', v_dep.id,
    'reference',  v_ref,
    'amount',     v_dep.amount,
    'msisdn',     v_number,
    'method',     v_dep.method
  );
end;
$$;

-- Records the gateway's synchronous answer to /requestToPay:
--   TS → settled at once (rare for collections)
--   TF → declined before the prompt, release the attempt
--   anything else → prompt is on the phone, wait for the callback
create or replace function public.vanta_set_deposit_gateway(
  p_deposit_id uuid,
  p_tid        text,
  p_state      text,
  p_code       text default null,
  p_message    text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep   public.deposits%rowtype;
  v_state text := upper(coalesce(p_state, 'PENDING'));
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_dep
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'DEPOSIT_NOT_FOUND';
  end if;

  if v_state = 'TF' then
    return public.vanta_fail_collection(p_deposit_id, p_code, p_message, v_state);
  end if;

  if v_state = 'TS' then
    perform public.vanta_settle_collection(p_deposit_id, p_tid, null, null, null);
    return 'credited';
  end if;

  update public.deposits
     set status      = 'awaiting_pin',
         tid         = coalesce(p_tid, tid),
         gateway_state = 'PENDING'
   where id = p_deposit_id
     and status not in ('credited', 'approved', 'failed', 'rejected');

  return 'awaiting_pin';
end;
$$;

revoke all on function public.vanta_set_deposit_gateway(uuid, text, text, text, text)
  from public, anon, authenticated;

-- Operator action: confirm money that landed in the collection account by hand
-- (bank transfer, or a callback that never arrived for a proven payment).
create or replace function public.vanta_approve_deposit(p_deposit_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep public.deposits%rowtype;
begin
  select * into v_dep
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'DEPOSIT_NOT_FOUND';
  end if;

  if v_dep.status in ('credited', 'approved') then
    raise exception 'DEPOSIT_ALREADY_REVIEWED';
  end if;

  if v_dep.status = 'rejected' then
    raise exception 'DEPOSIT_REJECTED';
  end if;

  update public.deposits
     set status      = 'approved',
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         settled_at  = now()
   where id = p_deposit_id;

  update public.profiles
     set balance = balance + v_dep.amount
   where id = v_dep.user_id;

  update public.transactions
     set status = 'completed',
         note   = coalesce(v_dep.method, 'Manual') || ' · confirmed by the desk'
   where user_id = v_dep.user_id
     and type = 'deposit'
     and status = 'pending'
     and (reference = v_dep.reference or meta ->> 'deposit_id' = p_deposit_id::text);

  return v_dep.amount;
end;
$$;

revoke all on function public.vanta_approve_deposit(uuid) from public, anon, authenticated;

-- ── Withdrawals — SHASHURA disbursements ──────────────────────────────────
-- Internal: confirm a payout. The wallet was already debited when the request
-- was made, so settling only flips the status and the ledger row.
create or replace function public.vanta_settle_disbursement(
  p_withdrawal_id uuid,
  p_tid           text,
  p_network       text,
  p_charge        numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wd public.withdrawals%rowtype;
begin
  select * into v_wd
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND';
  end if;

  if v_wd.status in ('paid', 'processed') then
    return 0;
  end if;

  update public.withdrawals
     set status        = 'paid',
         tid           = coalesce(p_tid, v_wd.tid),
         network       = coalesce(p_network, v_wd.network),
         gateway_state = 'TS',
         charge        = coalesce(p_charge, v_wd.charge),
         failure_code  = null,
         failure_message = null,
         processed_at  = coalesce(processed_at, now()),
         settled_at    = now()
   where id = p_withdrawal_id;

  update public.transactions
     set status = 'completed',
         note   = coalesce(p_network, v_wd.method) || ' · ' || v_wd.msisdn || ' · paid out'
   where user_id = v_wd.user_id
     and type = 'withdrawal'
     and status = 'pending'
     and (reference = v_wd.reference or meta ->> 'withdrawal_id' = p_withdrawal_id::text);

  return v_wd.amount;
end;
$$;

-- Internal: a payout the network refused. The held amount goes back to the
-- wallet, so an investor never loses money that never left.
create or replace function public.vanta_fail_disbursement(
  p_withdrawal_id uuid,
  p_code          text,
  p_message       text,
  p_state         text default 'TF'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wd public.withdrawals%rowtype;
begin
  select * into v_wd
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND';
  end if;

  if v_wd.status in ('paid', 'processed', 'rejected') then
    return v_wd.status;
  end if;

  update public.withdrawals
     set status          = 'failed',
         gateway_state   = upper(coalesce(p_state, 'TF')),
         failure_code    = p_code,
         failure_message = p_message
   where id = p_withdrawal_id;

  update public.profiles
     set balance = balance + v_wd.amount
   where id = v_wd.user_id;

  update public.transactions
     set status = 'rejected',
         note   = coalesce('declined · ' || p_message, note)
   where user_id = v_wd.user_id
     and type = 'withdrawal'
     and status = 'pending'
     and (reference = v_wd.reference or meta ->> 'withdrawal_id' = p_withdrawal_id::text);

  return 'failed';
end;
$$;

revoke all on function public.vanta_settle_disbursement(uuid, text, text, numeric)
  from public, anon, authenticated;
revoke all on function public.vanta_fail_disbursement(uuid, text, text, text)
  from public, anon, authenticated;

-- Opens a payout: rules first, then the hold, then the reference the app
-- sends to /disburse.
create or replace function public.vanta_start_withdrawal(
  p_amount numeric,
  p_msisdn text,
  p_method text default 'MTN MoMo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_number  text;
  v_balance numeric(14, 2);
  v_wd      public.withdrawals%rowtype;
  v_ref     text;
  v_min     numeric;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.vanta_assert_not_banned(v_uid);

  v_min := public.vanta_setting_number('min_withdrawal', 5000);
  if p_amount is null or p_amount < v_min then
    raise exception 'MIN_WITHDRAWAL: the minimum withdrawal is % UGX', to_char(v_min, 'FM999,999,999');
  end if;

  if p_amount <> floor(p_amount) then
    raise exception 'ODD_AMOUNT: enter a whole number of shillings';
  end if;

  if not public.vanta_within_withdrawal_window() then
    raise exception 'WITHDRAWAL_WINDOW: withdrawals open from % to % (Africa/Kampala)',
      public.vanta_setting_text('withdrawal_opens_at', '09:00'),
      public.vanta_setting_text('withdrawal_closes_at', '22:00');
  end if;

  v_number := public.vanta_normalize_msisdn(p_msisdn);
  if v_number is null then
    raise exception 'MSISDN_INVALID: enter the mobile money number to pay into (077…, 070…)';
  end if;

  select balance into v_balance
  from public.profiles
  where id = v_uid
  for update;

  if v_balance is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE: available %', v_balance;
  end if;

  -- hold the funds while the payout is in flight
  update public.profiles
     set balance = balance - p_amount
   where id = v_uid;

  insert into public.withdrawals (user_id, amount, method, destination, msisdn, status)
  values (
    v_uid, p_amount,
    coalesce(nullif(trim(p_method), ''), 'MTN MoMo'),
    v_number, v_number,
    'pending'
  )
  returning * into v_wd;

  v_ref := 'WDR-' || upper(substr(replace(v_wd.id::text, '-', ''), 1, 10));
  update public.withdrawals set reference = v_ref where id = v_wd.id;

  insert into public.transactions (user_id, type, amount, status, reference, note, meta)
  values (
    v_uid,
    'withdrawal',
    p_amount,
    'pending',
    v_ref,
    coalesce(nullif(trim(p_method), ''), 'MTN MoMo') || ' · ' || v_number || ' · processing',
    jsonb_build_object('withdrawal_id', v_wd.id, 'channel', 'shashura')
  );

  return jsonb_build_object(
    'withdrawal_id', v_wd.id,
    'reference',     v_ref,
    'amount',        v_wd.amount,
    'msisdn',        v_number,
    'method',        v_wd.method
  );
end;
$$;

-- Records the gateway's synchronous answer to /disburse. Airtel settles on the
-- spot (TS), MTN stays PENDING until the callback or an enquiry confirms it.
create or replace function public.vanta_set_withdrawal_gateway(
  p_withdrawal_id uuid,
  p_tid           text,
  p_state         text,
  p_code          text default null,
  p_message       text default null,
  p_charge        numeric default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text := upper(coalesce(p_state, 'PENDING'));
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (select 1 from public.withdrawals where id = p_withdrawal_id) then
    raise exception 'WITHDRAWAL_NOT_FOUND';
  end if;

  if v_state = 'TF' then
    return public.vanta_fail_disbursement(p_withdrawal_id, p_code, p_message, v_state);
  end if;

  if v_state = 'TS' then
    perform public.vanta_settle_disbursement(p_withdrawal_id, p_tid, null, p_charge);
    return 'paid';
  end if;

  update public.withdrawals
     set status        = 'processing',
         tid           = coalesce(p_tid, tid),
         gateway_state = 'PENDING',
         charge        = coalesce(p_charge, charge)
   where id = p_withdrawal_id
     and status not in ('paid', 'processed', 'failed', 'rejected');

  return 'processing';
end;
$$;

revoke all on function public.vanta_set_withdrawal_gateway(uuid, text, text, text, text, numeric)
  from public, anon, authenticated;

-- ── Gateway callback ──────────────────────────────────────────────────────
-- Handles `transaction.finalized` payloads (and enquiry answers reshaped into
-- the same envelope by the app). Written by the webhook route with the service
-- role key. Every event is logged first, and the unique (tid, type, status) key
-- makes settlement idempotent — retries cannot pay anybody twice.
create or replace function public.vanta_handle_gateway_event(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid       text := nullif(trim(coalesce(p_payload ->> 'tid', '')), '');
  v_ref       text := nullif(trim(coalesce(p_payload ->> 'external_ref', '')), '');
  v_type      text := upper(coalesce(p_payload ->> 'type', 'COLLECTION'));
  v_status    text := upper(coalesce(p_payload ->> 'status', ''));
  v_amount    numeric := nullif(p_payload ->> 'amount', '')::numeric;
  v_charge    numeric := nullif(p_payload ->> 'charge', '')::numeric;
  v_net       numeric := nullif(p_payload ->> 'net_amount', '')::numeric;
  v_network   text := nullif(p_payload ->> 'network', '');
  v_msisdn    text := nullif(p_payload ->> 'msisdn', '');
  v_code      text := nullif(p_payload -> 'failure' ->> 'code', '');
  v_message   text := nullif(p_payload -> 'failure' ->> 'message', '');
  v_event_id  uuid;
  v_dep_id    uuid;
  v_wd_id     uuid;
  v_applied   boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  if v_tid is null and v_ref is null then
    raise exception 'EVENT_UNIDENTIFIED: payload carries neither tid nor external_ref';
  end if;

  if v_status not in ('SUCCESSFUL', 'FAILED') then
    -- PENDING deliveries are informational only; the terminal event follows.
    insert into public.payment_events (tid, external_ref, event, type, status, environment,
                                       amount, charge, net_amount, msisdn, network, payload)
    values (coalesce(v_tid, v_ref), v_ref, coalesce(p_payload ->> 'event', 'transaction.finalized'),
            v_type, 'PENDING', p_payload ->> 'environment', v_amount, v_charge, v_net,
            v_msisdn, v_network, p_payload)
    on conflict (tid, type, status) do nothing;

    return 'IGNORED';
  end if;

  insert into public.payment_events (tid, external_ref, event, type, status, environment,
                                     amount, charge, net_amount, msisdn, network,
                                     failure_code, failure_message, payload)
  values (coalesce(v_tid, v_ref), v_ref, coalesce(p_payload ->> 'event', 'transaction.finalized'),
          v_type, v_status, p_payload ->> 'environment', v_amount, v_charge, v_net,
          v_msisdn, v_network, v_code, v_message, p_payload)
  on conflict (tid, type, status) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return 'DUPLICATE'; -- this terminal event has already been processed
  end if;

  if v_type = 'COLLECTION' then
    select d.id into v_dep_id
    from public.deposits d
    where (v_ref is not null and d.reference = v_ref)
       or (v_tid is not null and d.tid = v_tid)
    order by d.created_at desc
    limit 1;

    if v_dep_id is null then
      return 'UNMATCHED'; -- keep the log row so support can reconcile by hand
    end if;

    if v_status = 'SUCCESSFUL' then
      perform public.vanta_settle_collection(v_dep_id, v_tid, v_network, v_charge, v_net);
    else
      perform public.vanta_fail_collection(v_dep_id, v_code, v_message, 'TF');
    end if;

    v_applied := true;
  elsif v_type = 'DISBURSEMENT' then
    select w.id into v_wd_id
    from public.withdrawals w
    where (v_ref is not null and w.reference = v_ref)
       or (v_tid is not null and w.tid = v_tid)
    order by w.created_at desc
    limit 1;

    if v_wd_id is null then
      return 'UNMATCHED';
    end if;

    if v_status = 'SUCCESSFUL' then
      perform public.vanta_settle_disbursement(v_wd_id, v_tid, v_network, v_charge);
    else
      perform public.vanta_fail_disbursement(v_wd_id, v_code, v_message, 'TF');
    end if;

    v_applied := true;
  else
    return 'UNSUPPORTED_TYPE';
  end if;

  update public.payment_events
     set applied = v_applied,
         deposit_id = v_dep_id,
         withdrawal_id = v_wd_id
   where id = v_event_id;

  return case when v_status = 'SUCCESSFUL' then 'SETTLED' else 'FAILED' end;
end;
$$;

revoke all on function public.vanta_handle_gateway_event(jsonb)
  from public, anon, authenticated;

-- ── Cron: pay every due investment ─────────────────────────────────────────
-- Schedule for 22:00 Africa/Kampala — that is when the day's earnings mature.
create or replace function public.vanta_run_daily_payouts(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec     record;
  v_paid    integer := 0;
begin
  for v_rec in
    select id
    from public.investments
    where status = 'active'
      and public.vanta_maturity_at(started_at, days_paid) <= now()
    order by started_at
    limit p_limit
  loop
    begin
      perform public.vanta_pay_day(v_rec.id);
      v_paid := v_paid + 1;
    exception when others then
      -- never let one bad row stop the batch
      raise notice 'payout skipped for %: %', v_rec.id, sqlerrm;
    end;
  end loop;

  return v_paid;
end;
$$;

revoke all on function public.vanta_run_daily_payouts(integer) from public, anon, authenticated;

-- ── Single round-trip dashboard payload ────────────────────────────────────
create or replace function public.vanta_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id',            v_profile.id,
      'full_name',     v_profile.full_name,
      'username',      v_profile.username,
      'phone',         v_profile.phone,
      'email',         v_profile.email,
      'referral_code', v_profile.referral_code,
      'created_at',    v_profile.created_at
    ),
    'wallet', jsonb_build_object(
      'balance',              v_profile.balance,
      'total_invested',       v_profile.total_invested,
      'total_earned',         v_profile.total_earned,
      'referral_earned',      v_profile.referral_earned,
      'pending_withdrawals',  coalesce((
        select sum(w.amount) from public.withdrawals w
        where w.user_id = v_uid and w.status in ('pending', 'processing')), 0),
      'pending_deposits',     coalesce((
        select sum(d.amount) from public.deposits d
        where d.user_id = v_uid and d.status in ('pending', 'awaiting_pin')), 0),
      'active_investments',   (
        select count(*) from public.investments i
        where i.user_id = v_uid and i.status = 'active')
    ),
    -- platform rules, so no screen has to hard-code a minimum or a schedule
    'payments', jsonb_build_object(
      'rules',            public.vanta_rules(),
      'awaiting_payout',  coalesce((
        select jsonb_agg(jsonb_build_object('id', w.id, 'amount', w.amount, 'status', w.status,
                                            'reference', w.reference, 'msisdn', w.msisdn))
        from public.withdrawals w
        where w.user_id = v_uid and w.status in ('pending', 'processing')), '[]'::jsonb),
      'awaiting_deposit', coalesce((
        select jsonb_agg(jsonb_build_object('id', d.id, 'amount', d.amount, 'status', d.status,
                                            'reference', d.reference, 'msisdn', d.msisdn))
        from public.deposits d
        where d.user_id = v_uid and d.status in ('pending', 'awaiting_pin')), '[]'::jsonb)
    ),
    'investments', coalesce((
      select jsonb_agg(row_to_json(t) order by t.started_at desc)
      from (
        select i.id,
               i.plan_slug,
               p.name                                        as plan_name,
               i.amount,
               i.daily_return,
               i.duration_days,
               i.total_return,
               i.days_paid,
               round(i.daily_return * i.days_paid, 2)        as earned,
               i.status,
               i.started_at,
               i.ends_at,
               case when i.status = 'active'
                    then public.vanta_maturity_at(i.started_at, i.days_paid)
                    end                                      as next_maturity_at
        from public.investments i
        join public.plans p on p.slug = i.plan_slug
        where i.user_id = v_uid
      ) t
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select t.id, t.type, t.amount, t.status, t.reference, t.note, t.created_at
        from public.transactions t
        where t.user_id = v_uid
        order by t.created_at desc
        limit 100
      ) t
    ), '[]'::jsonb),
    'referrals', jsonb_build_object(
      'code', v_profile.referral_code,
      'link', '',
      'level1_count', (
        select count(*) from public.profiles p where p.referred_by = v_uid),
      'level2_count', (
        select count(*) from public.profiles l2
        join public.profiles l1 on l2.referred_by = l1.id
        where l1.referred_by = v_uid),
      'level1_earned', coalesce((
        select sum(rc.amount) from public.referral_commissions rc
        where rc.user_id = v_uid and rc.level = 1), 0),
      'level2_earned', coalesce((
        select sum(rc.amount) from public.referral_commissions rc
        where rc.user_id = v_uid and rc.level = 2), 0),
      'rows', coalesce((
        select jsonb_agg(row_to_json(t) order by t.joined_at desc)
        from (
          select pr.id,
                 pr.full_name,
                 1::int as level,
                 pr.created_at as joined_at,
                 coalesce((select sum(i.amount) from public.investments i
                           where i.user_id = pr.id), 0) as invested,
                 coalesce((select sum(rc.amount) from public.referral_commissions rc
                           where rc.user_id = v_uid and rc.source_user_id = pr.id), 0) as commission,
                 case when exists (select 1 from public.investments i where i.user_id = pr.id)
                      then 'active' else 'pending' end as status
          from public.profiles pr
          where pr.referred_by = v_uid

          union all

          select pr.id,
                 pr.full_name,
                 2::int,
                 pr.created_at,
                 coalesce((select sum(i.amount) from public.investments i
                           where i.user_id = pr.id), 0),
                 coalesce((select sum(rc.amount) from public.referral_commissions rc
                           where rc.user_id = v_uid and rc.source_user_id = pr.id), 0),
                 case when exists (select 1 from public.investments i where i.user_id = pr.id)
                      then 'active' else 'pending' end
          from public.profiles pr
          where pr.referred_by in (select id from public.profiles where referred_by = v_uid)
        ) t
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Client-facing entry points. The gateway-backed deposit and withdrawal RPCs
-- only open the request; the money moves when vanta_handle_gateway_event (the
-- signed callback) or the settlement helpers confirm it with the service role.
grant execute on function public.vanta_dashboard()               to authenticated;
grant execute on function public.vanta_create_investment(text)   to authenticated;
grant execute on function public.vanta_claim_earnings(uuid)      to authenticated;
grant execute on function public.vanta_start_deposit(numeric, text, text) to authenticated;
grant execute on function public.vanta_start_withdrawal(numeric, text, text) to authenticated;

-- The pre-gateway request functions are gone; drop them so no client can call a
-- path that skips the payment provider.
drop function if exists public.vanta_request_deposit(numeric, text, text);
drop function if exists public.vanta_request_withdrawal(numeric, text, text);
