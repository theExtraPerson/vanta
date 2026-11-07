import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { brand, referral } from "@/lib/brand";
import { plans } from "@/lib/plans";
import { ugx } from "@/lib/format";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description: "Terms, risk disclosure and privacy notes for the Vanta Fintech platform.",
};

const sections = [
  {
    id: "risk",
    title: "Risk disclosure",
    body: [
      "The return figures on this platform are fixed-cycle targets set by Vanta, not the result of audited market performance. They describe what the plan promises to pay on each day of its cycle, not what an investor can expect from any external market.",
      "Capital is at risk. Only commit money you can afford to lose entirely. Past payouts, testimonials and screenshots are not evidence of future performance.",
    ],
  },
  {
    id: "plans",
    title: "Plan terms",
    body: [
      `Vanta runs five plans: ${plans
        .map((p) => `${p.name} (${ugx(p.amount)} for ${p.days} days at ${ugx(p.daily)}/day)`)
        .join("; ")}.`,
      "A plan cannot be cancelled once its cycle begins. Daily earnings are credited to your wallet and are claimable as they fall due; capital is released with the final payout of the cycle.",
      "Vanta may suspend new activations at any time to reconcile its ledger.",
    ],
  },
  {
    id: "referral",
    title: "Referral programme",
    body: [
      `Commission of ${referral.levels[0].rate} is credited on the investment amount of first-level partners and ${referral.levels[1].rate} on second-level partners. Commission is one-time per investment and is paid from Vanta's own margin, not from the deposits of later participants.`,
      "Self-referral, duplicate accounts, incentivised sign-ups without genuine investment and any attempt to manipulate the referral tree will void commissions and may close the account.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    body: [
      "Vanta stores your name, phone number and username so it can operate your account, reconcile mobile money deposits and pay withdrawals. Data is held in a Postgres database with row-level security, meaning each account can only read its own records.",
      "We do not sell personal data. Deposit and withdrawal records are retained for the period required by Ugandan financial record-keeping rules.",
    ],
  },
  {
    id: "operations",
    title: "Account operations",
    body: [
      "Every balance in your wallet is the result of a ledger entry: a confirmed deposit, a plan earning, a referral commission, a capital release or a settled withdrawal. Deposits and withdrawals post as pending until the payout desk confirms them against mobile money.",
      "Support is handled on Telegram by " +
        brand.supportHandle +
        ". Never send money to anyone who is not the published collection number, and never share your password.",
    ],
  },
];

export default function LegalPage() {
  return (
    <PhoneShell top={<SiteHeader />}>
      <ScreenHeader
        back="/"
        title="Terms, risk and privacy"
        subtitle={`${brand.legalName} · last updated 6 November 2026`}
      />

      <div className="space-y-6 px-4 pt-2">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <h2 className="font-display text-[14px] font-bold tracking-[0.04em] text-electric uppercase">
              {s.title}
            </h2>
            <div className="mt-2 space-y-2.5">
              {s.body.map((p) => (
                <p key={p.slice(0, 40)} className="text-[12px] leading-relaxed text-mist">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-3.5">
          <p className="text-[11.5px] leading-relaxed text-gold-light">
            Questions about these terms? Message {brand.supportHandle} on Telegram or write to{" "}
            {brand.supportEmail}.
          </p>
        </div>

        <p className="pb-6 text-center text-[10px] text-slate-deep">
          © {new Date().getFullYear()} {brand.legalName} · {brand.domain}
        </p>
      </div>
    </PhoneShell>
  );
}