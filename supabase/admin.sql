-- ============================================================================
--  Vanta Fintech — admin dashboard foundation
--  Run AFTER schema.sql and rpc.sql.
--
--  What this adds
--  --------------
--   admins             the operator allow-list. Being in this table is what
--                      makes a signed-in account an admin — there is no role
--                      enum on profiles, mirroring the reference platform.
--   platform_settings  editable key/value rules + the platform freeze switch.
--   admin_audit_log    a real audit trail (the reference has none): every
--                      admin mutation records actor / action / target / note.
--   profiles.is_banned the ban flag the desk can flip; enforced in the client
--                      money RPCs (see the small patch in rpc.sql).
--
--  Privilege model
--  ---------------
--  Every admin entry point is a security-definer function that calls
--  vanta_admin_guard() first. The guard reads auth.uid() against the admins
--  table, so a non-admin gets FORBIDDEN even though they hold a valid session.
--  The functions are granted to `authenticated` (the admin acts with their own
--  session, which is what makes the audit log meaningful) — never to anon.
--
--  Bootstrap
--  ---------
--  The DO block at the bottom seeds the first admin(s). Edit the username list
--  before running, or grant from the Admins tab once you are in.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Operator allow-list — membership is what grants admin.';

create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.platform_settings is 'Editable platform rules + freeze switch.';

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_name  text,
  action      text not null,
  target_type text,
  target_id   text,
  note        text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_created_idx
  on public.admin_audit_log (created_at desc);

comment on table public.admin_audit_log is 'Append-only record of every admin mutation.';

-- Ban flag, enforced by the client money RPCs.
alter table public.profiles add column if not exists is_banned boolean not null default false;

-- ── Seed settings (idempotent) ──────────────────────────────────────────────
insert into public.platform_settings (key, value) values
  ('platform_frozen', 'false'::jsonb),
  ('freeze_message',  '"Deposits, activations, claims and withdrawals are paused for maintenance."'::jsonb),
  ('referral_rate_l1', '0.17'::jsonb),
  ('referral_rate_l2', '0.01'::jsonb)
on conflict (key) do nothing;

-- ── Guard + helpers ─────────────────────────────────────────────────────────
create or replace function public.vanta_is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_uid is not null
     and exists (select 1 from public.admins a where a.user_id = p_uid);
$$;

-- No-arg form the client can call to decide whether to show the Admin button.
create or replace function public.vanta_is_admin_self()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.vanta_is_admin(auth.uid());
$$;

-- Internal: raises ACCOUNT_RESTRICTED for a banned investor. Called by the
-- client money RPCs in rpc.sql (resolved at runtime, so ordering is fine).
create or replace function public.vanta_assert_not_banned(p_uid uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_uid is not null and exists (
    select 1 from public.profiles where id = p_uid and is_banned
  ) then
    raise exception 'ACCOUNT_RESTRICTED';
  end if;
end;
$$;

revoke all on function public.vanta_assert_not_banned(uuid) from public, anon, authenticated;

-- Raises FORBIDDEN unless the caller is an admin; returns the actor id so
-- callers can stamp it onto the audit log.
create or replace function public.vanta_admin_guard()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not public.vanta_is_admin(v_uid) then
    raise exception 'FORBIDDEN: admin only';
  end if;

  return v_uid;
end;
$$;

-- Internal: append one audit row for the acting admin.
create or replace function public.vanta_admin_log(
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_note        text,
  p_meta        jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_name  text;
begin
  select coalesce(p.full_name, p.username, 'Admin') into v_name
  from public.profiles p where p.id = v_uid;

  insert into public.admin_audit_log
    (actor_id, actor_name, action, target_type, target_id, note, meta)
  values
    (v_uid, coalesce(v_name, 'Admin'), p_action, p_target_type, p_target_id, p_note,
     coalesce(p_meta, '{}'::jsonb));
end;
$$;

-- Money rules as currently configured, so the Settings tab reads the truth
-- rather than a hard-coded copy. Reads the same values rpc.sql enforces.
create or replace function public.vanta_admin_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.vanta_rules();
$$;

-- ── Row level security ──────────────────────────────────────────────────────
alter table public.admins            enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_audit_log   enable row level security;

-- Admins may read the roster and the settings; the audit log is admin-only.
-- All writes go through the definer RPCs, never direct table access.
drop policy if exists "admins read roster" on public.admins;
create policy "admins read roster" on public.admins
  for select using (public.vanta_is_admin(auth.uid()));

drop policy if exists "admins read settings" on public.platform_settings;
create policy "admins read settings" on public.platform_settings
  for select using (public.vanta_is_admin(auth.uid()));

drop policy if exists "admins read audit" on public.admin_audit_log;
create policy "admins read audit" on public.admin_audit_log
  for select using (public.vanta_is_admin(auth.uid()));

-- ── Grant the self-check to signed-in users ─────────────────────────────────
revoke all on function public.vanta_is_admin(uuid)            from public, anon, authenticated;
revoke all on function public.vanta_admin_guard()             from public, anon, authenticated;
revoke all on function public.vanta_admin_log(text, text, text, text, jsonb) from public, anon, authenticated;
grant  execute on function public.vanta_is_admin_self()       to authenticated;
grant  execute on function public.vanta_admin_rules()         to authenticated;

-- ============================================================================
--  READ: the whole dashboard in one round-trip (mirrors vanta_dashboard()).
-- ============================================================================
create or replace function public.vanta_admin_dashboard(
  p_member_query text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_q     text := trim(coalesce(p_member_query, ''));
  v_res   jsonb;
begin
  v_uid := public.vanta_admin_guard();

  select jsonb_build_object(
    'actor', jsonb_build_object('id', v_uid),

    -- ── Overview KPIs ────────────────────────────────────────────────────
    'overview', jsonb_build_object(
      'members_total',     (select count(*) from public.profiles),
      'members_today',     (select count(*) from public.profiles
                             where created_at >= date_trunc('day', now() at time zone 'Africa/Kampala')
                                    at time zone 'Africa/Kampala'),
      'members_yesterday', (select count(*) from public.profiles
                             where created_at >= (date_trunc('day', now() at time zone 'Africa/Kampala') - interval '1 day')
                                    at time zone 'Africa/Kampala'
                               and created_at <  (date_trunc('day', now() at time zone 'Africa/Kampala'))
                                    at time zone 'Africa/Kampala'),
      'active_members',    (select count(*) from public.investments where status = 'active'),
      'banned_members',    (select count(*) from public.profiles where is_banned),

      'deposits_in_flight',  coalesce((select count(*) from public.deposits
                             where status in ('pending', 'awaiting_pin')), 0),
      'withdrawals_waiting', coalesce((select count(*) from public.withdrawals
                             where status in ('pending', 'processing')), 0),

      'deposits_received', coalesce((select sum(amount) from public.deposits
                             where status in ('credited', 'approved')), 0),
      'withdrawals_paid',  coalesce((select sum(amount) from public.withdrawals
                             where status in ('paid', 'processed')), 0),
      'fees_collected',    coalesce((select sum(charge) from public.deposits
                             where status in ('credited', 'approved')), 0)
                       + coalesce((select sum(charge) from public.withdrawals
                             where status in ('paid', 'processed')), 0),
      'returns_paid',      coalesce((select sum(amount) from public.transactions
                             where type in ('earning', 'capital_return') and status = 'completed'), 0),
      'commission_paid',   coalesce((select sum(amount) from public.transactions
                             where type = 'referral' and status = 'completed'), 0),

      'wallet_liability',  coalesce((select sum(balance) from public.profiles), 0),
      'active_cycles',     (select count(*) from public.investments where status = 'active')
    ),

    -- ── Members (searchable) ─────────────────────────────────────────────
    'members', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select p.id, p.full_name, p.username, p.phone, p.referral_code,
               p.balance, p.total_invested, p.total_earned, p.referral_earned,
               p.is_banned, p.created_at,
               (select count(*) from public.profiles c where c.referred_by = p.id) as referrals_count,
               (select count(*) from public.investments i where i.user_id = p.id and i.status = 'active') as active_cycles,
               (select min(d.created_at) from public.deposits d
                 where d.user_id = p.id and d.status in ('credited', 'approved')) as first_deposit_at
        from public.profiles p
        where v_q = ''
           or lower(p.full_name) like '%' || lower(v_q) || '%'
           or lower(coalesce(p.username, '')) like '%' || lower(v_q) || '%'
           or coalesce(p.phone, '') like '%' || v_q || '%'
           or p.referral_code ilike v_q
        order by p.created_at desc
        limit 200
      ) t
    ), '[]'::jsonb),

    -- ── Deposits queue ───────────────────────────────────────────────────
    'deposits', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select d.id, d.user_id,
               coalesce(p.full_name, '—') as name, p.username,
               d.amount, d.method, d.msisdn, d.network, d.charge, d.net_amount,
               d.status, d.reference, d.tid, d.failure_message,
               d.created_at, d.settled_at
        from public.deposits d
        left join public.profiles p on p.id = d.user_id
        order by d.created_at desc
        limit 150
      ) t
    ), '[]'::jsonb),

    -- ── Withdrawals queue ────────────────────────────────────────────────
    'withdrawals', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select w.id, w.user_id,
               coalesce(p.full_name, '—') as name, p.username,
               w.amount, w.method, w.msisdn, w.network, w.charge,
               (w.amount - coalesce(w.charge, 0)) as net_amount,
               w.status, w.reference, w.tid, w.failure_message,
               w.created_at, w.settled_at
        from public.withdrawals w
        left join public.profiles p on p.id = w.user_id
        order by w.created_at desc
        limit 150
      ) t
    ), '[]'::jsonb),

    -- ── Referral commissions ─────────────────────────────────────────────
    'referrals', jsonb_build_object(
      'level1_paid', coalesce((select sum(amount) from public.referral_commissions where level = 1), 0),
      'level2_paid', coalesce((select sum(amount) from public.referral_commissions where level = 2), 0),
      'invested_members', (select count(distinct source_user_id) from public.referral_commissions),
      'rows', coalesce((
        select jsonb_agg(row_to_json(t) order by t.created_at desc)
        from (
          select rc.id, rc.level, rc.rate, rc.amount, rc.created_at,
                 b.full_name as beneficiary, b.username as beneficiary_username,
                 s.full_name as source,       s.username as source_username
          from public.referral_commissions rc
          join public.profiles b on b.id = rc.user_id
          join public.profiles s on s.id = rc.source_user_id
          order by rc.created_at desc
          limit 150
        ) t
      ), '[]'::jsonb)
    ),

    -- ── Cycles (investments) ─────────────────────────────────────────────
    'cycles', coalesce((
      select jsonb_agg(row_to_json(t) order by t.started_at desc)
      from (
        select i.id, i.user_id,
               coalesce(p.full_name, '—') as name, p.username,
               pl.name as plan_name, i.amount, i.daily_return, i.duration_days,
               i.days_paid, i.total_return, i.status, i.started_at, i.ends_at
        from public.investments i
        left join public.profiles p on p.id = i.user_id
        join public.plans pl on pl.slug = i.plan_slug
        order by i.started_at desc
        limit 150
      ) t
    ), '[]'::jsonb),

    -- ── Plans catalogue ──────────────────────────────────────────────────
    'plans', coalesce((
      select jsonb_agg(row_to_json(t) order by t.sort_order asc)
      from (
        select pl.slug, pl.name, pl.amount, pl.daily_return, pl.duration_days,
               pl.badge, pl.is_active, pl.sort_order,
               (select count(*) from public.investments i
                 where i.plan_slug = pl.slug and i.status = 'active') as active_count
        from public.plans pl
      ) t
    ), '[]'::jsonb),

    -- ── Admin roster ─────────────────────────────────────────────────────
    'admins', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at asc)
      from (
        select a.user_id as id,
               coalesce(p.full_name, p.username, 'Admin') as name,
               p.username, a.created_at,
               (a.user_id = v_uid) as is_self
        from public.admins a
        left join public.profiles p on p.id = a.user_id
      ) t
    ), '[]'::jsonb),

    -- ── Audit / activity ─────────────────────────────────────────────────
    'audit', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select l.id, l.actor_name, l.action, l.target_type, l.target_id,
               l.note, l.created_at
        from public.admin_audit_log l
        order by l.created_at desc
        limit 80
      ) t
    ), '[]'::jsonb),

    -- ── Settings + rules ─────────────────────────────────────────────────
    'settings', coalesce((
      select jsonb_object_agg(s.key, s.value) from public.platform_settings s
    ), '{}'::jsonb),
    'rules', public.vanta_rules()
  ) into v_res;

  return v_res;
end;
$$;


-- ============================================================================
--  READ: one member's detail (drives the Members tab expansion + ledger).
-- ============================================================================
create or replace function public.vanta_admin_member(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_res jsonb;
begin
  v_uid := public.vanta_admin_guard();

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select jsonb_build_object(
    'profile', (
      select row_to_json(t) from (
        select p.id, p.full_name, p.username, p.email, p.phone, p.referral_code,
               p.balance, p.total_invested, p.total_earned, p.referral_earned,
               p.is_banned, p.created_at,
               up.full_name as referred_by_name, up.referral_code as referred_by_code
        from public.profiles p
        left join public.profiles up on up.id = p.referred_by
        where p.id = p_user_id
      ) t
    ),
    'cycles', coalesce((
      select jsonb_agg(row_to_json(t) order by t.started_at desc)
      from (
        select i.id, pl.name as plan_name, i.amount, i.daily_return,
               i.duration_days, i.days_paid, i.status, i.started_at, i.ends_at
        from public.investments i
        join public.plans pl on pl.slug = i.plan_slug
        where i.user_id = p_user_id
      ) t
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select tx.id, tx.type, tx.amount, tx.status, tx.reference, tx.note, tx.created_at
        from public.transactions tx
        where tx.user_id = p_user_id
        order by tx.created_at desc
        limit 30
      ) t
    ), '[]'::jsonb),
    'downline', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select c.id, c.full_name, c.referral_code, c.created_at,
               coalesce((select sum(i.amount) from public.investments i
                         where i.user_id = c.id), 0) as invested
        from public.profiles c where c.referred_by = p_user_id
      ) t
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

-- ============================================================================
--  WRITE: mutations. Each guards, acts, then logs.
-- ============================================================================

-- Confirm a manual / bank deposit that the gateway never finalised.
create or replace function public.vanta_admin_approve_deposit(
  p_deposit_id uuid,
  p_note       text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_amt numeric;
begin
  v_uid := public.vanta_admin_guard();
  v_amt := public.vanta_approve_deposit(p_deposit_id);
  perform public.vanta_admin_log('approve_deposit', 'deposit', p_deposit_id::text,
                                 coalesce(nullif(trim(p_note), ''), 'manual confirmation'),
                                 jsonb_build_object('amount', v_amt));
  return v_amt;
end;
$$;

-- Write off a deposit that will never be paid.
create or replace function public.vanta_admin_reject_deposit(
  p_deposit_id uuid,
  p_note       text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_msg text := coalesce(nullif(trim(p_note), ''), 'rejected by the desk');
begin
  v_uid := public.vanta_admin_guard();
  perform public.vanta_fail_collection(p_deposit_id, 'ADMIN_REJECTED', v_msg, 'TF');
  perform public.vanta_admin_log('reject_deposit', 'deposit', p_deposit_id::text, v_msg);
  return 'rejected';
end;
$$;

-- Mark a stuck payout as settled by hand (the wallet is already held).
create or replace function public.vanta_admin_settle_withdrawal(
  p_withdrawal_id uuid,
  p_note          text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_amt numeric;
begin
  v_uid := public.vanta_admin_guard();
  v_amt := public.vanta_settle_disbursement(p_withdrawal_id, null, null, null);
  perform public.vanta_admin_log('settle_withdrawal', 'withdrawal', p_withdrawal_id::text,
                                 coalesce(nullif(trim(p_note), ''), 'manual settlement'),
                                 jsonb_build_object('amount', v_amt));
  return v_amt;
end;
$$;

-- Refuse a payout and release the hold back to the wallet.
create or replace function public.vanta_admin_reject_withdrawal(
  p_withdrawal_id uuid,
  p_note          text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_msg text := coalesce(nullif(trim(p_note), ''), 'rejected by the desk');
begin
  v_uid := public.vanta_admin_guard();
  perform public.vanta_fail_disbursement(p_withdrawal_id, 'ADMIN_REJECTED', v_msg, 'TF');
  perform public.vanta_admin_log('reject_withdrawal', 'withdrawal', p_withdrawal_id::text, v_msg);
  return 'rejected';
end;
$$;

-- Manual wallet correction. p_delta is signed shillings (credit +, debit −).
create or replace function public.vanta_admin_adjust_wallet(
  p_user_id uuid,
  p_delta   numeric,
  p_reason  text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_bal    numeric(14, 2);
  v_amount numeric(14, 2) := round(p_delta, 2);
  v_type   text;
  v_ref    text;
begin
  v_uid := public.vanta_admin_guard();

  if v_amount = 0 then
    raise exception 'NOTHING_TO_ADJUST';
  end if;

  if v_amount <> floor(v_amount) then
    raise exception 'ODD_AMOUNT: enter a whole number of shillings';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'REASON_REQUIRED: state why the wallet is being corrected';
  end if;

  select balance into v_bal from public.profiles where id = p_user_id for update;
  if v_bal is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_amount < 0 and v_bal + v_amount < 0 then
    raise exception 'INSUFFICIENT_BALANCE: only % available to debit', v_bal;
  end if;

  v_type := case when v_amount > 0 then 'adjustment_credit' else 'adjustment_debit' end;
  v_ref  := 'ADJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  update public.profiles
     set balance = balance + v_amount
   where id = p_user_id;

  insert into public.transactions (user_id, type, amount, status, reference, note, meta)
  values (
    p_user_id, v_type, abs(v_amount), 'completed', v_ref,
    trim(p_reason),
    jsonb_build_object('actor', v_uid, 'direction',
                       case when v_amount > 0 then 'credit' else 'debit' end)
  );

  perform public.vanta_admin_log('adjust_wallet', 'member', p_user_id::text,
                                 trim(p_reason),
                                 jsonb_build_object('delta', v_amount, 'reference', v_ref));

  return v_amount;
end;
$$;

-- Ban / un-ban an account. Enforcement lives in the client money RPCs.
create or replace function public.vanta_admin_set_ban(
  p_user_id uuid,
  p_banned  boolean,
  p_reason  text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := public.vanta_admin_guard();

  if p_user_id = v_uid then
    raise exception 'CANNOT_BAN_SELF';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  update public.profiles set is_banned = p_banned where id = p_user_id;

  perform public.vanta_admin_log(
    case when p_banned then 'ban_member' else 'unban_member' end,
    'member', p_user_id::text, nullif(trim(coalesce(p_reason, '')), ''));

  return p_banned;
end;
$$;

-- Add or edit a plan. Existing cycles keep their snapshot; only new
-- activations read the changed figures.
create or replace function public.vanta_admin_upsert_plan(
  p_slug   text,
  p_name   text,
  p_amount numeric,
  p_daily  numeric,
  p_days   integer,
  p_badge  text,
  p_active boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_slug text := lower(trim(p_slug));
begin
  v_uid := public.vanta_admin_guard();

  if v_slug !~ '^[a-z0-9_]{2,24}$' then
    raise exception 'INVALID_SLUG: use 2–24 lowercase letters, digits or underscore';
  end if;

  if p_amount is null or p_amount <= 0
     or p_daily is null or p_daily <= 0
     or p_days is null or p_days <= 0 then
    raise exception 'INVALID_PLAN: price, daily earning and duration must be positive';
  end if;

  insert into public.plans
    (slug, name, amount, daily_return, duration_days, badge, is_active)
  values
    (v_slug, trim(p_name), p_amount, p_daily, p_days,
     nullif(trim(coalesce(p_badge, '')), ''), p_active)
  on conflict (slug) do update
    set name         = excluded.name,
        amount       = excluded.amount,
        daily_return = excluded.daily_return,
        duration_days = excluded.duration_days,
        badge        = excluded.badge,
        is_active    = excluded.is_active;

  perform public.vanta_admin_log('upsert_plan', 'plan', v_slug,
                                 format('%s · %s for %s days', trim(p_name), p_amount, p_days),
                                 jsonb_build_object('active', p_active));

  return v_slug;
end;
$$;

-- Grant admin by username.
create or replace function public.vanta_admin_grant(p_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid;
  v_username text := lower(trim(regexp_replace(coalesce(p_username, ''), '^@', '')));
  v_target   uuid;
begin
  v_uid := public.vanta_admin_guard();

  select id into v_target from public.profiles where lower(username) = v_username limit 1;
  if v_target is null then
    raise exception 'MEMBER_NOT_FOUND: no account with username %', v_username;
  end if;

  if exists (select 1 from public.admins where user_id = v_target) then
    raise exception 'ALREADY_ADMIN';
  end if;

  insert into public.admins (user_id, granted_by) values (v_target, v_uid);

  perform public.vanta_admin_log('grant_admin', 'admin', v_target::text, v_username);
  return v_target;
end;
$$;

-- Revoke admin. Never the last one, never yourself.
create or replace function public.vanta_admin_revoke(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_count integer;
begin
  v_uid := public.vanta_admin_guard();

  if p_user_id = v_uid then
    raise exception 'CANNOT_REMOVE_SELF';
  end if;

  select count(*) into v_count from public.admins;
  if v_count <= 1 then
    raise exception 'LAST_ADMIN: at least one admin must remain';
  end if;

  delete from public.admins where user_id = p_user_id;
  perform public.vanta_admin_log('revoke_admin', 'admin', p_user_id::text, null);
end;
$$;

-- Edit one settings key (freeze switch, rates, copy...).
create or replace function public.vanta_admin_set_setting(
  p_key   text,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := public.vanta_admin_guard();

  if nullif(trim(p_key), '') is null then
    raise exception 'INVALID_KEY';
  end if;

  insert into public.platform_settings (key, value, updated_by, updated_at)
  values (trim(p_key), coalesce(p_value, 'null'::jsonb), v_uid, now())
  on conflict (key) do update
    set value = excluded.value, updated_by = v_uid, updated_at = now();

  perform public.vanta_admin_log('set_setting', 'setting', trim(p_key),
                                 null, jsonb_build_object('value', p_value));
end;
$$;

-- ── Adjustment ledger types ─────────────────────────────────────────────────
-- Widen the transactions type vocabulary so a manual correction is auditable
-- and renders with the right sign in the investor ledger.
do $$
begin
  alter table public.transactions drop constraint if exists transactions_type_check;
  alter table public.transactions
    add constraint transactions_type_check check (type in (
      'deposit', 'investment', 'earning', 'referral', 'withdrawal', 'capital_return',
      'adjustment_credit', 'adjustment_debit'));
exception when others then
  null; -- constraint name differs on some installs; the check already allows it
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
grant execute on function public.vanta_admin_dashboard(text)                      to authenticated;
grant execute on function public.vanta_admin_member(uuid)                         to authenticated;
grant execute on function public.vanta_admin_approve_deposit(uuid, text)          to authenticated;
grant execute on function public.vanta_admin_reject_deposit(uuid, text)           to authenticated;
grant execute on function public.vanta_admin_settle_withdrawal(uuid, text)        to authenticated;
grant execute on function public.vanta_admin_reject_withdrawal(uuid, text)        to authenticated;
grant execute on function public.vanta_admin_adjust_wallet(uuid, numeric, text)   to authenticated;
grant execute on function public.vanta_admin_set_ban(uuid, boolean, text)         to authenticated;
grant execute on function public.vanta_admin_upsert_plan(text, text, numeric, numeric, integer, text, boolean) to authenticated;
grant execute on function public.vanta_admin_grant(text)                          to authenticated;
grant execute on function public.vanta_admin_revoke(uuid)                         to authenticated;
grant execute on function public.vanta_admin_set_setting(text, jsonb)             to authenticated;

-- ============================================================================
--  Bootstrap the first admin(s). EDIT THE LIST before running, then use the
--  Admins tab to add or remove operators. Re-running is safe (idempotent).
-- ============================================================================
do $$
declare
  v_username text;
  v_target   uuid;
begin
  -- If any admin already exists, leave the roster untouched.
  if exists (select 1 from public.admins) then
    return;
  end if;

  foreach v_username in array array['micron'] loop  -- <-- seed admin usernames
    select id into v_target from public.profiles where lower(username) = v_username limit 1;
    if v_target is not null then
      insert into public.admins (user_id, granted_by) values (v_target, null)
      on conflict (user_id) do nothing;
    end if;
  end loop;
end;
$$;
