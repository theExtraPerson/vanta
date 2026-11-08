-- ============================================================================
--  Vanta Fintech — database schema
--  Run in the Supabase SQL editor (or `supabase db push`) before rpc.sql.
--
--  Money model
--  -----------
--  profiles.balance        wallet cash available to invest or withdraw
--  investments             one row per activated product cycle
--  transactions            append-only ledger (every credit / debit)
--  deposits / withdrawals  operator queues, settled by an admin
--  referral_commissions    17% level 1 + 1% level 2, paid from Vanta margin
--
--   Auth is username-first: the client sends
--   <username>@NEXT_PUBLIC_USERNAME_DOMAIN as the Supabase email, and the
--   trigger below copies the username, phone and invite code into profiles.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Products ────────────────────────────────────────────────────────────────
create table if not exists public.plans (
  slug          text primary key,
  name          text not null,
  amount        numeric(14, 2) not null check (amount > 0),
  daily_return  numeric(14, 2) not null check (daily_return > 0),
  duration_days integer not null check (duration_days > 0),
  sort_order    integer not null default 0,
  badge         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on table public.plans is 'VANTAFINTECH AI Technology long-term plans — mirrors src/lib/plans.ts.';

-- The five live plans. Amount, daily earning and maturity days are exactly the
-- figures published by Vanta: price + daily * days = payout after maturity.
insert into public.plans (slug, name, amount, daily_return, duration_days, sort_order, badge)
values
  ('core',  'VINTA Core',   20000,  3000, 3, 1, 'Entry'),
  ('nova',  'VINTA Nova',   50000,  9000, 4, 2, null),
  ('pulse', 'VINTA Pulse', 150000, 20000, 5, 3, 'Most popular'),
  ('max',   'VINTA max',   200000, 30000, 6, 4, null),
  ('gold',  'VINTAgold',   500000, 80000, 7, 5, 'Highest return')
on conflict (slug) do update
  set amount        = excluded.amount,
      daily_return  = excluded.daily_return,
      duration_days = excluded.duration_days,
      name          = excluded.name,
      badge         = excluded.badge,
      sort_order    = excluded.sort_order,
      is_active     = true;

-- Retire the legacy catalogue. Rows are kept (not deleted) so historical
-- investments still resolve their plan name through the foreign key, but no
-- new activation can target them because vanta_create_investment filters
-- on is_active.
update public.plans
   set is_active = false
 where slug not in ('core', 'nova', 'pulse', 'max', 'gold');

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null default 'Vanta Investor',
  username        text,
  email           text,
  phone           text,
  referral_code   text unique not null,
  referred_by     uuid references public.profiles (id) on delete set null,
  balance         numeric(14, 2) not null default 0 check (balance >= 0),
  total_earned    numeric(14, 2) not null default 0,
  total_invested  numeric(14, 2) not null default 0,
  referral_earned numeric(14, 2) not null default 0,
  created_at      timestamptz not null default now()
);

-- Username login: sign-up collects a username and the app maps it to
-- <username>@<NEXT_PUBLIC_USERNAME_DOMAIN> for Supabase auth.
alter table public.profiles add column if not exists username text;

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);
create index if not exists profiles_referral_code_idx on public.profiles (referral_code);
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- Accounts created before usernames existed derive one from their email so the
-- login form can find them.
do $$
declare
  r     record;
  v_base text;
  v_try  text;
  v_n    integer;
begin
  for r in select id, email from public.profiles where username is null and email is not null loop
    v_base := left(regexp_replace(lower(split_part(r.email, '@', 1)), '[^a-z0-9_]', '', 'g'), 12);
    if v_base = '' then
      v_base := 'vanta';
    end if;

    v_try := v_base;
    v_n   := 0;
    loop
      exit when not exists (
        select 1 from public.profiles where lower(username) = v_try and id <> r.id);
      v_n   := v_n + 1;
      v_try := left(v_base, 10) || v_n::text;
    end loop;

    update public.profiles set username = v_try where id = r.id;
  end loop;
end;
$$;

-- ── Investments ─────────────────────────────────────────────────────────────
create table if not exists public.investments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  plan_slug     text not null references public.plans (slug),
  amount        numeric(14, 2) not null check (amount > 0),
  daily_return  numeric(14, 2) not null check (daily_return > 0),
  duration_days integer not null check (duration_days > 0),
  total_return  numeric(14, 2) not null,
  days_paid     integer not null default 0 check (days_paid >= 0),
  last_paid_at  timestamptz,
  status        text not null default 'active' check (status in ('active', 'completed')),
  started_at    timestamptz not null default now(),
  ends_at       timestamptz not null
);

create index if not exists investments_user_idx on public.investments (user_id, status);
create index if not exists investments_due_idx on public.investments (status, started_at);

-- ── Ledger ──────────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in (
               'deposit', 'investment', 'earning', 'referral', 'withdrawal',
               'capital_return', 'registration_bonus')),
  amount     numeric(14, 2) not null check (amount > 0),
  status     text not null default 'completed' check (status in ('pending', 'completed', 'rejected')),
  reference  text,
  note       text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);
create unique index if not exists transactions_reference_key on public.transactions (reference)
  where reference is not null;

-- ── Deposits ────────────────────────────────────────────────────────────────
-- A deposit is a SHASHURA collection (POST /requestToPay): the row is created
-- first so the gateway reference is derived from its id, the payer then approves
-- the mobile money prompt, and the ledger is credited by the signed callback
-- (`vanta_handle_gateway_event`) or by an enquiry poll.
--   status: pending      row created, prompt not pushed (or manual/bank deposit)
--           awaiting_pin prompt delivered, payer has not approved
--           credited     money confirmed and added to the wallet
--           failed       declined / timed out / cancelled
--           rejected     written off by an operator
--           approved     legacy manual path, kept for historical rows
create table if not exists public.deposits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     numeric(14, 2) not null check (amount >= 2000),
  method     text not null default 'MTN MoMo',
  msisdn     text,
  reference  text not null default '',
  tid        text,
  network    text,
  gateway_state text,
  failure_code    text,
  failure_message text,
  charge     numeric(14, 2),
  net_amount numeric(14, 2),
  status     text not null default 'pending' check (status in (
               'pending', 'awaiting_pin', 'credited', 'failed', 'rejected', 'approved')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists deposits_user_idx on public.deposits (user_id, created_at desc);
create index if not exists deposits_status_idx on public.deposits (status, created_at desc);
create unique index if not exists deposits_reference_key on public.deposits (reference)
  where reference <> '';

-- ── Withdrawals ─────────────────────────────────────────────────────────────
-- A withdrawal is a SHASHURA disbursement (POST /disburse). The wallet is held
-- at request time, the payout is pushed, and the callback either confirms it or
-- releases the hold back to the wallet.
--   pending    row created, payout not pushed
--   processing gateway accepted it, awaiting the network (MTN)
--   paid       confirmed settled
--   failed     declined — the hold was returned to the wallet
--   rejected   written off by an operator
--   processed  legacy manual path, kept for historical rows
create table if not exists public.withdrawals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      numeric(14, 2) not null check (amount >= 5000),
  method      text not null default 'MTN MoMo',
  destination text not null,
  msisdn      text,
  reference   text not null default '',
  tid         text,
  network     text,
  gateway_state text,
  failure_code    text,
  failure_message text,
  charge      numeric(14, 2),
  status      text not null default 'pending' check (status in (
                'pending', 'processing', 'paid', 'failed', 'rejected', 'processed')),
  processed_at timestamptz,
  processed_by uuid references auth.users (id),
  settled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists withdrawals_user_idx on public.withdrawals (user_id, created_at desc);
create index if not exists withdrawals_status_idx on public.withdrawals (status, created_at desc);
create unique index if not exists withdrawals_reference_key on public.withdrawals (reference)
  where reference <> '';

-- ── Gateway event log ───────────────────────────────────────────────────────
-- Every callback and every enquiry poll is written here before it touches the
-- ledger. The unique key (tid, type, status) is what makes settlement
-- idempotent: retries from the gateway, or a poll that races a callback, settle
-- money exactly once.
create table if not exists public.payment_events (
  id             uuid primary key default gen_random_uuid(),
  tid            text not null,
  external_ref   text,
  event          text not null default 'transaction.finalized',
  type           text not null check (type in ('COLLECTION', 'DISBURSEMENT')),
  status         text not null check (status in ('PENDING', 'SUCCESSFUL', 'FAILED')),
  environment    text,
  amount         numeric(14, 2),
  charge         numeric(14, 2),
  net_amount     numeric(14, 2),
  msisdn         text,
  network        text,
  failure_code   text,
  failure_message text,
  payload        jsonb not null default '{}'::jsonb,
  applied        boolean not null default false,
  deposit_id     uuid references public.deposits (id) on delete set null,
  withdrawal_id  uuid references public.withdrawals (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (tid, type, status)
);

create index if not exists payment_events_ref_idx on public.payment_events (external_ref);

-- ── Referral commissions ────────────────────────────────────────────────────
create table if not exists public.referral_commissions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  source_user_id uuid not null references public.profiles (id) on delete cascade,
  investment_id  uuid references public.investments (id) on delete set null,
  level          integer not null check (level in (1, 2)),
  rate           numeric(5, 4) not null,
  amount         numeric(14, 2) not null check (amount > 0),
  created_at     timestamptz not null default now(),
  unique (investment_id, user_id, level)
);

create index if not exists referral_commissions_user_idx
  on public.referral_commissions (user_id, level);

-- ── Row level security ──────────────────────────────────────────────────────
alter table public.plans                enable row level security;
alter table public.profiles             enable row level security;
alter table public.investments          enable row level security;
alter table public.transactions         enable row level security;
alter table public.deposits             enable row level security;
alter table public.withdrawals          enable row level security;
alter table public.referral_commissions enable row level security;
alter table public.payment_events       enable row level security;

-- payment_events has no read policy on purpose: it is written by the
-- security-definer RPCs and only ever readable with the service role key.

drop policy if exists "plans are public read" on public.plans;
create policy "plans are public read" on public.plans
  for select using (true);

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "investments read own" on public.investments;
create policy "investments read own" on public.investments
  for select using (auth.uid() = user_id);

drop policy if exists "transactions read own" on public.transactions;
create policy "transactions read own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "deposits read own" on public.deposits;
create policy "deposits read own" on public.deposits
  for select using (auth.uid() = user_id);

drop policy if exists "withdrawals read own" on public.withdrawals;
create policy "withdrawals read own" on public.withdrawals
  for select using (auth.uid() = user_id);

drop policy if exists "commissions read own" on public.referral_commissions;
create policy "commissions read own" on public.referral_commissions
  for select using (auth.uid() = user_id);

-- All writes go through the security-definer RPCs in rpc.sql, never direct
-- table access, so no insert/update policies are granted on money tables.

-- ── Referral codes ─────────────────────────────────────────────────────────
-- Short random letter+number text, e.g. 'K7M2Q9'. Ambiguous glyphs (I, O, 0, 1)
-- are excluded so a code can be read out over the phone.
create or replace function public.vanta_random_code(p_length integer default 6)
returns text
language sql
volatile
as $$
  select string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                  1 + floor(random() * 32)::int, 1),
           ''
         )
  from generate_series(1, greatest(p_length, 4));
$$;

revoke all on function public.vanta_random_code(integer) from public, anon, authenticated;

-- ── Profile provisioning on sign-up ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code      text;
  v_referrer  uuid;
  v_ref_input text;
  v_username  text;
  v_bonus     numeric;
begin
  -- unique random referral code (letters + numbers, no separators)
  loop
    v_code := public.vanta_random_code(6);
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;

  -- invite code arrives from /register?code=XXXXXX
  v_ref_input := upper(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'referral_code', ''), '[^a-zA-Z0-9]', '', 'g'));

  if v_ref_input <> '' then
    select id into v_referrer
    from public.profiles
    where referral_code = v_ref_input
    limit 1;
  end if;

  -- username is validated client-side; keep the database copy in the same
  -- shape (lowercase, [a-z0-9_]) so the unique index cannot be spoofed
  v_username := nullif(
    regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', '')),
                   '[^a-z0-9_]', '', 'g'),
    '');

  if v_username is not null
     and exists (select 1 from public.profiles where lower(username) = v_username) then
    v_username := left(v_username, 12) || lower(public.vanta_random_code(3));
  end if;

  insert into public.profiles (id, full_name, username, email, phone, referral_code, referred_by)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Vanta Investor'),
    v_username,
    new.email,
    new.raw_user_meta_data ->> 'phone',
    v_code,
    v_referrer
  )
  on conflict (id) do nothing;

  -- Registration bonus, credited once when the profile was actually created.
  -- The amount lives in platform_settings (registration_bonus) so the desk can
  -- retune it without a deploy; 0 disables the credit. Before admin.sql exists
  -- the helper falls back to the published 1,000 UGX figure.
  if found then
    v_bonus := coalesce(public.vanta_setting_number('registration_bonus', 1000), 0);
    if v_bonus > 0 then
      update public.profiles
         set balance = balance + v_bonus
       where id = new.id;

      insert into public.transactions (user_id, type, amount, status, note)
      values (new.id, 'registration_bonus', v_bonus, 'completed', 'Registration bonus');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Upgrade path ───────────────────────────────────────────────────────────
-- Idempotent changes for databases that were created before the SHASHURA
-- gateway integration: the extra gateway columns, and the new minimums
-- (2,000 UGX deposit / 5,000 UGX withdrawal) replacing the old 20,000 checks.
alter table public.deposits    add column if not exists msisdn          text;
alter table public.deposits    add column if not exists tid             text;
alter table public.deposits    add column if not exists network         text;
alter table public.deposits    add column if not exists gateway_state   text;
alter table public.deposits    add column if not exists failure_code    text;
alter table public.deposits    add column if not exists failure_message text;
alter table public.deposits    add column if not exists charge          numeric(14, 2);
alter table public.deposits    add column if not exists net_amount      numeric(14, 2);
alter table public.deposits    add column if not exists settled_at      timestamptz;
alter table public.deposits    alter column reference set default '';
alter table public.deposits    alter column reference set not null;

alter table public.withdrawals add column if not exists msisdn          text;
alter table public.withdrawals add column if not exists tid             text;
alter table public.withdrawals add column if not exists network         text;
alter table public.withdrawals add column if not exists gateway_state   text;
alter table public.withdrawals add column if not exists failure_code    text;
alter table public.withdrawals add column if not exists failure_message text;
alter table public.withdrawals add column if not exists charge          numeric(14, 2);
alter table public.withdrawals add column if not exists settled_at      timestamptz;
alter table public.withdrawals add column if not exists reference       text default '' not null;

-- Gateway status vocabularies and the new minimums supersede the checks the old
-- tables were created with. Constraint names follow Postgres' automatic
-- <table>_<column>_check pattern, so dropping if exists covers both a fresh
-- install (created above) and an upgrade of an existing database.
do $$
begin
  alter table public.deposits    drop constraint if exists deposits_status_check;
  alter table public.deposits    drop constraint if exists deposits_amount_check;
  alter table public.withdrawals drop constraint if exists withdrawals_status_check;
  alter table public.withdrawals drop constraint if exists withdrawals_amount_check;

  alter table public.deposits
    add constraint deposits_amount_check check (amount >= 2000);
  alter table public.deposits
    add constraint deposits_status_check check (status in (
      'pending', 'awaiting_pin', 'credited', 'failed', 'rejected', 'approved'));

  alter table public.withdrawals
    add constraint withdrawals_amount_check check (amount >= 5000);
  alter table public.withdrawals
    add constraint withdrawals_status_check check (status in (
      'pending', 'processing', 'paid', 'failed', 'rejected', 'processed'));
end;
$$;

