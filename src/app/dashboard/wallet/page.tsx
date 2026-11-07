import type { Metadata } from "next";
import Link from "next/link";
import { getDashboard } from "@/lib/data";
import {
  DepositForm,
  ReconcileButton,
  WithdrawForm,
} from "@/components/dashboard/forms";
import { TxRow } from "@/components/dashboard/widgets";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { ugx } from "@/lib/format";
import {
  earningsMatureAt,
  minDeposit,
  minWithdrawal,
  withdrawalClosesAt,
  withdrawalOpensAt,
} from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Wallet" };

const tabs = [
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "history", label: "History" },
] as const;

/** How a top-up actually moves, now that the provider pushes the prompt. */
const collectSteps = [
  {
    title: "Choose an amount",
    detail: `From ${ugx(minDeposit)} · MTN MoMo and Airtel Money.`,
  },
  {
    title: "Approve the prompt",
    detail: "A mobile money PIN request appears on your phone within seconds.",
  },
  {
    title: "Wallet credits itself",
    detail: "The provider confirms the payment and your balance updates automatically.",
  },
];

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const data = await getDashboard();
  if (!data) return null;

  const { tab } = await searchParams;
  const view = tab === "withdraw" ? "withdraw" : tab === "history" ? "history" : "deposit";

  const rules = data.payments?.rules;
  const withdrawalsOpen = rules?.withdrawals_open ?? true;
  const openDeposits = data.payments?.awaiting_deposit ?? [];
  const openPayouts = data.payments?.awaiting_payout ?? [];

  const payouts = data.transactions.filter(
    (t) => t.type === "withdrawal" || t.type === "capital_return" || t.type === "deposit",
  );

  return (
    <div className="pb-8">
      <ScreenHeader back={null} title="Wallet" subtitle="Fund, withdraw and audit your balance." />

      <div className="px-4">
        <div className="qx-card p-4">
          <div className="scan-line" />
          <p className="micro-label">Available balance</p>
          <p className="mt-1 font-display text-[30px] leading-none font-bold text-white">
            {ugx(data.wallet.balance)}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-electric/12 pt-3">
            <div>
              <p className="text-[8.5px] font-bold tracking-[0.14em] text-slate-deep uppercase">
                Earned
              </p>
              <p className="mt-0.5 font-display text-[12px] font-bold text-gold">
                {ugx(data.wallet.total_earned)}
              </p>
            </div>
            <div>
              <p className="text-[8.5px] font-bold tracking-[0.14em] text-slate-deep uppercase">
                Invested
              </p>
              <p className="mt-0.5 font-display text-[12px] font-bold text-white">
                {ugx(data.wallet.total_invested)}
              </p>
            </div>
            <div>
              <p className="text-[8.5px] font-bold tracking-[0.14em] text-slate-deep uppercase">
                In transit
              </p>
              <p className="mt-0.5 font-display text-[12px] font-bold text-royal-light">
                {ugx(data.wallet.pending_withdrawals)}
              </p>
            </div>
          </div>
        </div>

        {(openDeposits.length > 0 || openPayouts.length > 0) && (
          <section className="mt-4 rounded-2xl border border-gold/22 bg-gold/6 p-4">
            <p className="micro-label">Waiting on the network</p>
            <ul className="mt-2 space-y-1.5 text-[11.5px] text-fog">
              {openDeposits.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    Top-up {d.status === "awaiting_pin" ? "awaiting your PIN" : "submitted"} ·{" "}
                    <span className="font-mono text-[10.5px] text-slate-deep">{d.reference}</span>
                  </span>
                  <span className="font-display font-bold text-gold">+{ugx(d.amount)}</span>
                </li>
              ))}
              {openPayouts.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    Payout sending to {w.msisdn ?? "your number"} ·{" "}
                    <span className="font-mono text-[10.5px] text-slate-deep">{w.reference}</span>
                  </span>
                  <span className="font-display font-bold text-royal-light">{ugx(w.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <ReconcileButton />
            </div>
          </section>
        )}

        <nav className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-electric/12 bg-navy-900/60 p-1">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard/wallet?tab=${t.key}`}
              aria-current={view === t.key ? "page" : undefined}
              className={`rounded-lg py-2 text-center font-display text-[10.5px] font-bold tracking-[0.12em] uppercase transition-colors ${
                view === t.key
                  ? "border border-electric/30 bg-electric/12 text-electric"
                  : "border border-transparent text-mist hover:text-fog"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 space-y-4">
          {view === "deposit" && (
            <>
              <section className="surface rounded-2xl p-4">
                <h2 className="mb-3 font-display text-[13px] font-bold text-white">
                  Mobile money top-up
                </h2>
                <DepositForm defaultPhone={data.profile.phone} />
              </section>

              <section className="surface rounded-2xl p-4">
                <h2 className="font-display text-[13px] font-bold text-white">How it moves</h2>
                <ol className="mt-3 space-y-3">
                  {collectSteps.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-electric/25 bg-electric/8 font-display text-[10px] font-bold text-electric">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-display text-[12px] font-bold text-gold">{step.title}</p>
                        <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-deep">
                          {step.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {openDeposits.length > 0 && (
                  <div className="mt-3 border-t border-electric/12 pt-3">
                    <ReconcileButton />
                  </div>
                )}
              </section>
            </>
          )}

          {view === "withdraw" && (
            <>
              <section className="surface rounded-2xl p-4">
                <h2 className="mb-3 font-display text-[13px] font-bold text-white">
                  Mobile money payout
                </h2>
                <WithdrawForm
                  balance={data.wallet.balance}
                  defaultPhone={data.profile.phone}
                  open={withdrawalsOpen}
                />
              </section>

              <section className="surface rounded-2xl p-4">
                <h2 className="font-display text-[13px] font-bold text-white">Settlement rules</h2>
                <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-mist">
                  <li>· Minimum withdrawal {ugx(minWithdrawal)}, whole shillings only.</li>
                  <li>
                    ·{" "}
                    {withdrawalRuleLine(withdrawalsOpen, rules)}
                  </li>
                  <li>
                    · Daily earnings mature at {earningsMatureAt} EAT, so today's credit unlocks
                    after that.
                  </li>
                  <li>
                    · Airtel settles on the spot; MTN confirms seconds later. A declined payout is
                    returned to your balance immediately.
                  </li>
                </ul>
                {openPayouts.length > 0 && (
                  <div className="mt-3 border-t border-electric/12 pt-3">
                    <ReconcileButton />
                  </div>
                )}
              </section>
            </>
          )}

          {view === "history" && (
            <section className="surface rounded-2xl px-3 py-1">
              {payouts.length ? (
                payouts.slice(0, 20).map((tx) => <TxRow key={tx.id} tx={tx} />)
              ) : (
                <p className="py-8 text-center text-[11.5px] text-slate-deep">
                  No wallet movements yet.
                </p>
              )}
            </section>
          )}

          {view === "history" && (
            <Link
              href="/dashboard/transactions"
              className="block text-center font-display text-[11px] font-semibold text-electric hover:underline"
            >
              Open the full ledger →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** States the live window when the database published it, the schedule otherwise. */
function withdrawalRuleLine(
  open: boolean,
  rules?: { withdrawal_opens_at: string; withdrawal_closes_at: string },
) {
  const window = rules
    ? `${rules.withdrawal_opens_at} – ${rules.withdrawal_closes_at} EAT`
    : `${withdrawalOpensAt} – ${withdrawalClosesAt} EAT`;

  return `Withdrawals open ${window} (Kampala time) — ${open ? "open now" : "closed right now"}.`;
}