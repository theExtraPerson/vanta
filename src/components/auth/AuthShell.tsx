import Link from "next/link";
import { VantaMark } from "@/components/brand/VantaMark";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { brand, referral } from "@/lib/brand";
import { plans } from "@/lib/plans";
import { ugx } from "@/lib/format";

const badges = [
  { label: "SSL Secured", cls: "border-mint/25 bg-mint/10 text-mint" },
  { label: "256-bit Encrypted", cls: "border-electric/20 bg-electric/8 text-electric" },
  { label: "Safe & Private", cls: "border-royal/25 bg-royal/10 text-royal-light" },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <PhoneShell>
      <div className="flex min-h-full flex-col px-4 pt-9 pb-7">
        {/* shield seal — the gate motif from the reference app */}
        <div className="ring-expand pulse-ring mx-auto mb-4 flex h-[62px] w-[62px] items-center justify-center rounded-full border border-electric/20 bg-electric/[0.07] text-electric">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l7 3v5.5c0 4.4-3 7.6-7 9.5-4-1.9-7-5.1-7-9.5V6z" />
            <path d="M9.2 12.2l2 2 3.6-3.9" />
          </svg>
        </div>

        <Link href="/" className="mx-auto flex items-center gap-2">
          <VantaMark className="h-6 w-auto" />
          <span className="font-display text-[17px] leading-none font-bold tracking-tight">
            <span className="text-steel-gradient">VANTA</span>{" "}
            <span className="text-gold-gradient">FINTECH</span>
          </span>
        </Link>
        <p className="mt-1.5 text-center font-display text-[9px] font-bold tracking-[0.32em] text-slate-deep uppercase">
          {brand.tagline} · {brand.platformLabel}
        </p>

        <div className="qx-card mt-5 shadow-[0_30px_90px_-45px_rgba(0,229,255,0.55)]">
          <div className="scan-line" />
          <div className="px-4 pt-6 pb-5">
            <h1 className="text-center font-display text-[20px] leading-tight font-bold text-white">
              {title}
            </h1>
            <p className="mt-1.5 text-center text-[11.5px] leading-relaxed text-mist">{subtitle}</p>

            <div className="mt-4 mb-5 flex flex-wrap justify-center gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-display text-[8.5px] font-bold tracking-[0.1em] uppercase ${b.cls}`}
                >
                  <svg width="6" height="6" viewBox="0 0 8 8" aria-hidden="true">
                    <circle cx="4" cy="4" r="3.2" fill="none" stroke="currentColor" strokeWidth="1" />
                  </svg>
                  {b.label}
                </span>
              ))}
            </div>

            {children}

            <div className="mt-6 border-t border-electric/10 pt-4 text-center text-[11.5px] text-mist">
              {footer}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5 font-display text-[8.5px] font-bold tracking-[0.12em] text-slate-deep uppercase">
          <span>{plans.length} plans</span>
          <span className="text-electric/40">·</span>
          <span>From {ugx(plans[0].amount)}</span>
          <span className="text-electric/40">·</span>
          <span>
            Referral {referral.levels[0].headline} + {referral.levels[1].headline}
          </span>
        </div>

        <Link
          href="/"
          className="mt-auto pt-6 text-center text-[11px] text-slate-deep transition-colors hover:text-fog"
        >
          ← Back to {brand.domain}
        </Link>
      </div>
    </PhoneShell>
  );
}