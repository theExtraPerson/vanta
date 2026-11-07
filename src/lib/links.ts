import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { brand } from "@/lib/brand";

/**
 * Live Telegram links. The ops desk can retarget the community group, the
 * support chat and the handle without a redeploy (platform_settings keys);
 * these readers fall back to the compiled-in brand defaults whenever the
 * ledger is unavailable so the floating desk never disappears.
 */

export type TelegramLinks = {
  community: string;
  support: string;
  handle: string;
};

const FALLBACK: TelegramLinks = {
  community: brand.community,
  support: brand.supportTelegram,
  handle: brand.supportHandle,
};

export const getTelegramLinks = cache(async (): Promise<TelegramLinks> => {
  if (!isSupabaseConfigured) return FALLBACK;

  const supabase = await createServerSupabase();
  if (!supabase) return FALLBACK;

  const { data, error } = await supabase.rpc("vanta_links");
  if (error || !data) return FALLBACK;

  const raw = data as Partial<TelegramLinks>;
  const url = (v: unknown, fb: string) =>
    typeof v === "string" && /^https?:\/\//.test(v) ? v : fb;
  return {
    community: url(raw.community, FALLBACK.community),
    support: url(raw.support, FALLBACK.support),
    handle: typeof raw.handle === "string" && raw.handle ? raw.handle : FALLBACK.handle,
  };
});
