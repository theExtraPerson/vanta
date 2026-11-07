import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Server-side Supabase client bound to the current request's cookie jar.
 * Returns null when the project has not been configured yet.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render — safe to ignore because
          // the auth callback route handles the cookie refresh.
        }
      },
    },
  });
}

export type SessionUser = {
  id: string;
  email: string | null;
  fullName: string;
  referralCode: string;
};

/** Returns the signed-in user, or null when anonymous. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, referral_code")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      profile?.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      "Vanta Investor",
    referralCode: profile?.referral_code ?? "VANTA",
  };
}
