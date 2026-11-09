import Link from "next/link";
import { getDashboard } from "@/lib/data";
import { ClaimButton } from "@/components/dashboard/forms";
import {
  EmptyState,
  InvestmentCard,
  StatCard,
  TxRow,
  WalletCard,
} from "@/components/dashboard/widgets";
import { NewsWire } from "@/components/dashboard/NewsCarousel";
import { SignalBoard } from "@/components/dashboard/SignalBoard";
import { InstallAppTile } from "@/components/shell/InstallAppTile";
import { getMarketFeed, marketFeedsEnabled } from "@/lib/market/feed";
import { ButtonLink, Pill } from "@/components/ui/primitives";
import { plans } from "@/lib/plans";
import { clockTime, ugx } from "@/lib/format";
import { earningsMatureAt } from "@/lib/supabase/config";

const actions = [
  { href: "/dashboard/wallet?tab=deposit", label: "Deposit", icon: "down" },
  { href: "/dashboard/wallet?tab=withdraw", label: "Withdraw", icon: "up" },
  { href: "/dashboard/plans", label: "Plans", icon: "layers" },
  { href: "/dashboard/referrals", label: "Invite", icon: "team" },
] as const;

const icons: Record<string, React.ReactNode> = {
  down: (
    <>
      <path d="M12 4v11" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 20h14" />
    </>
  ),
  up: (
    <>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 20h14" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
      <path d="M3.5 12.5 12 17l8.5-4.5" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c.6-3.1 2.8-4.8 5.5-4.8s4.9 1.7 5.5 4.8" />
      <path d="M16 5.6a3 3 0 0 1 0 5.6" />
    </>
  ),
};

export default async function OverviewPage() {
  // The ledger is the page; the market widgets ride along on the same render
  // and answer from cache, so a slow wire cannot slow the dashboard down.
  const [data, feed] = await Promise.all([getDashboard(), getMarketFeed()]);
  if (!data) return null;

  const active = data.investments.filter((i) => i.status === "active");
  const completed = data.investments.filter((i) => i.status === "completed");
  const firstName = data.profile.full_name.split(" ")[0];

  return (
    <div className="space-y-5 px-4 pt-3 pb-8">
      {marketFeedsEnabled ? <NewsWire initial={feed} /> : null}

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="micro-label">Long-term platform</p>
          <h2 className="mt-1 font-display text-[22px] leading-none font-bold text-white">
            Hi, {firstName}
          </h2>
        </div>
        <Pill tone="cyan">
          <span className="h-1.5 w-1.5 rounded-full bg-electric pulse-ring" />
          {data.wallet.active_investments} active
        </Pill>
      </div>

      <WalletCard
        balance={data.wallet.balance}
        earned={data.wallet.total_earned}
        invested={data.wallet.total_invested}
        pending={data.wallet.pending_withdrawals}
      />

      <div className="grid grid-cols-5 gap-1.5">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-electric/12 bg-navy-900/60 px-1 py-3 transition-colors hover:border-electric/35"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px] text-electric"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {icons[a.icon]}
            </svg>
            <span className="font-display text-[9px] font-bold tracking-[0.06em] text-mist uppercase">
              {a.label}
            </span>
          </Link>
        ))}
        {/* Fifth door: PWA install (see app/manifest.ts) */}
        <InstallAppTile />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total earned"
          value={ugx(data.wallet.total_earned)}
          sub="Across all cycles"
          accent="gold"
        />
        <StatCard
          label="Referral income"
          value={ugx(data.wallet.referral_earned)}
          sub="17% + 1% levels"
          accent="cyan"
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-[13px] font-bold tracking-[0.1em] text-white uppercase">
            Plans
          </h3>
          <Link
            href="/dashboard/plans"
            className="font-display text-[11px] font-semibold text-electric hover:underline"
          >
            All plans →
          </Link>
        </div>

        <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {plans.map((plan) => (
            <Link
              key={plan.slug}
              href={`/dashboard/plans#${plan.slug}`}
              className="qx-card w-[9.5rem] shrink-0 snap-start p-3"
            >
              <p className="font-display text-[11.5px] font-bold text-fog">{plan.name}</p>
              <p className="mt-1 font-display text-[15px] font-bold text-white">{ugx(plan.amount)}</p>
              <p className="mt-1 text-[10px] text-gold">+{ugx(plan.daily)} / day</p>
              <p className="text-[9.5px] text-slate-deep">{plan.days}-day cycle</p>
            </Link>
          ))}
        </div>
      </section>

      {marketFeedsEnabled ? <SignalBoard initial={feed} /> : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-[13px] font-bold tracking-[0.1em] text-white uppercase">
            Active cycles
          </h3>
          <Link
            href="/dashboard/plans"
            className="font-display text-[11px] font-semibold text-electric hover:underline"
          >
            Add →
          </Link>
        </div>

        {active.length ? (
          <div className="space-y-3">
            {active.map((inv) => {
              const maturesAt = inv.next_maturity_at ? new Date(inv.next_maturity_at).getTime() : 0;
              const waiting = maturesAt > Date.now();

              return (
                <div key={inv.id} className="space-y-2">
                  <InvestmentCard inv={inv} />
                  <ClaimButton
                    investmentId={inv.id}
                    label={`Credit day ${Math.min(inv.days_paid + 1, inv.duration_days)} · ${ugx(inv.daily_return)}`}
                  />
                  <p className="text-[10.5px] leading-relaxed text-slate-deep">
                    {waiting
                      ? `This credit matures at ${clockTime(inv.next_maturity_at)} (Kampala time) — every day's earning unlocks at ${earningsMatureAt}.`
                      : `Matured at ${clockTime(inv.next_maturity_at)} — credit it whenever you like.`}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No active cycles yet"
            body={`Activate one of the five VANTAFINTECH plans and the first daily earning matures that night at ${earningsMatureAt} (Kampala time).`}
            cta={
              <ButtonLink href="/dashboard/plans" variant="primary" size="sm">
                Choose a plan
              </ButtonLink>
            }
          />
        )}
      </section>

      <section className="qx-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[13px] font-bold tracking-[0.1em] text-white uppercase">
            Team
          </h3>
          <Pill tone="purple">{ugx(data.wallet.referral_earned)}</Pill>
        </div>
        <p className="mt-2 text-[11px] text-mist">
          Level 1 <span className="font-semibold text-fog">{data.referrals.level1_count}</span> ·
          Level 2 <span className="font-semibold text-fog">{data.referrals.level2_count}</span>
        </p>
        <p className="mt-2 truncate rounded-lg border border-electric/12 bg-navy-900/70 px-2.5 py-1.5 font-mono text-[10.5px] text-electric">
          {data.referrals.link}
        </p>
        <ButtonLink
          href="/dashboard/referrals"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
        >
          Share my link
        </ButtonLink>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-[13px] font-bold tracking-[0.1em] text-white uppercase">
            Activity
          </h3>
          <Link
            href="/dashboard/wallet?tab=history"
            className="font-display text-[11px] font-semibold text-electric hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="surface rounded-2xl px-3">
          {data.transactions.length ? (
            data.transactions.slice(0, 5).map((tx) => <TxRow key={tx.id} tx={tx} />)
          ) : (
            <p className="py-5 text-center text-[11.5px] text-slate-deep">
              Your ledger is empty — fund your wallet to get started.
            </p>
          )}
        </div>
      </section>

      {completed.length > 0 && (
        <section className="surface rounded-2xl p-4">
          <h3 className="font-display text-[13px] font-bold tracking-[0.1em] text-white uppercase">
            Completed
          </h3>
          <ul className="mt-2.5 space-y-2">
            {completed.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between text-[11.5px]">
                <span className="text-mist">
                  {inv.plan_name} · {ugx(inv.amount)}
                </span>
                <span className="font-display font-bold text-mint">
                  +{ugx(inv.total_return - inv.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}