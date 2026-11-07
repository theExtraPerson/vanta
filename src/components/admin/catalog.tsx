"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminAuditRow,
  AdminCycle,
  AdminPlan,
  AdminReferralRow,
  AdminRoster,
} from "@/lib/admin/types";
import type { ActionState } from "@/lib/actions";
import type { PaymentRules } from "@/lib/types";
import {
  upsertPlanAction,
  grantAdminAction,
  revokeAdminAction,
  setFreezeAction,
  setSettingAction,
} from "@/lib/admin/actions";
import {
  Chip,
  EmptyLine,
  FormAlert,
  KeyValue,
  RecordCard,
  SectionLabel,
  StatTile,
  useRefreshAction,
} from "@/components/admin/parts";
import { inputSm } from "@/components/admin/sections";
import { dateTime, num, pct, shortDate, ugx } from "@/lib/format";

const btnXs = "btn h-8 px-3 text-[10px]";

/* ── Referrals ───────────────────────────────────────────────────────────── */

export function ReferralsSection({
  referrals,
  rates,
}: {
  referrals: { level1_paid: number; level2_paid: number; invested_members: number; rows: AdminReferralRow[] };
  rates: { l1: number; l2: number };
}) {
  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Commission book</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Level 1 paid" value={ugx(referrals.level1_paid, { compact: true })} tone="gold" sub={`rate ${pct(rates.l1)} of spend`} />
          <StatTile label="Level 2 paid" value={ugx(referrals.level2_paid, { compact: true })} tone="royal" sub={`rate ${pct(rates.l2)} of spend`} />
          <StatTile label="Invested members" value={num(referrals.invested_members)} tone="electric" />
          <StatTile label="Commissions logged" value={num(referrals.rows.length)} sub="latest 150" />
        </div>
      </div>

      <div>
        <SectionLabel>Recent commissions</SectionLabel>
        {referrals.rows.length === 0 ? (
          <EmptyLine>No commission has been paid yet.</EmptyLine>
        ) : (
          <div className="space-y-2.5">
            {referrals.rows.slice(0, 40).map((r) => (
              <RecordCard
                key={r.id}
                title={
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[13px] font-bold text-white">
                      {r.beneficiary}
                    </span>
                    <span className="block truncate text-[10px] text-slate-deep">
                      on {r.source}
                      {r.source_username ? ` (@${r.source_username})` : ""} · {dateTime(r.created_at)}
                    </span>
                  </span>
                }
                chip={<Chip tone={r.level === 1 ? "wait" : "info"}>{`L${r.level} · ${pct(r.rate)}`}</Chip>}
                detail={
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[10.5px] text-slate-deep">Commission</span>
                    <span className="text-[13px] font-bold text-gold">+{num(r.amount)}</span>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Cycles ──────────────────────────────────────────────────────────────── */

export function CyclesSection({ cycles }: { cycles: AdminCycle[] }) {
  const active = cycles.filter((c) => c.status === "active");
  const done = cycles.filter((c) => c.status !== "active");

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Running cycles — {active.length}</SectionLabel>
        {active.length === 0 ? (
          <EmptyLine>No investment cycle is running.</EmptyLine>
        ) : (
          <div className="space-y-2.5">
            {active.slice(0, 40).map((c) => (
              <CycleCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <SectionLabel>Completed (latest)</SectionLabel>
          <div className="space-y-2.5">
            {done.slice(0, 15).map((c) => (
              <CycleCard key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CycleCard({ c }: { c: AdminCycle }) {
  const pctDone = c.duration_days > 0 ? Math.min(100, Math.round((c.days_paid / c.duration_days) * 100)) : 0;

  return (
    <RecordCard
      title={
        <span className="min-w-0">
          <span className="block truncate font-display text-[13px] font-bold text-white">
            {c.name}
            {c.username ? <span className="text-slate-deep"> @{c.username}</span> : null}
          </span>
          <span className="block truncate text-[10px] text-slate-deep">
            {c.plan_name} · {ugx(c.amount)} · {num(c.daily_return)}/day
          </span>
        </span>
      }
      chip={c.status === "active" ? <Chip tone="info">Active</Chip> : <Chip tone="muted">Completed</Chip>}
      detail={
        <>
          <div className="mb-2 flex items-center justify-between text-[10px] text-slate-deep">
            <span>
              Day {c.days_paid} of {c.duration_days}
            </span>
            <span>ends {shortDate(c.ends_at)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-electric to-royal transition-[width] duration-300"
              style={{ width: `${pctDone}%` }}
            />
          </div>
          <dl className="mt-2 space-y-1">
            <KeyValue label="Committed return">{ugx(c.total_return)}</KeyValue>
            <KeyValue label="Started">{shortDate(c.started_at)}</KeyValue>
          </dl>
        </>
      }
    />
  );
}

/* ── Plans ───────────────────────────────────────────────────────────────── */

const fieldSm =
  "h-8 w-full rounded-lg border border-electric/15 bg-navy-900/70 px-2.5 text-[11.5px] text-fog placeholder:text-slate-deep/70 focus:border-electric/50 focus:outline-none";

export function PlansSection({ plans }: { plans: AdminPlan[] }) {
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Investment catalogue — {plans.length}</SectionLabel>
        <button
          type="button"
          onClick={() => setEditing(editing === "new" ? null : "new")}
          className={btnXs + " btn-primary"}
        >
          {editing === "new" ? "Close" : "New plan"}
        </button>
      </div>

      {editing && (
        <PlanForm plan={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      )}

      <div className="space-y-2.5">
        {plans.map((p) => (
          <RecordCard
            key={p.slug}
            title={
              <span className="min-w-0">
                <span className="block truncate font-display text-[13px] font-bold text-white">
                  {p.name}
                </span>
                <span className="block truncate font-mono text-[10px] text-slate-deep">{p.slug}</span>
              </span>
            }
            chip={
              <div className="flex gap-1.5">
                {p.badge && <Chip tone="wait">{p.badge}</Chip>}
                <Chip tone={p.is_active ? "good" : "muted"}>{p.is_active ? "Live" : "Hidden"}</Chip>
              </div>
            }
            detail={
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <KeyValue label="Price">{ugx(p.amount)}</KeyValue>
                <KeyValue label="Daily">{num(p.daily_return)} UGX</KeyValue>
                <KeyValue label="Duration">{p.duration_days} days</KeyValue>
                <KeyValue label="Return">{pct(p.duration_days * p.daily_return / p.amount)} total</KeyValue>
                <KeyValue label="Live cycles">{num(p.active_count)}</KeyValue>
                <KeyValue label="Order">{p.sort_order}</KeyValue>
              </dl>
            }
            actions={
              <button
                type="button"
                onClick={() => setEditing(editing && editing !== "new" && editing.slug === p.slug ? null : p)}
                className={btnXs + " btn-outline w-full text-mist"}
              >
                {editing && editing !== "new" && editing.slug === p.slug ? "Cancel edit" : "Edit plan"}
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
}

function PlanForm({ plan, onDone }: { plan: AdminPlan | null; onDone: () => void }) {
  const [run, state, pending] = useRefreshAction(upsertPlanAction);

  // A successful save closes the editor; the refreshed list arrives with it.
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form
      action={run}
      className="surface-gold space-y-2 rounded-xl p-3.5"
    >
      <SectionLabel>{plan ? `Edit — ${plan.name}` : "New plan"}</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <input name="slug" defaultValue={plan?.slug} placeholder="slug" className={fieldSm} required readOnly={Boolean(plan)} />
        <input name="name" defaultValue={plan?.name} placeholder="Display name" className={fieldSm} required />
        <input name="amount" type="number" min="1000" step="1" defaultValue={plan?.amount} placeholder="Price UGX" className={fieldSm} required />
        <input name="daily" type="number" min="1" step="1" defaultValue={plan?.daily_return} placeholder="Daily UGX" className={fieldSm} required />
        <input name="days" type="number" min="1" step="1" defaultValue={plan?.duration_days} placeholder="Duration days" className={fieldSm} required />
        <input name="badge" defaultValue={plan?.badge ?? ""} placeholder="Badge (optional)" className={fieldSm} />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-mist">
        <span>Visibility</span>
        <select
          name="active"
          defaultValue={plan?.is_active !== false ? "true" : "false"}
          className="h-8 flex-1 rounded-lg border border-electric/15 bg-navy-900/70 px-2 text-[11.5px] text-fog focus:outline-none"
        >
          <option value="true">Live on the plans screen</option>
          <option value="false">Hidden</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={btnXs + " btn-outline flex-1 text-mist"}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={btnXs + " btn-gold flex-1"}>
          {pending ? "Saving…" : "Save plan"}
        </button>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

/* ── Admins ──────────────────────────────────────────────────────────────── */

export function AdminsSection({ admins }: { admins: AdminRoster[] }) {
  const [runGrant, stateG, pendingG] = useRefreshAction(grantAdminAction);

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Desk roster — {admins.length}</SectionLabel>
        <form action={runGrant} className="flex items-center gap-2">
          <input name="username" placeholder="Grant by username (no @)" className={inputSm} required />
          <button type="submit" disabled={pendingG} className={btnXs + " btn-primary"}>
            Grant
          </button>
        </form>
        <FormAlert state={stateG} />
      </div>

      <div className="space-y-2.5">
        {admins.map((a) => (
          <AdminRow key={a.id} a={a} />
        ))}
      </div>

      <p className="text-[10.5px] leading-relaxed text-slate-deep">
        Membership on this roster is the only admin privilege. There are no tiers: an admin can review
        money, edit plans and add or remove other admins. The last admin cannot be removed.
      </p>
    </div>
  );
}

function AdminRow({ a }: { a: AdminRoster }) {
  const [run, state, pending] = useRefreshAction(revokeAdminAction);

  return (
    <RecordCard
      title={
        <span className="min-w-0">
          <span className="block truncate font-display text-[13px] font-bold text-white">
            {a.name}
            {a.username ? <span className="text-slate-deep"> @{a.username}</span> : null}
          </span>
          <span className="block text-[10px] text-slate-deep">On the desk since {shortDate(a.created_at)}</span>
        </span>
      }
      chip={a.is_self ? <Chip tone="info">You</Chip> : undefined}
      actions={
        a.is_self ? null : (
          <div className="space-y-2">
            <form action={run}>
              <input type="hidden" name="user_id" value={a.id} />
              <button type="submit" disabled={pending} className={btnXs + " btn-outline w-full text-[#ff8f8f]"}>
                Remove admin access
              </button>
            </form>
            <FormAlert state={state} />
          </div>
        )
      }
    />
  );
}

/* ── Settings ────────────────────────────────────────────────────────────── */

export function SettingsSection({
  settings,
  rules,
}: {
  settings: Record<string, unknown>;
  rules: PaymentRules;
}) {
  const frozen = settings.platform_frozen === true;

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Platform freeze</SectionLabel>
        <FreezeCard frozen={frozen} />
      </div>

      <div>
        <SectionLabel>Referral rates</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <NumberSetting label="Level 1" keyName="referral_rate_l1" value={Number(settings.referral_rate_l1 ?? 0.17)} />
          <NumberSetting label="Level 2" keyName="referral_rate_l2" value={Number(settings.referral_rate_l2 ?? 0.01)} />
        </div>
      </div>

      <div>
        <SectionLabel>Freeze message</SectionLabel>
        <TextSetting
          label="Shown to members while the platform is frozen"
          keyName="freeze_message"
          value={String(settings.freeze_message ?? "")}
        />
      </div>

      <div>
        <SectionLabel>Money rules (from rpc.sql)</SectionLabel>
        <div className="surface rounded-xl px-3.5 py-3">
          <dl className="space-y-1.5">
            <KeyValue label="Minimum deposit">{ugx(rules.min_deposit)}</KeyValue>
            <KeyValue label="Minimum withdrawal">{ugx(rules.min_withdrawal)}</KeyValue>
            <KeyValue label="Earnings mature">{rules.earnings_mature_at} {rules.timezone}</KeyValue>
            <KeyValue label="Withdrawal window">
              {rules.withdrawal_opens_at}–{rules.withdrawal_closes_at}
            </KeyValue>
            <KeyValue label="Payout desk">
              {rules.withdrawals_open ? <Chip tone="good">Open</Chip> : <Chip tone="wait">Closed</Chip>}
            </KeyValue>
          </dl>
        </div>
      </div>
    </div>
  );
}

function FreezeCard({ frozen }: { frozen: boolean }) {
  const [run, state, pending] = useRefreshAction(setFreezeAction);

  return (
    <div className="surface rounded-xl px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-mist">
          {frozen
            ? "New deposits, activations, claims and withdrawals are being refused."
            : "Money moves normally. Members can top up, invest and cash out."}
        </p>
        <Chip tone={frozen ? "bad" : "good"}>{frozen ? "Frozen" : "Live"}</Chip>
      </div>
      <form action={run} className="flex gap-2">
        <input type="hidden" name="frozen" value={frozen ? "false" : "true"} />
        <button type="submit" disabled={pending} className={`${btnXs} ${frozen ? "btn-gold" : "btn-outline text-[#ff8f8f]"} w-full`}>
          {frozen ? "Resume the platform" : "Freeze the platform"}
        </button>
      </form>
      <FormAlert state={state} />
    </div>
  );
}

function NumberSetting({ label, keyName, value }: { label: string; keyName: string; value: number }) {
  return (
    <InlineSetting
      label={label}
      keyName={keyName}
      initial={String(value)}
      parse={(raw) => {
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
      }}
      hint="0–1 (e.g. 0.17 = 17%)"
    />
  );
}

function TextSetting({ label, keyName, value }: { label: string; keyName: string; value: string }) {
  return <InlineSetting label={label} keyName={keyName} initial={value} parse={(raw) => (raw ? raw : null)} hint="" />;
}

function InlineSetting({
  label,
  keyName,
  initial,
  parse,
  hint,
}: {
  label: string;
  keyName: string;
  initial: string;
  parse: (raw: string) => unknown | null;
  hint: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, setPending] = useState(false);

  const save = async () => {
    const value = parse(draft);
    if (value === null) {
      setState({ ok: false, message: "Check the value before saving." });
      return;
    }
    setPending(true);
    const next = await setSettingAction(keyName, value);
    setPending(false);
    setState(next);
    if (next.ok) router.refresh();
  };

  return (
    <div className="surface rounded-xl px-3 py-2.5">
      <p className="font-display text-[9px] font-bold tracking-[0.14em] text-slate-deep uppercase">{label}</p>
      <div className="mt-1.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputSm}
          aria-label={keyName}
        />
        <button type="button" onClick={save} disabled={pending || draft === initial} className={btnXs + " btn-primary"}>
          Save
        </button>
      </div>
      {hint && <p className="mt-1 text-[9.5px] text-slate-deep">{hint}</p>}
      {state && <div className="mt-2"><FormAlert state={state ?? undefined} /></div>}
    </div>
  );
}

/* ── Activity ────────────────────────────────────────────────────────────── */

export function ActivitySection({ audit }: { audit: AdminAuditRow[] }) {
  if (audit.length === 0) {
    return <EmptyLine>No desk activity has been recorded yet.</EmptyLine>;
  }

  return (
    <div className="space-y-2.5">
      {audit.map((row) => (
        <div key={row.id} className="surface flex items-start justify-between gap-3 rounded-xl px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-display text-[12px] font-bold text-white">
              {humanise(row.action)}
              {row.target_type && (
                <span className="text-slate-deep"> · {row.target_type}</span>
              )}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-deep">
              by {row.actor_name ?? "system"}
              {row.target_id ? ` · ${row.target_id.slice(0, 8)}` : ""}
            </p>
            {row.note && <p className="mt-1 text-[10.5px] leading-relaxed text-mist">{row.note}</p>}
          </div>
          <span className="shrink-0 text-[9.5px] text-slate-deep">{dateTime(row.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

const ACTION_WORDS: Record<string, string> = {
  approve_deposit: "Deposit credited",
  reject_deposit: "Deposit written off",
  settle_withdrawal: "Payout settled",
  reject_withdrawal: "Withdrawal refused",
  adjust_wallet: "Wallet corrected",
  ban_member: "Account restricted",
  unban_member: "Restriction lifted",
  upsert_plan: "Plan saved",
  grant_admin: "Admin granted",
  revoke_admin: "Admin removed",
  set_setting: "Setting updated",
};

function humanise(action: string): string {
  if (ACTION_WORDS[action]) return ACTION_WORDS[action];
  const head = action.split(".")[0] ?? action;
  return ACTION_WORDS[head] ?? action.replace(/_/g, " ");
}
