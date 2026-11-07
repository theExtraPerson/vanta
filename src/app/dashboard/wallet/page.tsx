import type { Metadata } from "next";
import Link from "next/link";
import { getDashboard } from "@/lib/data";
import { DepositForm, WithdrawForm } from "@/components/dashboard/forms";
import { TxRow } from "@/components/dashboard/widgets";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { ugx } from "@/lib/format";

export const metadata: Metadata = { title: "Wallet" };

const tabs = [
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "history", label: "History" },
] as const;

const channels = [
  {
    name: "MTN MoMo",
    detail: "0772 000 000 · Vanta Collections",
    note: "Use your username as the reason, then paste the SMS ID below.",
  },
  {
    name: "Airtel Money",
    detail: "0752 000 000 · Vanta Collections",
    note: "Same-day confirmation, 7 days a week.",
  },
  {
    name: "Bank transfer",
    detail: "Stanbic Bank · 9030012345678",
    note: "Bank deposits reconcile within one working day.",
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
                <h2 className="mb-3 font-display text-[13px] font-bold text-white">Deposit request</h2>
                <DepositForm />
              </section>

              <section className="surface rounded-2xl p-4">
                <h2 className="font-display text-[13px] font-bold text-white">Where to send it</h2>
                <ul className="mt-3 space-y-3">
                  {channels.map((c) => (
                    <li
                      key={c.name}
                      className="border-b border-white/8 pb-3 last:border-0 last:pb-0"
                    >
                      <p className="font-display text-[12px] font-bold text-gold">{c.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-fog">{c.detail}</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-deep">{c.note}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {view === "withdraw" && (
            <>
              <section className="surface rounded-2xl p-4">
                <h2 className="mb-3 font-display text-[13px] font-bold text-white">
                  Withdrawal request
                </h2>
                <WithdrawForm balance={data.wallet.balance} />
              </section>

              <section className="surface rounded-2xl p-4">
                <h2 className="font-display text-[13px] font-bold text-white">Settlement rules</h2>
                <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-mist">
                  <li>· Minimum withdrawal {ugx(20_000)}.</li>
                  <li>· Mobile money settles the same working day before 16:00 EAT.</li>
                  <li>· Funds are held from your balance while the payout is processing.</li>
                </ul>
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