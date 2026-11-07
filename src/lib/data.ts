import { cache } from "react";
import { createServerSupabase, getSessionUser } from "@/lib/supabase/server";
import { isSupabaseConfigured, siteUrl } from "@/lib/supabase/config";
import type { DashboardData } from "@/lib/types";

/**
 * Reads the whole dashboard payload from a single Postgres RPC
 * (`vanta_dashboard`) so the page costs one round-trip. Wrapped in `cache`
 * so the dashboard layout and the page share one call per request.
 *
 * There is no sample data: without a connected Supabase project the dashboard
 * is simply unreachable and the caller falls back to /login.
 */
export const getDashboard = cache(async (): Promise<DashboardData | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("vanta_dashboard");
  if (error || !data) {
    console.error("[vanta] vanta_dashboard rpc failed:", error?.message);
    return null;
  }

  const payload = data as unknown as DashboardData;
  const code = payload.referrals?.code ?? payload.profile?.referral_code ?? "";

  return {
    ...payload,
    referrals: {
      ...payload.referrals,
      link: `${siteUrl}/register?code=${code}`,
    },
  };
});

export async function getPublicLedger() {
  if (!isSupabaseConfigured) return null;

  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, created_at")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(8);

  return data;
}