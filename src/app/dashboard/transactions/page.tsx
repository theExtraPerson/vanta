import type { Metadata } from "next";
import { getDashboard } from "@/lib/data";
import { TxRow } from "@/components/dashboard/widgets";
import { ScreenHeader } from "@/components/shell/ScreenHeader";
import { Pill } from "@/components/ui/primitives";
import { brand } from "@/lib/brand";
import { ugx } from "@/lib/format";
import type { TxType } from "@/lib/types";

export const metadata: Metadata = { title: "Transactions" };

const groups: { key: TxType; label: string }[] = [
  { key: "earning", label: "Daily earnings" },
  { key: "referral", label: "Referral commission" },
  { key: "deposit", label: "Deposits" },
  { key: "investment", label: "Plan activations" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "capital_return", label: "Capital returns" },
];

export default async function TransactionsPage() {
  const data = await getDashboard();
  if (!data) return null;

  const completed = data.transactions.filter((t) => t.status === "completed");
  const pending = data.transactions.filter((t) => t.status === "pending");

  const inflow = completed
    .filter((t) => ["earning", "referral", "deposit", "capital_return"].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  const outflow = completed
    .filter((t) => ["withdrawal", "investment"].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="pb-8">
      <ScreenHeader
        back="/dashboard/wallet?tab=history"
        title="Ledger"
        subtitle="Every credit and debit written against your wallet, newest first."
      />

      <div className="space-y-4 px-4 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-mint/22 bg-mint/8 p-3.5">
            <p className="text-[8.5px] font-bold tracking-[0.14em] text-mint/70 uppercase">Inflow</p>
            <p className="mt-1 font-display text-[15px] font-bold text-mint">{ugx(inflow)}</p>
          </div>
          <div className="rounded-2xl border border-[#ff7070]/25 bg-[#ff7070]/8 p-3.5">
            <p className="text-[8.5px] font-bold tracking-[0.14em] text-[#ff8f8f]/70 uppercase">
              Outflow
            </p>
            <p className="mt-1 font-display text-[15px] font-bold text-[#ff8f8f]">{ugx(outflow)}</p>
          </div>
        </div>

        {pending.length > 0 && (
          <section className="surface rounded-2xl px-3 py-1">
            <div className="flex items-center gap-2 px-1 pt-2.5 pb-1">
              <h2 className="font-display text-[12px] font-bold tracking-[0.1em] text-white uppercase">
                Awaiting confirmation
              </h2>
              <Pill tone="gold">{pending.length}</Pill>
            </div>
            {pending.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </section>
        )}

        <section className="surface rounded-2xl px-3 py-1">
          <h2 className="px-1 pt-2.5 pb-1 font-display text-[12px] font-bold tracking-[0.1em] text-white uppercase">
            All movements
          </h2>
          {data.transactions.length ? (
            data.transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
          ) : (
            <p className="py-8 text-center text-[11.5px] text-slate-deep">
              Nothing has moved through your wallet yet.
            </p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2.5">
          {groups.map((g) => {
            const rows = data.transactions.filter((t) => t.type === g.key);
            const total = rows.reduce((s, t) => s + t.amount, 0);
            return (
              <div
                key={g.key}
                className="rounded-xl border border-electric/10 bg-navy-900/60 p-3"
              >
                <p className="font-display text-[8.5px] font-bold tracking-[0.14em] text-slate-deep uppercase">
                  {g.label}
                </p>
                <p className="mt-1 font-display text-[13px] font-bold text-white">{ugx(total)}</p>
                <p className="mt-0.5 text-[10px] text-slate-deep">{rows.length} entries</p>
              </div>
            );
          })}
        </section>

        <p className="text-[10.5px] leading-relaxed text-slate-deep">
          Need a statement? Message {brand.supportHandle} on Telegram or email {brand.supportEmail}{" "}
          with your username and date range.
        </p>
      </div>
    </div>
  );
}