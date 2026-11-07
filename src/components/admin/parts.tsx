"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Alert } from "@/components/ui/Field";
import type { ActionState } from "@/lib/actions";

/**
 * Presentational primitives shared by every admin section, styled with the
 * same navy/cyan/gold language as the investor app so the desk feels like part
 * of Vanta rather than a bolted-on back office.
 */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-display text-[10px] font-bold tracking-[0.22em] text-slate-deep uppercase">
      {children}
    </p>
  );
}

export function StatTile({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: string;
  tone?: "default" | "gold" | "mint" | "electric" | "royal";
  sub?: string;
}) {
  const colors: Record<string, string> = {
    default: "text-white",
    gold: "text-gold",
    mint: "text-mint",
    electric: "text-electric",
    royal: "text-royal-light",
  };

  return (
    <div className="surface rounded-xl px-3 py-2.5">
      <p className="font-display text-[9px] font-bold tracking-[0.14em] text-slate-deep uppercase">
        {label}
      </p>
      <p className={`mt-1 font-display text-[15px] leading-none font-bold ${colors[tone]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[9.5px] text-slate-deep">{sub}</p>}
    </div>
  );
}

const TONES = {
  good: "border-mint/28 bg-mint/10 text-mint",
  wait: "border-gold/30 bg-gold/10 text-gold",
  bad: "border-[#ff7070]/28 bg-[#ff7070]/10 text-[#ff8f8f]",
  muted: "border-slate-deep/25 bg-white/4 text-mist",
  info: "border-electric/25 bg-electric/8 text-electric",
} as const;

export function Chip({
  tone = "muted",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-[2px] font-display text-[9px] font-bold tracking-[0.08em] uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const DEPOSIT_STATUS: Record<string, keyof typeof TONES> = {
  credited: "good",
  approved: "good",
  pending: "wait",
  awaiting_pin: "wait",
  failed: "bad",
  rejected: "bad",
};

const WITHDRAWAL_STATUS: Record<string, keyof typeof TONES> = {
  paid: "good",
  processed: "good",
  pending: "wait",
  processing: "wait",
  failed: "bad",
  rejected: "bad",
};

export function StatusChip({ kind, status }: { kind: "deposit" | "withdrawal"; status: string }) {
  const map = kind === "deposit" ? DEPOSIT_STATUS : WITHDRAWAL_STATUS;
  return <Chip tone={map[status] ?? "muted"}>{status.replace("_", " ")}</Chip>;
}

/**
 * The reference desk shows records as cards rather than table rows — easier to
 * scan on a handset. This is that card, in the Vanta surface language.
 */
export function RecordCard({
  title,
  chip,
  detail,
  actions,
}: {
  title: React.ReactNode;
  chip?: React.ReactNode;
  detail?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <article className="surface rounded-xl px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{title}</div>
        {chip}
      </div>
      {detail && <div className="mt-2.5">{detail}</div>}
      {actions && <div className="mt-2.5">{actions}</div>}
    </article>
  );
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10.5px] text-slate-deep">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[11.5px] font-semibold text-fog">{children}</dd>
    </div>
  );
}

/**
 * Wraps a mutation form: renders the action's Alert and, on success, asks the
 * server for a fresh dashboard payload. Children receive the standard
 * useActionState triple so each form stays a few lines.
 */
export function useRefreshAction<A extends unknown[]>(
  action: (...args: A) => Promise<ActionState>,
): [(a: A[0]) => void, ActionState | undefined, boolean, () => void] {
  const router = useRouter();
  const [state, run, pending] = useActionState<ActionState | undefined, A[0]>(
    action as unknown as (prev: ActionState | undefined, payload: A[0]) => Promise<ActionState>,
    undefined,
  );
  const lastOk = useRef(false);

  useEffect(() => {
    if (state?.ok && !lastOk.current) {
      lastOk.current = true;
      router.refresh();
    }
    if (!state) lastOk.current = false;
  }, [state, router]);

  const reset = () => {
    lastOk.current = false;
  };

  return [run, state, pending, reset];
}

export function FormAlert({ state }: { state: ActionState | undefined }) {
  if (!state) return null;
  return (
    <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-white/6 bg-navy-900/50 px-4 py-6 text-center text-[11.5px] text-slate-deep">
      {children}
    </p>
  );
}
