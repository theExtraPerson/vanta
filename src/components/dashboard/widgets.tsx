import { Pill } from "@/components/ui/primitives";
import { shortDate, ugx } from "@/lib/format";
import type { InvestmentRow, TransactionRow, TxType } from "@/lib/types";
import Link from "next/link";

const txMeta: Record<
  TxType,
  { label: string; tone: "gold" | "cyan" | "purple" | "green" | "red" | "muted"; sign: string }
> = {
  deposit: { label: "Deposit", tone: "green", sign: "+" },
  earning: { label: "Daily earning", tone: "gold", sign: "+" },
  referral: { label: "Referral bonus", tone: "purple", sign: "+" },
  withdrawal: { label: "Withdrawal", tone: "red", sign: "−" },
  investment: { label: "Investment", tone: "muted", sign: "−" },
  capital_return: { label: "Capital return", tone: "green", sign: "+" },
  adjustment_credit: { label: "Wallet correction", tone: "gold", sign: "+" },
  adjustment_debit: { label: "Wallet correction", tone: "red", sign: "−" },
};

export function StatCard({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "gold" | "cyan" | "green";
}) {
  const styles = {
    default: "surface",
    gold: "surface-gold",
    cyan: "border border-electric/25 bg-gradient-to-b from-electric/10 to-transparent",
    green: "border border-mint/22 bg-gradient-to-b from-mint/8 to-transparent",
  } as const;

  const valueStyles = {
    default: "text-white",
    gold: "text-gold",
    cyan: "text-electric",
    green: "text-mint",
  } as const;

  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${styles[accent]}`}>
      <p className="font-display text-[9px] font-bold tracking-[0.2em] text-slate-deep uppercase">
        {label}
      </p>
      <p className={`mt-2 font-display text-xl font-bold sm:text-[1.4rem] ${valueStyles[accent]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-slate-deep">{sub}</p>}
    </div>
  );
}

export function WalletCard({
  balance,
  earned,
  invested,
  pending,
}: {
  balance: number;
  earned: number;
  invested: number;
  pending: number;
}) {
  return (
    <div className="qx-card relative bg-[linear-gradient(140deg,#0d2240_0%,#0b1730_55%,#0a0d20_100%)] p-6 sm:p-7">
      <div className="scan-line" />
      <div className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full bg-royal/22 blur-[80px]" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="micro-label">Available wallet balance</p>
            <p className="mt-2 font-display text-[2.3rem] leading-none font-bold text-white sm:text-[2.7rem]">
              {ugx(balance)}
            </p>
          </div>
          <Pill tone="cyan">UGX</Pill>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-electric/12 pt-5">
          <div>
            <p className="font-display text-[8.5px] font-bold tracking-[0.16em] text-slate-deep uppercase">
              Earned
            </p>
            <p className="mt-1 font-display text-[13.5px] font-bold text-gold">{ugx(earned)}</p>
          </div>
          <div>
            <p className="font-display text-[8.5px] font-bold tracking-[0.16em] text-slate-deep uppercase">
              Invested
            </p>
            <p className="mt-1 font-display text-[13.5px] font-bold text-white">{ugx(invested)}</p>
          </div>
          <div>
            <p className="font-display text-[8.5px] font-bold tracking-[0.16em] text-slate-deep uppercase">
              In transit
            </p>
            <p className="mt-1 font-display text-[13.5px] font-bold text-royal-light">{ugx(pending)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href="/dashboard/deposit"
            className="btn btn-primary inline-flex h-9 items-center px-4 text-[10.5px]"
          >
            Add funds
          </Link>
          <Link
            href="/dashboard/withdraw"
            className="btn btn-outline inline-flex h-9 items-center px-4 text-[10.5px]"
          >
            Withdraw
          </Link>
          <Link
            href="/dashboard/plans"
            className="btn btn-outline inline-flex h-9 items-center px-4 text-[10.5px]"
          >
            Activate product
          </Link>
        </div>
      </div>
    </div>
  );
}

export function InvestmentCard({ inv }: { inv: InvestmentRow }) {
  const progress = Math.round((inv.days_paid / inv.duration_days) * 100);

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[14.5px] font-bold text-white">{inv.plan_name}</p>
          <p className="mt-0.5 text-[11px] text-slate-deep">
            {ugx(inv.amount)} · {inv.duration_days} days · from {shortDate(inv.started_at)}
          </p>
        </div>
        <Pill tone={inv.status === "active" ? "green" : "muted"}>
          {inv.status === "active" ? "Active" : "Completed"}
        </Pill>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-deep">
          <span>
            Day {Math.min(inv.days_paid, inv.duration_days)} of {inv.duration_days}
          </span>
          <span className="text-gold">
            {ugx(inv.earned)} / {ugx(inv.total_return - inv.amount)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-electric to-royal transition-[width] duration-500"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-[11px]">
        <div>
          <dt className="text-slate-deep">Daily</dt>
          <dd className="mt-0.5 font-display font-bold text-gold">{ugx(inv.daily_return)}</dd>
        </div>
        <div>
          <dt className="text-slate-deep">Days paid</dt>
          <dd className="mt-0.5 font-display font-bold text-white">{inv.days_paid}</dd>
        </div>
        <div>
          <dt className="text-slate-deep">Returns at end</dt>
          <dd className="mt-0.5 font-display font-bold text-mint">{ugx(inv.total_return)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function TxRow({ tx }: { tx: TransactionRow }) {
  const meta = txMeta[tx.type];
  const positive = meta.sign === "+";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-1 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold ${
            positive ? "bg-mint/10 text-mint" : "bg-white/[0.05] text-mist"
          }`}
        >
          {meta.sign}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold text-fog">{meta.label}</p>
          <p className="truncate text-[10.5px] text-slate-deep">
            {tx.note ?? tx.reference} · {shortDate(tx.created_at)}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`font-display text-[12.5px] font-bold ${
            positive ? "text-mint" : "text-fog"
          }`}
        >
          {meta.sign} {ugx(tx.amount)}
        </p>
        <p className="text-[10px] text-slate-deep capitalize">{tx.status}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="surface flex flex-col items-center rounded-2xl px-6 py-10 text-center">
      <p className="font-display text-[14.5px] font-bold text-white">{title}</p>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-mist">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
