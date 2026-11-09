/**
 * Payment reconciliation.
 *
 * The gateway reveals the final state of a movement in two ways: the signed
 * callback (instant) and `GET /enquiry/{reference}` (on demand). Callbacks never
 * reach a laptop, and networks occasionally stay silent, so the ledger also
 * polls. Both paths funnel into `vanta_handle_gateway_event`, which is
 * idempotent — a poll racing a callback settles the money exactly once.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { enquiry, enquiryToEvent, isPaymentsConfigured, type EnquiryResult } from "@/lib/payments/shashura";

export type ReconcileSummary = {
  checked: number;
  settled: number;
  failed: number;
  pending: number;
};

/** A prompt nobody ever answered is dead — stop showing it as outstanding. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

/** A movement pushed seconds ago has no answer worth fetching yet. */
const FRESH_AFTER_MS = 20 * 1000;

type OpenRow = { id: string; reference: string; created_at: string };

async function applyEvent(admin: SupabaseClient, payload: Record<string, unknown>) {
  const { data, error } = await admin.rpc("vanta_handle_gateway_event", { p_payload: payload });
  if (error) {
    console.error("[vanta] vanta_handle_gateway_event failed:", error.message);
    return null;
  }
  return data as string | null;
}

async function sweep(
  admin: SupabaseClient,
  table: "deposits" | "withdrawals",
  openStatuses: string[],
  type: "COLLECTION" | "DISBURSEMENT",
  userId: string | undefined,
  limit: number,
  summary: ReconcileSummary,
) {
  let query = admin
    .from(table)
    .select("id, reference, created_at")
    .in("status", openStatuses)
    .lt("created_at", new Date(Date.now() - FRESH_AFTER_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);

  if (table === "withdrawals") {
    // Requests still awaiting desk approval have never reached the gateway —
    // only sweep ones that were actually submitted (the admin claim sets tid).
    query = query.not("tid", "is", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`[vanta] reconcile ${table} query failed:`, error.message);
    return;
  }

  for (const row of (data ?? []) as OpenRow[]) {
    if (!row.reference) continue;
    summary.checked += 1;

    let answer: EnquiryResult | null = null;
    try {
      answer = await enquiry(row.reference);
    } catch (err) {
      console.error(`[vanta] enquiry ${row.reference} failed:`, err);
      summary.pending += 1;
      continue;
    }

    // Terminal answer → settle it through the same path as the callback.
    if (answer && answer.state !== "PENDING") {
      const outcome = await applyEvent(admin, enquiryToEvent(answer, type));
      if (outcome === "SETTLED") summary.settled += 1;
      else if (outcome === "FAILED") summary.failed += 1;
      else summary.pending += 1;
      continue;
    }

    // Collections expire: nobody approved the PIN prompt, so the attempt is
    // closed and the investor can send a fresh one. Payouts hold real balance
    // and are closed by the desk instead, never automatically.
    const stale = Date.now() - new Date(row.created_at).getTime() > STALE_AFTER_MS;
    if (type === "COLLECTION" && stale) {
      await admin.rpc("vanta_set_deposit_gateway", {
        p_deposit_id: row.id,
        p_tid: answer?.tid ?? null,
        p_state: "TF",
        p_code: answer ? "TIMED_OUT" : "NOT_FOUND",
        p_message: answer
          ? "The payment prompt was never approved."
          : "The gateway has no record of this request.",
      });
      summary.failed += 1;
    } else {
      summary.pending += 1;
    }
  }
}

/**
 * Polls the gateway for every movement the ledger still believes is open and
 * settles what it can. `userId` narrows the sweep to one investor (the wallet
 * screen's "Check status" button); without it the whole book is swept (cron).
 */
export async function reconcileOpenPayments(
  opts: { userId?: string; limit?: number } = {},
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { checked: 0, settled: 0, failed: 0, pending: 0 };

  const admin = createAdminSupabase();
  if (!admin || !isPaymentsConfigured) return summary;

  const limit = opts.limit ?? 20;

  await sweep(admin, "deposits", ["pending", "awaiting_pin"], "COLLECTION", opts.userId, limit, summary);
  await sweep(admin, "withdrawals", ["pending", "processing"], "DISBURSEMENT", opts.userId, limit, summary);

  return summary;
}
