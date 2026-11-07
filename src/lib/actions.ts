"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  emailForUsername,
  isSupabaseConfigured,
  normalizeUsername,
  parseReferralCode,
  usernamePattern,
} from "@/lib/supabase/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { planBySlug } from "@/lib/plans";

export type ActionState = {
  ok: boolean;
  message: string;
  field?: string;
};

const NOT_CONFIGURED =
  "The Vanta ledger is not connected. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run supabase/schema.sql and supabase/rpc.sql.";

function fail(message: string, field?: string): ActionState {
  return { ok: false, message, field };
}

/* ── Auth ────────────────────────────────────────────────────────────────── */

export async function signInAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const identifier = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) return fail("Enter your username and password.");

  const email = identifier.includes("@")
    ? identifier.toLowerCase()
    : emailForUsername(identifier);

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return fail(
      error.message.toLowerCase().includes("invalid")
        ? "Wrong username or password."
        : error.message,
    );
  }

  // Clear the cached shell for every route so /dashboard is not served from a
  // payload rendered before the session existed.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUpAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const referralCode = parseReferralCode(String(formData.get("ref") ?? ""));

  if (fullName.length < 3) return fail("Enter your full name.", "full_name");

  if (phone.replace(/\D/g, "").length < 9) {
    return fail("Enter a valid mobile money number.", "phone");
  }

  if (!usernamePattern.test(username)) {
    return fail("3–16 characters, letters, numbers or underscore.", "username");
  }

  if (password.length < 8) return fail("Password must be at least 8 characters.", "password");

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const email = emailForUsername(username);
  const metadata = {
    full_name: fullName,
    phone,
    username,
    referral_code: referralCode || null,
  };

  // Prefer the service-role path: username accounts have no real inbox, so the
  // profile is provisioned already-confirmed and the user is signed in at once.
  const admin = createAdminSupabase();
  if (admin) {
    const { error: adminError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (adminError) {
      return fail(
        /already|exists|registered/i.test(adminError.message)
          ? "That username is already taken."
          : adminError.message,
        "username",
      );
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return fail(signInError.message);

    // Clear the cached shell for every route so /dashboard is not served from a
    // payload rendered before the session existed.
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });

  if (error) {
    return fail(
      /already|exists|registered/i.test(error.message)
        ? "That username is already taken."
        : error.message,
      "username",
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      ok: true,
      message:
        "Account created. Email confirmation is required for this project — confirm the address or disable confirmations in Supabase Auth, then sign in.",
    };
  }

  // Clear the cached shell for every route so /dashboard is not served from a
  // payload rendered before the session existed.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/* ── Money movements ─────────────────────────────────────────────────────── */

export async function investAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get("plan") ?? "");
  const plan = planBySlug(slug);
  if (!plan) return fail("Select a plan to activate.");

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { error } = await supabase.rpc("vanta_create_investment", {
    p_plan_slug: plan.slug,
  });
  if (error) return fail(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/plans");
  revalidatePath("/dashboard/transactions");
  return {
    ok: true,
    message: `${plan.name} activated — ${plan.daily.toLocaleString()} will credit daily for ${plan.days} days.`,
  };
}

export async function depositAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "MTN MoMo");
  const reference = String(formData.get("reference") ?? "").trim();

  if (!Number.isFinite(amount) || amount < 20_000) {
    return fail("Minimum deposit is UGX 20,000.", "amount");
  }
  if (reference.length < 4) return fail("Enter the mobile money transaction ID.", "reference");

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { error } = await supabase.rpc("vanta_request_deposit", {
    p_amount: amount,
    p_method: method,
    p_reference: reference,
  });
  if (error) return fail(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/transactions");
  return { ok: true, message: "Deposit submitted — the desk confirms within 30 minutes." };
}

export async function withdrawAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "MTN MoMo");
  const destination = String(formData.get("destination") ?? "").trim();

  if (!Number.isFinite(amount) || amount < 20_000) {
    return fail("Minimum withdrawal is UGX 20,000.", "amount");
  }
  if (destination.replace(/\D/g, "").length < 9) {
    return fail("Enter the mobile money or account number.", "destination");
  }

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { error } = await supabase.rpc("vanta_request_withdrawal", {
    p_amount: amount,
    p_method: method,
    p_destination: destination,
  });
  if (error) return fail(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/transactions");
  return { ok: true, message: "Withdrawal queued — settlement within one working day." };
}

export async function claimEarningsAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const investmentId = String(formData.get("investment_id") ?? "");
  if (!investmentId) return fail("Missing investment reference.");

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { data, error } = await supabase.rpc("vanta_claim_earnings", {
    p_investment_id: investmentId,
  });
  if (error) return fail(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  return { ok: true, message: `Credited ${data ?? "today's earning"} to your wallet.` };
}

/* ── Profile ─────────────────────────────────────────────────────────────── */

export async function updateProfileAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (fullName.length < 3) return fail("Enter your full name.", "full_name");
  if (phone.replace(/\D/g, "").length < 9) {
    return fail("Enter a valid mobile money number.", "phone");
  }

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your session expired — sign in again.");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", user.id);
  if (error) return fail(error.message);

  revalidatePath("/dashboard/account");
  return { ok: true, message: "Profile updated." };
}

export async function ledgerConfigured(): Promise<boolean> {
  return isSupabaseConfigured;
}