"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSessionAdmin } from "@/lib/admin/data";
import { getMemberDetail } from "@/lib/admin/data";
import type { AdminMemberDetail } from "@/lib/admin/types";
import type { ActionState } from "@/lib/actions";

/**
 * Admin mutations. Each one re-checks the caller is an admin before touching
 * the database (defence in depth — the RPCs guard too) and calls the write RPC
 * on the admin's own session so the audit log records the real actor.
 */

function fail(message: string, field?: string): ActionState {
  return { ok: false, message, field };
}

const NOT_CONFIGURED =
  "The Vanta ledger is not connected. Run supabase/schema.sql, rpc.sql and admin.sql first.";

const HINTS: Record<string, string> = {
  NOT_AUTHENTICATED: "Your session expired — sign in again.",
  FORBIDDEN: "This desk is for platform operators only.",
  DEPOSIT_NOT_FOUND: "That deposit no longer exists.",
  WITHDRAWAL_NOT_FOUND: "That withdrawal no longer exists.",
  DEPOSIT_ALREADY_REVIEWED: "That deposit has already been settled.",
  DEPOSIT_REJECTED: "That deposit was already written off.",
  PROFILE_NOT_FOUND: "No such member.",
  NOTHING_TO_ADJUST: "Enter a non-zero amount.",
  ODD_AMOUNT: "Enter a whole number of shillings.",
  REASON_REQUIRED: "Give a reason for the correction.",
  INSUFFICIENT_BALANCE: "The wallet does not have enough to debit that much.",
  CANNOT_BAN_SELF: "You cannot ban your own account.",
  CANNOT_REMOVE_SELF: "You cannot remove your own admin access.",
  LAST_ADMIN: "At least one admin must remain.",
  MEMBER_NOT_FOUND: "No account with that username.",
  ALREADY_ADMIN: "That member is already an admin.",
  INVALID_SLUG: "Slug must be 2–24 lowercase letters, digits or underscore.",
  INVALID_PLAN: "Price, daily earning and duration must all be positive.",
  INVALID_KEY: "Missing setting key.",
};

function toState(raw: string, fallback = "Something went wrong — try again."): ActionState {
  const head = (raw ?? "").split(":")[0]?.trim().toUpperCase() ?? "";
  return fail(HINTS[head] ?? raw ?? fallback);
}

/** Returns a ready client, or an ActionState describing why it is unavailable. */
type Desk = { client: SupabaseClient } | { state: ActionState };

async function desk(): Promise<Desk> {
  if (!isSupabaseConfigured) return { state: fail(NOT_CONFIGURED) };
  if (!(await isSessionAdmin())) return { state: fail(HINTS.FORBIDDEN) };

  const client = await createServerSupabase();
  if (!client) return { state: fail(NOT_CONFIGURED) };
  return { client };
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin", "layout");
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/* ── Deposits ────────────────────────────────────────────────────────────── */

export async function approveDepositAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const { error } = await desk_.client.rpc("vanta_admin_approve_deposit", {
    p_deposit_id: str(fd, "id"),
    p_note: str(fd, "note") || null,
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: "Deposit confirmed — the wallet was credited." };
}

export async function rejectDepositAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const { error } = await desk_.client.rpc("vanta_admin_reject_deposit", {
    p_deposit_id: str(fd, "id"),
    p_note: str(fd, "note") || null,
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: "Deposit written off." };
}

/* ── Withdrawals ─────────────────────────────────────────────────────────── */

export async function settleWithdrawalAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const { error } = await desk_.client.rpc("vanta_admin_settle_withdrawal", {
    p_withdrawal_id: str(fd, "id"),
    p_note: str(fd, "note") || null,
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: "Payout marked settled." };
}

export async function rejectWithdrawalAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const { error } = await desk_.client.rpc("vanta_admin_reject_withdrawal", {
    p_withdrawal_id: str(fd, "id"),
    p_note: str(fd, "note") || null,
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: "Withdrawal refused — the hold is back in the wallet." };
}

/* ── Members ─────────────────────────────────────────────────────────────── */

export async function adjustWalletAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const amount = Number(str(fd, "amount"));
  const debit = str(fd, "direction") === "debit";
  if (!Number.isFinite(amount) || amount === 0) return fail("Enter an amount.", "amount");

  const { error } = await desk_.client.rpc("vanta_admin_adjust_wallet", {
    p_user_id: str(fd, "user_id"),
    p_delta: debit ? -Math.abs(Math.round(amount)) : Math.abs(Math.round(amount)),
    p_reason: str(fd, "reason"),
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: `Wallet corrected by ${debit ? "-" : "+"}${Math.round(amount)} UGX.` };
}

export async function setBanAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const banned = str(fd, "banned") === "true";
  const { error } = await desk_.client.rpc("vanta_admin_set_ban", {
    p_user_id: str(fd, "user_id"),
    p_banned: banned,
    p_reason: str(fd, "reason") || null,
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: banned ? "Account restricted." : "Restriction lifted." };
}

/* ── Plans ───────────────────────────────────────────────────────────────── */

export async function upsertPlanAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const amount = Number(str(fd, "amount"));
  const daily = Number(str(fd, "daily"));
  const days = Number(str(fd, "days"));
  if (!Number.isFinite(amount) || !Number.isFinite(daily) || !Number.isFinite(days)) {
    return fail("Price, daily earning and duration are required.");
  }

  const { error } = await desk_.client.rpc("vanta_admin_upsert_plan", {
    p_slug: str(fd, "slug"),
    p_name: str(fd, "name"),
    p_amount: amount,
    p_daily: daily,
    p_days: Math.round(days),
    p_badge: str(fd, "badge") || null,
    p_active: str(fd, "active") !== "false",
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: "Plan saved." };
}

/* ── Admins ──────────────────────────────────────────────────────────────── */

export async function grantAdminAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const username = str(fd, "username").replace(/^@/, "");
  if (!username) return fail("Enter a username.", "username");

  const { error } = await desk_.client.rpc("vanta_admin_grant", { p_username: username });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: `@${username} is now an admin.` };
}

export async function revokeAdminAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const { error } = await desk_.client.rpc("vanta_admin_revoke", { p_user_id: str(fd, "user_id") });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: "Admin access removed." };
}

/* ── Settings ────────────────────────────────────────────────────────────── */

export async function setFreezeAction(fd: FormData): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const frozen = str(fd, "frozen") === "true";
  const { error } = await desk_.client.rpc("vanta_admin_set_setting", {
    p_key: "platform_frozen",
    p_value: JSON.stringify(frozen),
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return {
    ok: true,
    message: frozen ? "Platform frozen for new money movements." : "Platform unfrozen.",
  };
}

export async function setSettingAction(key: string, value: unknown): Promise<ActionState> {
  const desk_ = await desk();
  if ("state" in desk_) return desk_.state;

  const { error } = await desk_.client.rpc("vanta_admin_set_setting", {
    p_key: key,
    p_value: JSON.stringify(value),
  });
  if (error) return toState(error.message);

  revalidateAdmin();
  return { ok: true, message: "Saved." };
}

/** Lazy per-member detail (ledger + cycles + downline) for the Members tab. */
export async function loadMemberDetailAction(
  userId: string,
): Promise<AdminMemberDetail | null> {
  if (!(await isSessionAdmin())) return null;
  return getMemberDetail(userId);
}
