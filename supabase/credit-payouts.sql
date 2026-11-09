-- ============================================================================
-- Credit payouts — scoped backfill for the missed 22:00 window of 09.11.2026
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (dashboard) as the project owner.
--
-- The job only ever missed ONE window: the credits that matured at 22:00
-- Africa/Kampala on 2026-11-09 (i.e. 2026-11-09 19:00 UTC). Everything else
-- was already handled. This script pays EXACTLY those, and nothing more:
-- it selects each active investment whose NEXT unpaid day matured on that
-- date, credits that single day, and stops. Idempotent — after a credit the
-- investment's next maturity rolls to 2026-11-10 and falls outside the filter,
-- so re-running (or running it after the 10th's window opens) never double-
-- pays, and never pulls in the 22:00 credits of any other day.
--
-- Change v_date below to re-point the backfill at a different missed window.
-- ============================================================================

-- ── 1 · Make sure the maturity hour is the live 22:00 window ───────────────
-- No-op when already correct (it is), but guards against a stray setting.
insert into public.platform_settings (key, value, updated_at)
values ('earnings_mature_at', '"22:00"'::jsonb, now())
on conflict (key) do update
  set value      = excluded.value,
      updated_at = now();

-- ── 2 · Preview: exactly who the backfill will credit (READ ONLY) ──────────
-- Next unpaid day matured on 2026-11-09 and is due (that window has passed).
select i.id                                                                as investment_id,
       coalesce(p.username, p.email, i.user_id::text)                     as member,
       i.plan_slug,
       i.days_paid,
       i.duration_days,
       i.daily_return,
       public.vanta_maturity_at(i.started_at, i.days_paid)                 as matured_at_utc,
       (public.vanta_maturity_at(i.started_at, i.days_paid)
          at time zone 'Africa/Kampala')                                   as matured_at_eat
  from public.investments i
  left join public.profiles p on p.id = i.user_id
 where i.status = 'active'
   and (public.vanta_maturity_at(i.started_at, i.days_paid) at time zone 'Africa/Kampala')::date
       = date '2026-11-09'
   and public.vanta_maturity_at(i.started_at, i.days_paid) <= now()
 order by i.started_at;

-- ── 3 · Credit that one day for each matched investment ────────────────────
-- One vanta_pay_day per row: pays the day whose index == days_paid, whose
-- maturity is the 09.11.2026 window. vanta_pay_day advances days_paid and
-- re-checks the guard under a row lock, so this cannot double-credit.
do $$
declare
  v_date  date   := date '2026-11-09';   -- the missed 22:00 window
  v_rec   record;
  v_count integer := 0;
begin
  for v_rec in
    select id
    from public.investments
    where status = 'active'
      and (public.vanta_maturity_at(started_at, days_paid) at time zone 'Africa/Kampala')::date = v_date
      and public.vanta_maturity_at(started_at, days_paid) <= now()
    order by started_at
  loop
    begin
      perform public.vanta_pay_day(v_rec.id);
      v_count := v_count + 1;
    exception when others then
      null; -- not (further) due / completed / locked — skip, safe on re-run
    end;
  end loop;

  raise notice 'Backfill: credited % investment(s) for the 22:00 window of %', v_count, v_date;
end $$;

-- ── 4 · Confirm the 09.11.2026 window is cleared ───────────────────────────
-- Expect 0. Anything left would be a row that was locked or already completed.
select count(*) as nov9_still_due
  from public.investments i
 where i.status = 'active'
   and (public.vanta_maturity_at(i.started_at, i.days_paid) at time zone 'Africa/Kampala')::date
       = date '2026-11-09'
   and public.vanta_maturity_at(i.started_at, i.days_paid) <= now();
