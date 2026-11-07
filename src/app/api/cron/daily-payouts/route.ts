import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Daily accrual job. Schedule this once a day (Vercel Cron, GitHub Action or
 * Supabase pg_cron hitting the URL). Protected by the CRON_SECRET header.
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

  return NextResponse.json({
    ok: true,
    paid: data ?? 0,
    ran_at: new Date().toISOString(),
  });
}
