"use client";

import { useActionState, useState } from "react";
import {
  claimEarningsAction,
  depositAction,
  investAction,
  reconcilePaymentsAction,
  updateProfileAction,
  withdrawAction,
  type ActionState,
} from "@/lib/actions";
import { Alert, Field } from "@/components/ui/Field";
import { Button, Pill } from "@/components/ui/primitives";
import { minDeposit, minWithdrawal, withdrawalClosesAt, withdrawalOpensAt } from "@/lib/supabase/config";
import { featuredPlan, plans } from "@/lib/plans";
import { num, ugx } from "@/lib/format";

type State = ActionState | undefined;

/* ── Activate a plan ─────────────────────────────────────────────────────── */

export function PlanGrid({ balance }: { balance: number }) {
  const [state, action, pending] = useActionState<State, FormData>(investAction, undefined);

  return (
    <div className="space-y-3">
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}

      {plans.map((plan) => {
        const affordable = balance >= plan.amount;
        const featured = plan.slug === featuredPlan.slug;

        return (
          <div
            key={plan.slug}
            id={plan.slug}
            className={`rounded-2xl p-4 ${featured ? "qx-card" : "surface rounded-2xl"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-[14px] font-bold text-white">{plan.name}</p>
                <p className="mt-0.5 text-[10.5px] text-slate-deep">
                  {plan.days}-day cycle · {plan.roi}% return
                </p>
              </div>
              {plan.badge && <Pill tone={featured ? "gold" : "muted"}>{plan.badge}</Pill>}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-electric/10 bg-navy-900/60 p-2.5">
              <div>
                <p className="text-[8.5px] font-bold tracking-[0.12em] text-slate-deep uppercase">
                  Price
                </p>
                <p className="mt-0.5 font-display text-[13px] font-bold text-white">
                  {ugx(plan.amount)}
                </p>
              </div>
              <div>
                <p className="text-[8.5px] font-bold tracking-[0.12em] text-slate-deep uppercase">
                  Daily
                </p>
                <p className="mt-0.5 font-display text-[13px] font-bold text-gold">
                  {ugx(plan.daily)}
                </p>
              </div>
              <div>
                <p className="text-[8.5px] font-bold tracking-[0.12em] text-slate-deep uppercase">
                  After {plan.days}d
                </p>
                <p className="mt-0.5 font-display text-[13px] font-bold text-mint">
                  {ugx(plan.totalReturn)}
                </p>
              </div>
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-mist">
              {plan.summary} Total earnings {ugx(plan.totalEarnings)}.
            </p>

            <form action={action} className="mt-3">
              <input type="hidden" name="plan" value={plan.slug} />
              <Button
                type="submit"
                variant={affordable ? "primary" : "outline"}
                size="sm"
                className="w-full"
                disabled={pending || !affordable}
              >
                {affordable ? `Activate ${plan.name}` : `Need ${ugx(plan.amount - balance)} more`}
              </Button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

/* ── Deposit ─────────────────────────────────────────────────────────────── */

const QUICK_AMOUNTS = [minDeposit, 20_000, 50_000, 150_000];

/**
 * Mobile money top-up. There is nothing to copy-paste any more: the gateway
 * pushes a PIN prompt to the number below and the wallet is credited by the
 * provider's callback.
 */
export function DepositForm({ defaultPhone }: { defaultPhone?: string | null }) {
  const [state, action, pending] = useActionState<State, FormData>(depositAction, undefined);
  const [amount, setAmount] = useState("");

  return (
    <form action={action} className="space-y-4 pb-1">
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}

      <Field
        label="Amount"
        name="amount"
        type="number"
        min={minDeposit}
        step={1000}
        placeholder={String(minDeposit)}
        suffix="UGX"
        hint={`Minimum ${ugx(minDeposit)}`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        error={state?.field === "amount" ? state.message : undefined}
      />

      <div className="grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(String(a))}
            className={`rounded-lg border px-1 py-1.5 font-display text-[10px] font-bold tracking-[0.05em] transition-colors ${
              amount === String(a)
                ? "border-electric/45 bg-electric/12 text-electric"
                : "border-electric/15 text-mist hover:border-electric/30"
            }`}
          >
            {num(a)}
          </button>
        ))}
      </div>

      <div>
        <label
          htmlFor="method"
          className="mb-1.5 block font-display text-[10.5px] font-bold tracking-[0.14em] text-mist uppercase"
        >
          Mobile money network
        </label>
        <select
          id="method"
          name="method"
          className="h-11 w-full rounded-xl border border-electric/15 bg-navy-900/70 px-3 text-[14px] text-fog focus:border-electric/55 focus:outline-none"
          defaultValue="MTN MoMo"
        >
          <option className="bg-navy-900">MTN MoMo</option>
          <option className="bg-navy-900">Airtel Money</option>
        </select>
      </div>

      <Field
        label="Number to charge"
        name="phone"
        type="tel"
        defaultValue={defaultPhone ?? ""}
        placeholder="0772 000 000"
        hint="You will get a mobile money PIN prompt on this line"
        required
        error={state?.field === "phone" ? state.message : undefined}
      />

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending prompt…" : "Send payment prompt"}
      </Button>

      <p className="text-[11px] leading-relaxed text-slate-deep">
        Approve the prompt on your phone and the amount lands in your wallet automatically. If the
        network is slow, use “Check payment status” below.
      </p>
    </form>
  );
}

/** Settles open movements from the provider when a callback has not arrived. */
export function ReconcileButton() {
  const [state, action, pending] = useActionState<State, FormData>(reconcilePaymentsAction, undefined);

  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" size="sm" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Check payment status"}
      </Button>
      {state && (
        <p className={`text-[10.5px] leading-relaxed ${state.ok ? "text-mint" : "text-[#ff8f8f]"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

/* ── Withdraw ────────────────────────────────────────────────────────────── */

export function WithdrawForm({
  balance,
  defaultPhone,
  open = true,
}: {
  balance: number;
  defaultPhone?: string | null;
  /** Server-side clock says whether the 09:00–22:00 window is currently open. */
  open?: boolean;
}) {
  const [state, action, pending] = useActionState<State, FormData>(withdrawAction, undefined);
  const [amount, setAmount] = useState("");

  return (
    <form action={action} className="space-y-4 pb-1">
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}

      <div className="surface rounded-2xl p-4">
        <p className="micro-label">Available to withdraw</p>
        <p className="mt-1 font-display text-2xl font-bold text-gold">{ugx(balance)}</p>
        <p className="mt-1 text-[11px] text-slate-deep">
          Minimum {ugx(minWithdrawal)} · open {withdrawalOpensAt}–{withdrawalClosesAt} EAT
        </p>
        {!open && (
          <Pill tone="muted" className="mt-2">
            Window closed
          </Pill>
        )}
      </div>

      <Field
        label="Amount"
        name="amount"
        type="number"
        min={minWithdrawal}
        step={1000}
        placeholder={String(minWithdrawal)}
        suffix="UGX"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        error={state?.field === "amount" ? state.message : undefined}
      />

      <button
        type="button"
        onClick={() => setAmount(String(Math.floor(balance)))}
        className="rounded-lg border border-electric/25 px-3 py-1.5 font-display text-[10px] font-bold tracking-[0.1em] text-electric uppercase"
      >
        Withdraw everything
      </button>

      <div>
        <label
          htmlFor="withdraw-method"
          className="mb-1.5 block font-display text-[10.5px] font-bold tracking-[0.14em] text-mist uppercase"
        >
          Payout network
        </label>
        <select
          id="withdraw-method"
          name="method"
          className="h-11 w-full rounded-xl border border-electric/15 bg-navy-900/70 px-3 text-[14px] text-fog focus:border-electric/55 focus:outline-none"
          defaultValue="MTN MoMo"
        >
          <option className="bg-navy-900">MTN MoMo</option>
          <option className="bg-navy-900">Airtel Money</option>
        </select>
      </div>

      <Field
        label="Mobile money number"
        name="phone"
        type="tel"
        defaultValue={defaultPhone ?? ""}
        placeholder="+256 7XX XXX XXX"
        hint="Airtel clears instantly; MTN confirms a few seconds later"
        required
        error={state?.field === "phone" ? state.message : undefined}
      />

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending payout…" : "Withdraw now"}
      </Button>

      <p className="text-[11px] leading-relaxed text-slate-deep">
        The amount is held from your balance as soon as you submit. If the network declines the
        payout, it goes straight back to your wallet.
      </p>
    </form>
  );
}

/* ── Claim daily earning ─────────────────────────────────────────────────── */

export function ClaimButton({ investmentId, label }: { investmentId: string; label: string }) {
  const [state, action, pending] = useActionState<State, FormData>(claimEarningsAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="investment_id" value={investmentId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Crediting…" : label}
      </Button>
      {state && (
        <span className={`text-[10.5px] ${state.ok ? "text-mint" : "text-[#ff8f8f]"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

/* ── Profile ─────────────────────────────────────────────────────────────── */

export function ProfileForm({
  fullName,
  phone,
  username,
}: {
  fullName: string;
  phone: string | null;
  username: string | null;
}) {
  const [state, action, pending] = useActionState<State, FormData>(updateProfileAction, undefined);

  return (
    <form action={action} className="space-y-4">
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}

      <Field label="Full name" name="full_name" defaultValue={fullName} required />
      <Field
        label="Mobile number"
        name="phone"
        type="tel"
        defaultValue={phone ?? ""}
        placeholder="07XX XXX XXX"
        required
        error={state?.field === "phone" ? state.message : undefined}
      />
      <Field
        label="Username"
        name="username"
        defaultValue={username ?? ""}
        disabled
        hint="Locked — your sign-in name"
      />

      <Button type="submit" variant="primary" size="md" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
