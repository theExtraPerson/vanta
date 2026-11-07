import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/payments/shashura";

export const dynamic = "force-dynamic";

/**
 * SHASHURA payment callback — one endpoint for collections and payouts.
 *
 * Register the absolute URL of this route under Settings → Apps together with
 * the app's signing secret (SHASHURA_WEBHOOK_SECRET). Every delivery carries
 * `X-Shashura-Signature`: an HMAC-SHA256 of the raw body, which must be verified
 * before the payload is trusted.
 *
 * Settlement itself happens inside `vanta_handle_gateway_event`, which logs the
 * event and applies it once, so gateway retries cannot pay anybody twice.
 *
 * POST /api/payments/callback
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-shashura-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("[vanta] payment callback rejected — signature missing or invalid");
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const event = String(payload.event ?? "");
  const type = String(payload.type ?? "").toUpperCase();

  if (event !== "transaction.finalized" || (type !== "COLLECTION" && type !== "DISBURSEMENT")) {
    // Anything else is informational; acknowledge so the gateway moves on.
    return NextResponse.json({ ok: true, ignored: event || "unknown" });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    console.error("[vanta] payment callback has no service role key to settle with");
    return NextResponse.json({ error: "LEDGER_UNAVAILABLE" }, { status: 503 });
  }

  const { data, error } = await admin.rpc("vanta_handle_gateway_event", {
    p_payload: payload as never,
  });

  if (error) {
    // 500 makes the gateway retry — the event was not applied.
    console.error("[vanta] vanta_handle_gateway_event failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data === "UNMATCHED") {
    console.warn(
      "[vanta] payment callback matched no ledger row:",
      payload.external_ref,
      payload.tid,
    );
  }

  return NextResponse.json({ ok: true, result: data });
}

export function GET() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
