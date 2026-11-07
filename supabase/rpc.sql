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
--   vanta_request_deposit(p_amount, p_method, p_reference)
--   vanta_request_withdrawal(p_amount, p_method, p_destination)
--
--  Operator-only
--  -------------
--   vanta_approve_deposit(p_deposit_id)   (service role)
--   vanta_run_daily_payouts(p_limit)      (service role / cron)
-- ============================================================================

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

  -- one credit per elapsed day, anchored on the activation timestamp
  v_due_at := v_inv.started_at + make_interval(days => v_inv.days_paid);
  if now() < v_due_at then
    raise exception 'EARNING_NOT_DUE: next credit available %', v_due_at;
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

  if not exists (
    select 1 from public.investments
    where id = p_investment_id and user_id = v_uid
  ) then
    raise exception 'NOT_YOUR_INVESTMENT';
  end if;

  return public.vanta_pay_day(p_investment_id);
end;
$$;

-- ── Deposits ───────────────────────────────────────────────────────────────
create or replace function public.vanta_request_deposit(
  p_amount    numeric,
  p_method    text,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_amount is null or p_amount < 20000 then
    raise exception 'MIN_DEPOSIT: minimum is 20,000 UGX';
  end if;

  if coalesce(trim(p_reference), '') = '' then
    raise exception 'REFERENCE_REQUIRED';
  end if;

  insert into public.deposits (user_id, amount, method, reference)
  values (v_uid, p_amount, coalesce(p_method, 'MTN MoMo'), trim(p_reference))
  returning id into v_id;

  insert into public.transactions (user_id, type, amount, status, reference, note, meta)
  values (
    v_uid,
    'deposit',
    p_amount,
    'pending',
    'DEP-' || upper(substr(replace(v_id::text, '-', ''), 1, 6)),
    coalesce(p_method, 'MTN MoMo') || ' · ' || trim(p_reference),
    jsonb_build_object('deposit_id', v_id)
  );

  return v_id;
end;
$$;

-- Operator action: confirm a deposit landed in the collection account.
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

  if v_dep.status <> 'pending' then
    raise exception 'DEPOSIT_ALREADY_REVIEWED';
  end if;

  update public.deposits
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_deposit_id;

  update public.profiles
     set balance = balance + v_dep.amount
   where id = v_dep.user_id;

  update public.transactions
     set status = 'completed'
   where user_id = v_dep.user_id
     and type = 'deposit'
     and meta ->> 'deposit_id' = p_deposit_id::text;

  return v_dep.amount;
end;
$$;

revoke all on function public.vanta_approve_deposit(uuid) from public, anon, authenticated;

-- ── Withdrawals ────────────────────────────────────────────────────────────
create or replace function public.vanta_request_withdrawal(
  p_amount      numeric,
  p_method      text,
  p_destination text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance numeric(14, 2);
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_amount is null or p_amount < 20000 then
    raise exception 'MIN_WITHDRAWAL: minimum is 20,000 UGX';
  end if;

  if coalesce(trim(p_destination), '') = '' then
    raise exception 'DESTINATION_REQUIRED';
  end if;

  select balance into v_balance
  from public.profiles
  where id = v_uid
  for update;

  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE: available %', v_balance;
  end if;

  -- hold the funds while the payout desk processes the request
  update public.profiles
     set balance = balance - p_amount
   where id = v_uid;

  insert into public.withdrawals (user_id, amount, method, destination)
  values (v_uid, p_amount, coalesce(p_method, 'MTN MoMo'), trim(p_destination))
  returning id into v_id;

  insert into public.transactions (user_id, type, amount, status, reference, note, meta)
  values (
    v_uid,
    'withdrawal',
    p_amount,
    'pending',
    'WDR-' || upper(substr(replace(v_id::text, '-', ''), 1, 6)),
    coalesce(p_method, 'MTN MoMo') || ' · ' || trim(p_destination),
    jsonb_build_object('withdrawal_id', v_id)
  );

  return v_id;
end;
$$;

-- ── Cron: pay every due investment ─────────────────────────────────────────
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
      and started_at + make_interval(days => days_paid) <= now()
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
        where w.user_id = v_uid and w.status = 'pending'), 0),
      'active_investments',   (
        select count(*) from public.investments i
        where i.user_id = v_uid and i.status = 'active')
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
               i.ends_at
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

grant execute on function public.vanta_dashboard()               to authenticated;
grant execute on function public.vanta_create_investment(text)   to authenticated;
grant execute on function public.vanta_claim_earnings(uuid)      to authenticated;
grant execute on function public.vanta_request_deposit(numeric, text, text) to authenticated;
grant execute on function public.vanta_request_withdrawal(numeric, text, text) to authenticated;
