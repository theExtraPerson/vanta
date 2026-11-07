import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VantaMark } from "@/components/brand/VantaMark";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { ButtonLink, Pill } from "@/components/ui/primitives";
import { ugx } from "@/lib/format";
import { brand } from "@/lib/brand";
import {
  earningsMatureAt,
  minDeposit,
  minWithdrawal,
  parseReferralCode,
  withdrawalClosesAt,
  withdrawalOpensAt,
} from "@/lib/supabase/config";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Welcome",
  description: "You are invited to Vanta Fintech. Create your account to start earning daily.",
};

/**
 * Invite landing: the single screen a person sees before registering.
 * It carries no marketing content — a welcome, the invite code (when the link
 * had one), the three rules that matter, and the route into sign-up.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; ref?: string }>;
}) {
  const { code, ref } = await searchParams;
  const inviteCode = parseReferralCode(code ?? ref ?? "");

  // Already registered? Straight into the app.
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const registerHref = inviteCode ? `/register?code=${inviteCode}` : "/register";

  const rules = [
    { label: "Top-up from", value: `${ugx(minDeposit)}` },
    { label: "Withdraw from", value: `${ugx(minWithdrawal)}` },
    { label: "Withdrawal hours", value: `${withdrawalOpensAt} – ${withdrawalClosesAt} EAT` },
    { label: "Daily earnings mature", value: `every day at ${earningsMatureAt} EAT` },
  ];

  return (
    <PhoneShell>
      <main className="flex min-h-full flex-col justify-center px-6 py-10">
        <div className="rise">
          <div className="flex flex-col items-center text-center">
            <VantaMark className="h-14 w-auto" />
            <p className="mt-3 font-display text-[10px] font-bold tracking-[0.34em] text-gold-gradient uppercase">
              {brand.shortName} {brand.tagline}
            </p>

            <Pill tone="cyan" className="mt-5">
              <span className="h-1.5 w-1.5 rounded-full bg-electric pulse-ring" />
              By invitation
            </Pill>

            <h1 className="mt-4 text-center text-[27px] leading-[1.12] font-bold text-white">
              Welcome to
              <br />
              <span className="text-qx-gradient">Vanta Fintech</span>
            </h1>

            <p className="mt-3 text-center text-[12.5px] leading-relaxed text-mist">
              Someone you know has opened the door for you. Create your account, fund your wallet
              with mobile money and your first daily earning starts the same evening.
            </p>

            {inviteCode ? (
              <div className="mt-5 w-full rounded-2xl border border-gold/22 bg-gold/6 px-4 py-3 text-center">
                <p className="micro-label">Your invite code is ready</p>
                <p className="mt-1 font-mono text-[15px] font-bold tracking-[0.18em] text-gold">
                  {inviteCode}
                </p>
                <p className="mt-1 text-[10.5px] text-slate-deep">
                  It is filled in for you — nothing to type.
                </p>
              </div>
            ) : (
              <div className="mt-5 w-full rounded-2xl border border-electric/16 bg-navy-900/60 px-4 py-3 text-center">
                <p className="micro-label">Registration is open</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-mist">
                  Name, mobile number, username and password. Your wallet is created instantly.
                </p>
              </div>
            )}
          </div>

          <dl className="mt-6 divide-y divide-white/6 rounded-2xl border border-electric/12 bg-navy-900/45 px-4">
            {rules.map((rule) => (
              <div key={rule.label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[10.5px] text-slate-deep">{rule.label}</dt>
                <dd className="font-display text-[11.5px] font-bold text-fog">{rule.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-col gap-2">
            <ButtonLink href={registerHref} variant="primary" size="md" className="w-full">
              Create my account
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="md" className="w-full">
              I already have an account
            </ButtonLink>
          </div>

          <p className="mt-5 text-center text-[10.5px] leading-relaxed text-slate-deep">
            Support · {brand.supportEmail}
            <br />
            {brand.legalName}, {brand.address}
          </p>
        </div>
      </main>
    </PhoneShell>
  );
}
