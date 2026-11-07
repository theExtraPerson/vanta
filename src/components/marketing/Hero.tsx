import { VantaMark } from "@/components/brand/VantaMark";
import { ButtonLink, Pill } from "@/components/ui/primitives";
import { brand, stats } from "@/lib/brand";
import { plans } from "@/lib/plans";
import { ugx } from "@/lib/format";

function WalletPreview() {
  return (
    <div className="relative mx-auto mt-8 w-full">
      <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-royal/20 blur-[60px]" />

      <div className="absolute -top-4 right-1 z-20 flex items-center gap-2 rounded-xl border border-mint/25 bg-[#04140d]/92 px-2.5 py-1.5 shadow-xl backdrop-blur">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[8px] font-bold tracking-[0.16em] text-mint/80 uppercase">
            Daily earning
          </p>
          <p className="font-display text-[11px] font-bold text-mint">+ {ugx(20_000)}</p>
        </div>
      </div>

      <div className="qx-card relative z-10 p-4 shadow-[0_30px_90px_-46px_rgba(0,229,255,0.55)]">
        <div className="scan-line" />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <VantaMark className="h-7 w-auto" />
            <div className="leading-none">
              <p className="font-display text-[12px] font-bold text-steel-gradient">VANTA</p>
              <p className="mt-0.5 font-display text-[7px] font-bold tracking-[0.28em] text-gold-gradient">
                FINTECH
              </p>
            </div>
          </div>
          <span className="rounded-full border border-electric/25 bg-electric/8 px-2 py-0.5 font-display text-[8px] font-bold tracking-[0.12em] text-electric uppercase">
            Active plan
          </span>
        </div>

        <div className="mt-5">
          <p className="micro-label">Wallet balance</p>
          <p className="mt-1 font-display text-[30px] leading-none font-bold text-white">
            {ugx(412_000)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-electric/12 bg-navy-900/70 px-2.5 py-2">
            <p className="micro-label text-[8px]">Total earned</p>
            <p className="mt-0.5 font-display text-[12px] font-bold text-gold">{ugx(288_000)}</p>
          </div>
          <div className="rounded-lg border border-royal/20 bg-navy-900/70 px-2.5 py-2">
            <p className="micro-label text-[8px]">Referral</p>
            <p className="mt-0.5 font-display text-[12px] font-bold text-royal-light">
              {ugx(61_200)}
            </p>
          </div>
        </div>

        <svg viewBox="0 0 300 64" className="mt-3 h-12 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="64">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hero-line" x1="0" y1="0" x2="300" y2="0">
              <stop offset="0%" stopColor="#00E5FF" />
              <stop offset="100%" stopColor="#7C4DFF" />
            </linearGradient>
          </defs>
          <path
            d="M0 52 C 30 50, 44 40, 68 42 S 104 30, 128 33 S 168 20, 192 22 S 232 12, 256 10 S 286 6, 300 4 L300 64 L0 64 Z"
            fill="url(#hero-fill)"
          />
          <path
            d="M0 52 C 30 50, 44 40, 68 42 S 104 30, 128 33 S 168 20, 192 22 S 232 12, 256 10 S 286 6, 300 4"
            fill="none"
            stroke="url(#hero-line)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>

        <div className="mt-2 flex items-center justify-between border-t border-white/8 pt-2.5">
          <div>
            <p className="micro-label text-[8px]">Day</p>
            <p className="font-display text-[11px] font-bold text-white">3 / 5</p>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/8">
            <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-electric to-royal" />
          </div>
          <p className="font-display text-[11px] font-bold text-gold">+{ugx(20_000)}</p>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-2 z-20 rounded-xl border border-royal/30 bg-[#0d0a1c]/92 px-3 py-2 shadow-xl backdrop-blur">
        <p className="font-display text-[8px] font-bold tracking-[0.16em] text-royal-light/80 uppercase">
          Referral · 1st level
        </p>
        <p className="font-display text-[15px] leading-tight font-bold text-royal-light">17%</p>
      </div>
    </div>
  );
}

const trustBadges = [
  { label: "SSL Secured", color: "text-mint", ring: "border-mint/25 bg-mint/10" },
  { label: "256-bit Encrypted", color: "text-electric", ring: "border-electric/20 bg-electric/8" },
  { label: "Safe & Private", color: "text-royal-light", ring: "border-royal/25 bg-royal/10" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-6 pb-12">
      <div className="absolute inset-0 mesh-hero" />
      <div className="absolute inset-0 grid-lines" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-electric/8 blur-[110px]" />

      <div className="relative rise">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-electric pulse-ring" />
            {brand.tagline}
          </Pill>
          <Pill tone="muted">{brand.platformLabel}</Pill>
        </div>

        <h1 className="mt-4 text-[2.05rem] leading-[1.06] font-bold text-white">
          Invest smartly.
          <br />
          Earn consistently.
          <br />
          <span className="text-qx-gradient">Grow your wealth.</span>
        </h1>

        <p className="mt-3 text-[12.5px] leading-relaxed text-mist">
          Five long-term plans from {ugx(plans[0].amount)} to {ugx(plans[4].amount)}. The daily
          earning and the maturity payout are written down before you commit a shilling.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <ButtonLink href="/register" variant="primary" size="md" className="w-full">
            Start with {ugx(plans[0].amount)}
          </ButtonLink>
          <ButtonLink href="/#plans" variant="outline" size="md" className="w-full">
            See the five plans
          </ButtonLink>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {trustBadges.map((b) => (
            <span
              key={b.label}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] font-display text-[8.5px] font-bold tracking-[0.1em] uppercase ${b.ring} ${b.color}`}
            >
              <svg width="6" height="6" viewBox="0 0 8 8" aria-hidden="true">
                <circle cx="4" cy="4" r="3.2" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
              {b.label}
            </span>
          ))}
        </div>

        <WalletPreview />

        <dl className="mt-9 grid grid-cols-2 gap-x-4 gap-y-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <p className="font-display text-[16px] font-bold text-white">{s.value}</p>
                <p className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-deep">
                  {s.label}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}