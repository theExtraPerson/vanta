import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AdminDashboard, AdminMemberDetail } from "@/lib/admin/types";

/**
 * Server-side readers for the admin dashboard.
 *
 * Everything runs on the signed-in admin's own session (never the service
 * role) because the RPCs are security-definer functions that self-guard via
 * `vanta_admin_guard()` and stamp the acting admin onto the audit log. A
 * non-admin calling any of them gets FORBIDDEN from the database, so the UI
 * gate below is a convenience, not the security boundary.
 */

/** Cheap check used by the account page to decide whether to show the button. */
export async function isSessionAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const supabase = await createServerSupabase();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.rpc("vanta_is_admin_self");
  return data === true;
}

/** Throws (for the layout to catch) when the caller is not an admin. */
export async function requireAdmin() {
  if (!(await isSessionAdmin())) return null;
  const supabase = await createServerSupabase();
  return supabase;
}

export const getAdminDashboard = cache(
  async (query = ""): Promise<AdminDashboard | null> => {
    const supabase = await requireAdmin();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc("vanta_admin_dashboard", {
      p_member_query: query,
    });
    if (error || !data) {
      console.error("[vanta] vanta_admin_dashboard failed:", error?.message);
      return null;
    }

    return data as unknown as AdminDashboard;
  },
);

export async function getMemberDetail(userId: string): Promise<AdminMemberDetail | null> {
  const supabase = await requireAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("vanta_admin_member", { p_user_id: userId });
  if (error || !data) {
    console.error("[vanta] vanta_admin_member failed:", error?.message);
    return null;
  }

  return data as unknown as AdminMemberDetail;
}
