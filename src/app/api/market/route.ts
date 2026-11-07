import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMarketFeed } from "@/lib/market/feed";

/**
 * Refresh endpoint for the two dashboard widgets.
 *
 * The data itself is public market information, but this is the signed-in
 * app's own screen, so it stays behind the session and is never a browser
 * proxy for third parties. Responses are per-user and time-sensitive: no
 * store, no revalidate.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "ledger-unconfigured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // blocking: the browser is showing a spinner, so wait for the new payload.
  const feed = await getMarketFeed({ blocking: true });

  return NextResponse.json(feed, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
