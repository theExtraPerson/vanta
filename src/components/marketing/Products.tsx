import { ButtonLink, Pill } from "@/components/ui/primitives";
import { VantaMark } from "@/components/brand/VantaMark";
import { featuredPlan, plans } from "@/lib/plans";
import { brand } from "@/lib/brand";
import { ugx } from "@/lib/format";

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.16" />
      <path
        d="M4.6 8.3l2.2 2.2 4.4-4.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProductCards() {
  return (
    <section id="plans" className="relative scroll-mt-20 px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric/40 to-transparent" />

      <p className="micro-label">Long-term plans</p>
      <h2 className="mt-1.5 font-display text-[24px] leading-tight font-bold text-white">
        Five plans. One <span className="text-qx-gradient">written promise</span> each.
      </h2>
      <p className="mt-2 text-[12px] leading-relaxed text-mist">
        Every plan states its price, daily earning and maturity payout before you activate it. No
        variable rates, no surprise deductions.
      </p>

      <div className="mt-5 space-y-3">
        {plans.map((plan, i) => {
          const featured = plan.slug === featuredPlan.slug;
          return (
            <article
              key={plan.slug}
              className={`relative overflow-hidden rounded-2xl p-4 ${
                featured
                  ? "border border-electric/40 bg-navy-800 shadow-[0_24px_60px_-34px_rgba(0,229,255,0.6)]"
                  : "surface rounded-2xl"
              }`}
            >
              {featured && <div className="scan-line" />}

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="micro-label">Plan {String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 font-display text-[16px] font-bold text-white">{plan.name}</h3>
                </div>
                {plan.badge && <Pill tone={featured ? "cyan" : "muted"}>{plan.badge}</Pill>}
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="font-display text-[26px] leading-none font-bold text-white">
                  {ugx(plan.amount)}
                </p>
                <p className="rounded-lg border border-gold/25 bg-gold/8 px-2 py-1 font-display text-[11px] font-bold text-gold">
                  +{ugx(plan.daily)} / day
                </p>
              </div>

              <dl className="mt-3 space-y-1.5 border-t border-white/8 pt-3 text-[11.5px]">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-deep">Duration</dt>
                  <dd className="font-semibold text-fog">{plan.days} days</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-deep">Total earnings</dt>
                  <dd className="font-semibold text-fog">{ugx(plan.totalEarnings)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-deep">After {plan.days} days</dt>
                  <dd className="font-display font-bold text-mint">{ugx(plan.totalReturn)}</dd>
                </div>
              </dl>

              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/8 pt-3">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-1.5 text-[10.5px] text-mist">
                    <Check className="h-3 w-3 shrink-0 text-electric" />
                    {perk}
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={`/register?plan=${plan.slug}`}
                variant={featured ? "primary" : "outline"}
                size="sm"
                className="mt-3.5 w-full"
              >
                Start {plan.name}
              </ButtonLink>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ProductsTable() {
  return (
    <section className="relative px-4 py-6">
      <div className="qx-card shadow-[0_40px_110px_-60px_rgba(0,229,255,0.55)]">
        <div className="relative overflow-hidden border-b border-electric/15 bg-[radial-gradient(120%_140%_at_50%_0%,rgba(0,229,255,0.14),rgba(9,18,32,0.9))] px-4 py-5 text-center">
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />
          <div className="relative flex flex-col items-center gap-2">
            <div className="flex items-center gap-2.5">
              <VantaMark className="h-8 w-auto" />
              <div className="text-left leading-none">
                <p className="font-display text-[17px] font-bold tracking-tight text-steel-gradient">
                  VANTA
                </p>
                <p className="mt-0.5 font-display text-[8.5px] font-bold tracking-[0.3em] text-gold-gradient">
                  FINTECH
                </p>
              </div>
            </div>
            <h2 className="font-display text-[19px] font-bold tracking-tight text-white">
              Plan matrix
            </h2>
            <p className="font-display text-[9px] font-bold tracking-[0.28em] text-electric uppercase">
              {brand.tagline} · {brand.platformLabel}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-white/[0.06]">
          {plans.map((plan) => (
            <li key={plan.slug} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-[13px] font-bold text-white">{plan.name}</p>
                <p className="font-display text-[13px] font-bold text-white">{ugx(plan.amount)}</p>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <div>
                  <p className="text-[8px] font-bold tracking-[0.12em] text-slate-deep uppercase">
                    Daily
                  </p>
                  <p className="font-display text-[11.5px] font-bold text-gold">{ugx(plan.daily)}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold tracking-[0.12em] text-slate-deep uppercase">
                    Days
                  </p>
                  <p className="text-[11.5px] font-semibold text-fog">{plan.days}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold tracking-[0.12em] text-slate-deep uppercase">
                    After {plan.days}d
                  </p>
                  <p className="font-display text-[11.5px] font-bold text-mint">
                    {ugx(plan.totalReturn)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2.5 border-t border-electric/15 px-4 py-4 text-center">
          <p className="text-[10.5px] leading-relaxed text-slate-deep">
            Figures are fixed per plan and shown in Ugandan Shillings. Capital returns with the
            maturity payout.
          </p>
          <ButtonLink href="/register" variant="primary" size="sm" className="w-full">
            Join VANTAFINTECH today
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function Ticker() {
  const items = [
    ...plans.map((p) => `${p.name} · ${ugx(p.amount)} → ${ugx(p.daily)}/day · ${p.days} days`),
    "17% first level referral",
    "1% second level referral",
    "Mobile money payouts",
    brand.tagline,
  ];

  return (
    <div className="relative overflow-hidden border-y border-electric/12 bg-navy-900/70 py-2.5">
      <div className="flex w-max ticker-track">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
            {items.map((item) => (
              <span
                key={`${dup}-${item}`}
                className="flex items-center gap-2.5 px-4 font-display text-[9.5px] font-bold tracking-[0.16em] text-mist/70 uppercase"
              >
                <span className="h-1 w-1 rounded-full bg-electric" />
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}