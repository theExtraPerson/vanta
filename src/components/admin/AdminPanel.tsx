"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminDashboard } from "@/lib/admin/types";
import { SectionLabel, StatTile } from "@/components/admin/parts";
import { DepositsSection, MembersSection, WithdrawalsSection } from "@/components/admin/sections";
import {
  ActivitySection,
  AdminsSection,
  CyclesSection,
  PlansSection,
  ReferralsSection,
  SettingsSection,
} from "@/components/admin/catalog";
import { num, pct, ugx } from "@/lib/format";

/**
 * The ops desk. One page, pill tabs across the top, record cards underneath —
 * the same information architecture as the reference desk, skinned in the
 * Vanta navy/cyan/gold language.
 */

type TabId =
  | "overview"
  | "deposits"
  | "withdrawals"
  | "members"
  | "referrals"
  | "cycles"
  | "plans"
  | "admins"
  | "settings"
  | "activity";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Payouts" },
  { id: "members", label: "Members" },
  { id: "referrals", label: "Referrals" },
  { id: "cycles", label: "Cycles" },
  { id: "plans", label: "Plans" },
  { id: "admins", label: "Admins" },
  { id: "settings", label: "Settings" },
  { id: "activity", label: "Activity" },
];

export function AdminPanel({ initial }: { initial: AdminDashboard }) {
  const [tab, setTab] = useState<TabId>("overview");

  // The server re-runs vanta_admin_dashboard after every mutation, so the
  // panel always renders the freshest snapshot it was handed.
  const snapshot = initial;

  const pendingDeposits = snapshot.deposits.filter(
    (d) => d.status === "pending" || d.status === "awaiting_pin",
  ).length;
  const waitingPayouts = snapshot.withdrawals.filter(
    (w) => w.status === "pending" || w.status === "processing",
  ).length;
  const badge: Partial<Record<TabId, number>> = {
    deposits: pendingDeposits,
    withdrawals: waitingPayouts,
  };

  return (
    <div className="pb-10">
      {/* Desk header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div>
          <h1 className="font-display text-[19px] leading-tight font-bold text-white">
            Vanta <span className="text-gold-gradient">Ops Desk</span>
          </h1>
          <p className="mt-1 text-[11.5px] text-mist">
            {snapshot.overview.members_total} members · {snapshot.overview.active_cycles} live cycles
          </p>
        </div>
        <Link
          href="/dashboard"
          className="btn btn-outline h-8 shrink-0 px-3 text-[10px] text-mist"
        >
          Exit desk
        </Link>
      </div>

      {/* Sticky pill tabs */}
      <div className="sticky top-0 z-30 -mt-0.5 border-b border-electric/10 bg-navy-950/85 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-2.5">
          {TABS.map((t) => {
            const active = t.id === tab;
            const count = badge[t.id] ?? 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`btn h-7 shrink-0 px-3 text-[9.5px] ${
                  active ? "btn-primary" : "btn-ghost text-mist"
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold/18 px-1 font-display text-[9px] font-bold text-gold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3">
        {tab === "overview" && <Overview data={snapshot} />}
        {tab === "deposits" && <DepositsSection deposits={snapshot.deposits} />}
        {tab === "withdrawals" && <WithdrawalsSection withdrawals={snapshot.withdrawals} />}
        {tab === "members" && <MembersSection members={snapshot.members} />}
        {tab === "referrals" && (
          <ReferralsSection
            referrals={snapshot.referrals}
            rates={{
              l1: Number(snapshot.settings.referral_rate_l1 ?? 0.17),
              l2: Number(snapshot.settings.referral_rate_l2 ?? 0.01),
            }}
          />
        )}
        {tab === "cycles" && <CyclesSection cycles={snapshot.cycles} />}
        {tab === "plans" && <PlansSection plans={snapshot.plans} />}
        {tab === "admins" && <AdminsSection admins={snapshot.admins} />}
        {tab === "settings" && <SettingsSection settings={snapshot.settings} rules={snapshot.rules} />}
        {tab === "activity" && <ActivitySection audit={snapshot.audit} />}
      </div>
    </div>
  );
}

/* ── Overview tab ────────────────────────────────────────────────────────── */

function Overview({ data }: { data: AdminDashboard }) {
  const o = data.overview;
  const delta = o.members_today - o.members_yesterday;

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Platform</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Members" value={num(o.members_total)} tone="electric" sub={`${num(o.members_today)} joined today`} />
          <StatTile
            label="New vs yesterday"
            value={`${delta >= 0 ? "+" : "−"}${num(Math.abs(delta))}`}
            tone={delta >= 0 ? "mint" : "gold"}
          />
          <StatTile label="Invested members" value={num(o.active_members)} sub={`${num(o.active_cycles)} live cycles`} />
          <StatTile
            label="Restricted"
            value={num(o.banned_members)}
            tone={o.banned_members > 0 ? "gold" : "default"}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Money movement</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Deposits received" value={ugx(o.deposits_received, { compact: true })} tone="mint" />
          <StatTile label="Payouts paid" value={ugx(o.withdrawals_paid, { compact: true })} tone="gold" />
          <StatTile
            label="Deposits in flight"
            value={num(o.deposits_in_flight)}
            tone={o.deposits_in_flight > 0 ? "gold" : "default"}
            sub="awaiting review"
          />
          <StatTile
            label="Payouts waiting"
            value={num(o.withdrawals_waiting)}
            tone={o.withdrawals_waiting > 0 ? "gold" : "default"}
            sub="in the queue"
          />
        </div>
      </div>

      <div>
        <SectionLabel>Obligations</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Wallet liability" value={ugx(o.wallet_liability, { compact: true })} tone="royal" sub="held in member wallets" />
          <StatTile label="Returns paid" value={ugx(o.returns_paid, { compact: true })} />
          <StatTile label="Commissions paid" value={ugx(o.commission_paid, { compact: true })} />
          <StatTile label="Withdrawal fees" value={ugx(o.fees_collected, { compact: true })} tone="mint" sub="platform cut of settled payouts" />
        </div>
      </div>

      <div>
        <SectionLabel>Operating window</SectionLabel>
        <div className="surface rounded-xl px-3.5 py-3 text-[11.5px] leading-relaxed text-mist">
          <p>
            Minimum deposit {ugx(data.rules.min_deposit)} · minimum withdrawal {ugx(data.rules.min_withdrawal)}.
          </p>
          <p className="mt-1">
            Earnings mature at {data.rules.earnings_mature_at} {data.rules.timezone}; payouts accepted{" "}
            {data.rules.withdrawal_opens_at}–{data.rules.withdrawal_closes_at}
            {data.rules.withdrawals_open ? "" : " — window currently closed"}.
          </p>
          {data.settings.platform_frozen === true && (
            <p className="mt-2 rounded-lg border border-[#ff7070]/30 bg-[#ff7070]/10 px-3 py-2 text-[11px] text-[#ff8f8f]">
              PLATFORM FROZEN — {String(data.settings.freeze_message ?? "money movements are paused.")}
            </p>
          )}
        </div>
      </div>

      <div>
        <SectionLabel>Latest desk activity</SectionLabel>
        <ActivitySection audit={data.audit.slice(0, 6)} />
      </div>

      <p className="text-[9.5px] text-slate-deep">
        Rates: referral L1 {pct(Number(data.settings.referral_rate_l1 ?? 0.17))} · L2{" "}
        {pct(Number(data.settings.referral_rate_l2 ?? 0.01))}
      </p>
    </div>
  );
}
