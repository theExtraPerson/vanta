"use client";

import { useState } from "react";
import type { AdminDeposit, AdminMember, AdminMemberDetail, AdminWithdrawal } from "@/lib/admin/types";
import type { TxType } from "@/lib/types";
import {
  approveDepositAction,
  rejectDepositAction,
  settleWithdrawalAction,
  rejectWithdrawalAction,
  adjustWalletAction,
  setBanAction,
  loadMemberDetailAction,
} from "@/lib/admin/actions";
import {
  Chip,
  EmptyLine,
  FormAlert,
  KeyValue,
  RecordCard,
  SectionLabel,
  StatusChip,
  useRefreshAction,
} from "@/components/admin/parts";
import { dateTime, initialsOf, num, shortDate, ugx } from "@/lib/format";

/** Shared small-input skin for inline admin forms. */
export const inputSm =
  "h-8 min-w-0 flex-1 rounded-lg border border-electric/15 bg-navy-900/70 px-2.5 text-[11.5px] text-fog placeholder:text-slate-deep/70 focus:border-electric/50 focus:outline-none";

const btnXs = "btn h-8 px-3 text-[10px]";

/* ── Deposits ────────────────────────────────────────────────────────────── */

function DepositCard({ d }: { d: AdminDeposit }) {
  const reviewable = d.status === "pending" || d.status === "awaiting_pin";
  const [runApprove, stateA, pendingA] = useRefreshAction(approveDepositAction);
  const [runReject, stateR, pendingR] = useRefreshAction(rejectDepositAction);

  return (
    <RecordCard
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-electric/20 bg-electric/8 font-display text-[10px] font-bold text-electric">
            {initialsOf(d.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[13px] font-bold text-white">
              {d.name}
            </span>
            <span className="block truncate text-[10px] text-slate-deep">
              {d.username ? `@${d.username}` : d.msisdn ?? "—"} · {d.reference}
            </span>
          </span>
        </span>
      }
      chip={<StatusChip kind="deposit" status={d.status} />}
      detail={
        <dl className="space-y-1.5">
          <KeyValue label="Amount">{ugx(d.amount)}</KeyValue>
          <KeyValue label="Collection">
            {d.network ?? d.method} · {d.msisdn ?? "—"}
          </KeyValue>
          {(d.charge != null || d.net_amount != null) && (
            <KeyValue label="Charge / net">
              {num(d.charge ?? 0)} → {num(d.net_amount ?? d.amount)}
            </KeyValue>
          )}
          <KeyValue label="Created">{dateTime(d.created_at)}</KeyValue>
          {d.tid && <KeyValue label="TID">{d.tid}</KeyValue>}
          {d.failure_message && (
            <KeyValue label="Gateway">{d.failure_message}</KeyValue>
          )}
        </dl>
      }
      actions={
        reviewable ? (
          <div className="space-y-2">
            <form action={runApprove}>
              <input type="hidden" name="id" value={d.id} />
              <button type="submit" disabled={pendingA} className={`${btnXs} btn-primary w-full`}>
                Confirm &amp; credit wallet
              </button>
            </form>
            <FormAlert state={stateA} />
            <form action={runReject} className="flex items-center gap-2">
              <input type="hidden" name="id" value={d.id} />
              <input name="note" placeholder="reason (optional)" className={inputSm} />
              <button type="submit" disabled={pendingR} className={`${btnXs} btn-outline text-[#ff8f8f]`}>
                Write off
              </button>
            </form>
            <FormAlert state={stateR} />
          </div>
        ) : d.settled_at ? (
          <p className="text-[10px] text-slate-deep">Settled {dateTime(d.settled_at)}</p>
        ) : null
      }
    />
  );
}

export function DepositsSection({ deposits }: { deposits: AdminDeposit[] }) {
  const waiting = deposits.filter((d) => d.status === "pending" || d.status === "awaiting_pin");
  const history = deposits.filter((d) => d.status !== "pending" && d.status !== "awaiting_pin");

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Awaiting review — {waiting.length}</SectionLabel>
        {waiting.length === 0 ? (
          <EmptyLine>Nothing in the queue. Every deposit is settled.</EmptyLine>
        ) : (
          <div className="space-y-2.5">
            {waiting.map((d) => (
              <DepositCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <SectionLabel>Recent history</SectionLabel>
          <div className="space-y-2.5">
            {history.slice(0, 30).map((d) => (
              <DepositCard key={d.id} d={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Withdrawals ─────────────────────────────────────────────────────────── */

function WithdrawalCard({ w }: { w: AdminWithdrawal }) {
  const reviewable = w.status === "pending" || w.status === "processing";
  const [runSettle, stateS, pendingS] = useRefreshAction(settleWithdrawalAction);
  const [runReject, stateR, pendingR] = useRefreshAction(rejectWithdrawalAction);

  return (
    <RecordCard
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/8 font-display text-[10px] font-bold text-gold">
            {initialsOf(w.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[13px] font-bold text-white">
              {w.name}
            </span>
            <span className="block truncate text-[10px] text-slate-deep">
              {w.username ? `@${w.username}` : w.msisdn ?? "—"} · {w.reference}
            </span>
          </span>
        </span>
      }
      chip={<StatusChip kind="withdrawal" status={w.status} />}
      detail={
        <dl className="space-y-1.5">
          <KeyValue label="Payout">{ugx(w.amount)}</KeyValue>
          <KeyValue label="Pay to">
            {w.network ?? w.method} · {w.msisdn ?? "—"}
          </KeyValue>
          {(w.charge != null || w.net_amount != null) && (
            <KeyValue label="Charge / net">
              {num(w.charge ?? 0)} → {num(w.net_amount ?? w.amount)}
            </KeyValue>
          )}
          <KeyValue label="Requested">{dateTime(w.created_at)}</KeyValue>
          {w.tid && <KeyValue label="TID">{w.tid}</KeyValue>}
          {w.failure_message && <KeyValue label="Gateway">{w.failure_message}</KeyValue>}
        </dl>
      }
      actions={
        reviewable ? (
          <div className="space-y-2">
            <p className="text-[10px] leading-relaxed text-slate-deep">
              Pay {ugx(w.net_amount ?? w.amount)} to {w.msisdn ?? "the member's registered number"} first,
              then settle.
            </p>
            <form action={runSettle}>
              <input type="hidden" name="id" value={w.id} />
              <button type="submit" disabled={pendingS} className={`${btnXs} btn-gold w-full`}>
                Paid — mark settled
              </button>
            </form>
            <FormAlert state={stateS} />
            <form action={runReject} className="flex items-center gap-2">
              <input type="hidden" name="id" value={w.id} />
              <input name="note" placeholder="reason (optional)" className={inputSm} />
              <button type="submit" disabled={pendingR} className={`${btnXs} btn-outline text-[#ff8f8f]`}>
                Refuse
              </button>
            </form>
            <FormAlert state={stateR} />
          </div>
        ) : w.settled_at ? (
          <p className="text-[10px] text-slate-deep">Settled {dateTime(w.settled_at)}</p>
        ) : null
      }
    />
  );
}

export function WithdrawalsSection({ withdrawals }: { withdrawals: AdminWithdrawal[] }) {
  const waiting = withdrawals.filter((w) => w.status === "pending" || w.status === "processing");
  const history = withdrawals.filter((w) => w.status !== "pending" && w.status !== "processing");

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>In the payout queue — {waiting.length}</SectionLabel>
        {waiting.length === 0 ? (
          <EmptyLine>No withdrawal is waiting on the desk.</EmptyLine>
        ) : (
          <div className="space-y-2.5">
            {waiting.map((w) => (
              <WithdrawalCard key={w.id} w={w} />
            ))}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <SectionLabel>Recent history</SectionLabel>
          <div className="space-y-2.5">
            {history.slice(0, 30).map((w) => (
              <WithdrawalCard key={w.id} w={w} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Members ─────────────────────────────────────────────────────────────── */

const TX_LABEL: Record<TxType, string> = {
  deposit: "Deposit",
  investment: "Activation",
  earning: "Daily earning",
  referral: "Referral commission",
  withdrawal: "Withdrawal",
  capital_return: "Capital return",
  registration_bonus: "Registration bonus",
  adjustment_credit: "Desk credit",
  adjustment_debit: "Desk debit",
};

const TX_CREDIT: Record<TxType, boolean> = {
  deposit: true,
  investment: false,
  earning: true,
  referral: true,
  withdrawal: false,
  capital_return: true,
  registration_bonus: true,
  adjustment_credit: true,
  adjustment_debit: false,
};

function MemberFile({ detail }: { detail: AdminMemberDetail }) {
  return (
    <div className="space-y-3 border-t border-white/6 pt-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
        <p className="text-slate-deep">Email</p>
        <p className="truncate text-right text-fog">{detail.profile.email ?? "—"}</p>
        <p className="text-slate-deep">Referred by</p>
        <p className="truncate text-right text-fog">
          {detail.profile.referred_by_name
            ? `${detail.profile.referred_by_name} · ${detail.profile.referred_by_code ?? ""}`
            : "Organic"}
        </p>
      </div>

      {detail.cycles.length > 0 && (
        <div>
          <SectionLabel>Cycles</SectionLabel>
          <div className="space-y-1.5">
            {detail.cycles.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-fog">
                  {c.plan_name} · {ugx(c.amount)}
                </span>
                <span className="shrink-0 text-slate-deep">
                  {c.days_paid}/{c.duration_days}d · {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.downline.length > 0 && (
        <div>
          <SectionLabel>Downline — {detail.downline.length}</SectionLabel>
          <div className="space-y-1.5">
            {detail.downline.slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-fog">
                  {r.full_name} · {r.referral_code}
                </span>
                <span className="shrink-0 text-slate-deep">
                  {ugx(r.invested)} · {shortDate(r.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Ledger — last {detail.ledger.length}</SectionLabel>
        {detail.ledger.length === 0 ? (
          <EmptyLine>No entries yet.</EmptyLine>
        ) : (
          <div className="space-y-1.5">
            {detail.ledger.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-fog">
                  {TX_LABEL[tx.type]}
                  <span className="text-slate-deep"> · {dateTime(tx.created_at)}</span>
                </span>
                <span
                  className={`shrink-0 font-semibold ${TX_CREDIT[tx.type] ? "text-mint" : "text-[#ff8f8f]"}`}
                >
                  {TX_CREDIT[tx.type] ? "+" : "−"}
                  {num(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberCard({ m }: { m: AdminMember }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [banNote, setBanNote] = useState("");

  const [runAdjust, stateAdj, pendingAdj] = useRefreshAction(adjustWalletAction);
  const [runBan, stateBan, pendingBan] = useRefreshAction(setBanAction);

  const toggleFile = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loading) {
      setLoading(true);
      setDetail(await loadMemberDetailAction(m.id));
      setLoading(false);
    }
  };

  return (
    <RecordCard
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-display text-[10px] font-bold ${
              m.is_banned
                ? "border-[#ff7070]/30 bg-[#ff7070]/10 text-[#ff8f8f]"
                : "border-electric/20 bg-electric/8 text-electric"
            }`}
          >
            {initialsOf(m.full_name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[13px] font-bold text-white">
              {m.full_name}
            </span>
            <span className="block truncate text-[10px] text-slate-deep">
              {m.username ? `@${m.username}` : "no username"} · {m.phone ?? "—"} ·{" "}
              <span className="text-gold">{m.referral_code}</span>
            </span>
          </span>
        </span>
      }
      chip={m.is_banned ? <Chip tone="bad">Restricted</Chip> : <Chip tone="good">Active</Chip>}
      detail={
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <KeyValue label="Wallet">{ugx(m.balance)}</KeyValue>
          <KeyValue label="Invested">{ugx(m.total_invested)}</KeyValue>
          <KeyValue label="Earned">{ugx(m.total_earned)}</KeyValue>
          <KeyValue label="Referrals">{ugx(m.referral_earned)}</KeyValue>
          <KeyValue label="Referees">
            {num(m.referrals_count)} · {m.active_cycles} live cycle{m.active_cycles === 1 ? "" : "s"}
          </KeyValue>
          <KeyValue label="Joined">
            {shortDate(m.created_at)}
            {m.first_deposit_at ? ` · first top-up ${shortDate(m.first_deposit_at)}` : ""}
          </KeyValue>
        </dl>
      }
      actions={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFile}
              className={`${btnXs} btn-outline flex-1 text-mist`}
            >
              {open ? "Hide file" : loading ? "Opening…" : "Open file"}
            </button>
            <button
              type="button"
              onClick={() => setAdjusting((v) => !v)}
              className={`${btnXs} btn-outline flex-1 text-gold`}
            >
              {adjusting ? "Close correction" : "Correct wallet"}
            </button>
          </div>

          {open &&
            (loading && !detail ? (
              <p className="py-2 text-center text-[11px] text-slate-deep">Loading member file…</p>
            ) : detail ? (
              <MemberFile detail={detail} />
            ) : null)}

          {adjusting && (
            <form action={runAdjust} className="space-y-2 rounded-xl border border-gold/20 bg-gold/4 p-2.5">
              <input type="hidden" name="user_id" value={m.id} />
              <div className="flex gap-2">
                <input name="amount" type="number" min="1" step="1" placeholder="Amount (UGX)" className={inputSm} required />
                <select
                  name="direction"
                  className="h-8 rounded-lg border border-electric/15 bg-navy-900/70 px-2 text-[11.5px] text-fog focus:outline-none"
                  defaultValue="credit"
                >
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
              </div>
              <input name="reason" placeholder="Reason (recorded in the audit log)" className={inputSm} required />
              <button type="submit" disabled={pendingAdj} className={`${btnXs} btn-gold w-full`}>
                Post correction
              </button>
              <FormAlert state={stateAdj} />
            </form>
          )}

          <form action={runBan} className="flex items-center gap-2">
            <input type="hidden" name="user_id" value={m.id} />
            <input type="hidden" name="banned" value={m.is_banned ? "false" : "true"} />
            <input
              name="reason"
              value={banNote}
              onChange={(e) => setBanNote(e.target.value)}
              placeholder={m.is_banned ? "Lift the restriction…" : "Restrict account — reason…"}
              className={inputSm}
            />
            <button
              type="submit"
              disabled={pendingBan}
              className={`${btnXs} ${m.is_banned ? "btn-primary" : "btn-outline text-[#ff8f8f]"}`}
            >
              {m.is_banned ? "Lift" : "Restrict"}
            </button>
          </form>
          <FormAlert state={stateBan} />
        </div>
      }
    />
  );
}

export function MembersSection({ members }: { members: AdminMember[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? members.filter((m) =>
        [m.full_name, m.username ?? "", m.phone ?? "", m.referral_code]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : members;

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Members on file — {members.length}</SectionLabel>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, username, phone or referral code"
          className="h-9 w-full rounded-xl border border-electric/15 bg-navy-900/70 px-3 text-[12px] text-fog placeholder:text-slate-deep/70 focus:border-electric/50 focus:outline-none"
        />
      </div>

      {shown.length === 0 ? (
        <EmptyLine>No member matches that search.</EmptyLine>
      ) : (
        <div className="space-y-2.5">
          {shown.slice(0, 60).map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
