import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { reconcileOpenPayments } from "@/lib/payments/reconcile";

export const dynamic = "force-dynamic";

/**
 * Daily money job — fired by the Vercel Schedule in vercel.json at 22:00
 * Africa/Kampala, the earnings_mature_at hour enforced by vanta_maturity_at.
 * The schedule's jitter runs it a minute or so after the stroke, when the
 * day's earnings have definitely come due. vanta_run_daily_payouts pays every
 * matured day of every active investment in one pass, so a night the job
 * missed is caught up in full on the next run. It then sweeps the gateway for
 * movements that are still marked open, so a callback lost in transit never
 * leaves an investor waiting. The schedule targets this route over GET and
 * Vercel attaches the CRON_SECRET bearer token; manual calls must pass it
 * themselves.
 *
 * GET /api/cron/daily-payouts
 *   headers: { authorization: "Bearer <CRON_SECRET>" }
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";

  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase service role key is not configured" },
      { status: 503 },
    );
  }

  const { data, error } = await admin.rpc("vanta_run_daily_payouts", { p_limit: 1000 });

  if (error) {
    console.error("[vanta] daily payouts failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reconciled = await reconcileOpenPayments({ limit: 200 });

  return NextResponse.json({
    ok: true,
    paid: data ?? 0,
    payments: reconciled,
    ran_at: new Date().toISOString(),
  });
}
