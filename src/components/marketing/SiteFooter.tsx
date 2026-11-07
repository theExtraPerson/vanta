import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand, referral } from "@/lib/brand";
import { plans } from "@/lib/plans";
import { ugx } from "@/lib/format";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-electric/10 bg-navy-950 px-4 pt-8 pb-6">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[34rem] -translate-x-1/2 rounded-full bg-royal/16 blur-[110px]" />

      <div className="relative">
        <Logo size="md" showTagline />

        <p className="mt-3 text-[11.5px] leading-relaxed text-mist">
          {brand.name} runs five long-term plans for the Ugandan market, crediting daily earnings
          straight to your wallet, with a two-level referral programme paying{" "}
          {referral.levels[0].headline} and {referral.levels[1].headline}.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {["MTN MoMo", "Airtel Money", "Bank transfer"].map((m) => (
            <span
              key={m}
              className="rounded-md border border-electric/15 bg-white/[0.03] px-2 py-1 font-display text-[9px] font-bold tracking-[0.12em] text-mist uppercase"
            >
              {m}
            </span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          <div>
            <h3 className="font-display text-[9px] font-bold tracking-[0.24em] text-electric uppercase">
              Plans
            </h3>
            <ul className="mt-2 space-y-1.5">
              {plans.map((p) => (
                <li key={p.slug}>
                  <Link
                    href="/#plans"
                    className="text-[11px] text-mist transition-colors hover:text-fog"
                  >
                    {p.name} · {ugx(p.amount)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="font-display text-[9px] font-bold tracking-[0.24em] text-electric uppercase">
                Platform
              </h3>
              <ul className="mt-2 space-y-1.5">
                {[
                  { label: "How it works", href: "/#how-it-works" },
                  { label: "Referral programme", href: "/#referrals" },
                  { label: "FAQ", href: "/#faq" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[11px] text-mist transition-colors hover:text-fog"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display text-[9px] font-bold tracking-[0.24em] text-electric uppercase">
                Account
              </h3>
              <ul className="mt-2 space-y-1.5">
                {[
                  { label: "Create an account", href: "/register" },
                  { label: "Sign in", href: "/login" },
                  { label: "Risk disclosure", href: "/legal" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[11px] text-mist transition-colors hover:text-fog"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-electric/10 pt-4">
          <p className="text-[10px] leading-relaxed text-slate-deep">
            <strong className="text-mist">Risk disclosure.</strong> Returns shown here are
            fixed-cycle targets, not guaranteed performance. Capital is at risk. Nothing on this site
            is financial advice. {brand.legalName} · {brand.address}. Invest only what you can afford
            to lose.
          </p>

          <p className="mt-3 text-[10px] text-slate-deep">
            Customer service {brand.supportHandle} · {brand.domain}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-deep">
            <p>
              © {new Date().getFullYear()} {brand.legalName}
            </p>
            <div className="flex items-center gap-3">
              <Link href="/legal" className="transition-colors hover:text-white">
                Terms
              </Link>
              <Link href="/legal#privacy" className="transition-colors hover:text-white">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}