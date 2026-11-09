"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  earningsMatureAt,
  emailForUsername,
  isSupabaseConfigured,
  minDeposit,
  minWithdrawal,
  normalizeUsername,
  parseReferralCode,
  usernamePattern,
  withdrawalClosesAt,
  withdrawalOpensAt,
} from "@/lib/supabase/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { planBySlug } from "@/lib/plans";
import { ugx } from "@/lib/format";
import {
  GatewayError,
  isPaymentsConfigured,
  normalizeMsisdn,
  requestToPay,
  stateFromGateway,
} from "@/lib/payments/shashura";
import { reconcileOpenPayments } from "@/lib/payments/reconcile";

export type ActionState = {
  ok: boolean;
  message: string;
  field?: string;
};

const NOT_CONFIGURED =
  "The Vanta ledger is not connected. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run supabase/schema.sql and supabase/rpc.sql.";

const NO_GATEWAY =
  "The mobile money provider is not configured on this deployment (SHASHURA_CLIENT_ID / SHASHURA_CLIENT_SECRET).";

function fail(message: string, field?: string): ActionState {
  return { ok: false, message, field };
}

/**
 * The RPCs raise named exceptions (`MIN_DEPOSIT: …`). Turn the code into a
 * sentence an investor can act on, and point at the field that caused it.
 */
const DB_HINTS: Record<string, { message: string; field?: string }> = {
  NOT_AUTHENTICATED: { message: "Your session expired — sign in again." },
  PROFILE_NOT_FOUND: { message: "We could not find your wallet. Please contact support." },
  MIN_DEPOSIT: { message: `Minimum top-up is ${ugx(minDeposit)}.`, field: "amount" },
  MIN_WITHDRAWAL: { message: `Minimum withdrawal is ${ugx(minWithdrawal)}.`, field: "amount" },
  MAX_DEPOSIT: { message: `One top-up can be at most ${ugx(5_000_000)}.`, field: "amount" },
  ODD_AMOUNT: { message: "Enter a whole number of shillings.", field: "amount" },
  MSISDN_INVALID: {
    message: "Enter a valid mobile money number (077…, 070…, or 25677…).",
    field: "phone",
  },
  WITHDRAWAL_WINDOW: {
    message: `Withdrawals open from ${withdrawalOpensAt} to ${withdrawalClosesAt} (EAT).`,
  },
  DEPOSIT_PENDING: {
    message: "Your last top-up is still waiting for approval on your phone.",
  },
  INSUFFICIENT_BALANCE: { message: "Not enough balance in your wallet.", field: "amount" },
  INSUFFICIENT_FUNDS: {
    message: "The mobile money account does not have enough balance for this amount.",
    field: "amount",
  },
  EARNING_NOT_DUE: {
    message: `This earning matures at ${earningsMatureAt} EAT — come back after that.`,
  },
  INVESTMENT_COMPLETED: { message: "This cycle is already complete." },
  INVESTMENT_NOT_FOUND: { message: "We could not find that plan." },
  PLAN_NOT_FOUND: { message: "That plan is no longer on offer." },
  ACCOUNT_RESTRICTED: {
    message: "This account is restricted. Please contact customer service.",
  },
  FORBIDDEN: { message: "That movement is handled by our operations desk." },
};

function fromDbError(raw: string, fallback?: string): ActionState {
  const text = (raw ?? "").trim();
  const head = text.split(":")[0]?.trim().toUpperCase() ?? "";
  const hint = DB_HINTS[head];

  if (hint) return fail(hint.message, hint.field);
  // detail only, or a raw driver message
  const detail = text.split(":").slice(1).join(":").trim();
  return fail(detail || text || fallback || "Something went wrong — please try again.");
}

/** Calls a service-role RPC; a missing key is a deployment problem, not a user error. */
async function rpcAsAdmin(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const admin = createAdminSupabase();
  if (!admin) {
    console.error(`[vanta] SUPABASE_SERVICE_ROLE_KEY missing — cannot run ${fn}`);
    return null;
  }

  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    console.error(`[vanta] ${fn} failed:`, error.message);
    return null;
  }

  return typeof data === "string" ? data : null;
}

function revalidateWallet() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/transactions");
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
  if (error) return fromDbError(error.message);

  revalidateWallet();
  return {
    ok: true,
    message: `${plan.name} activated — ${plan.daily.toLocaleString()} will credit daily for ${plan.days} days, each day maturing at ${earningsMatureAt} EAT.`,
  };
}

/**
 * Deposit = SHASHURA collection. The RPC books the pending movement and gives
 * us the gateway reference, /requestToPay pushes a PIN prompt to the payer's
 * phone, and the wallet is credited later by the signed callback (or by
 * reconcilePaymentsAction when no callback has reached this deployment).
 */
export async function depositAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const amount = Number(formData.get("amount"));
  const phone = String(formData.get("phone") ?? "").trim();
  const method = String(formData.get("method") ?? "MTN MoMo");

  if (!Number.isFinite(amount) || amount < minDeposit) {
    return fail(`Minimum top-up is ${ugx(minDeposit)}.`, "amount");
  }
  if (!normalizeMsisdn(phone)) {
    return fail("Enter the mobile money number to charge.", "phone");
  }

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { data, error } = await supabase.rpc("vanta_start_deposit", {
    p_amount: Math.round(amount),
    p_msisdn: phone,
    p_method: method,
  });
  if (error) return fromDbError(error.message);

  const request = data as unknown as {
    deposit_id: string;
    reference: string;
    amount: number;
    msisdn: string;
  };

  if (!isPaymentsConfigured) {
    await rpcAsAdmin("vanta_set_deposit_gateway", {
      p_deposit_id: request.deposit_id,
      p_tid: null,
      p_state: "TF",
      p_code: "NOT_CONFIGURED",
      p_message: "Payment provider keys are missing on this deployment.",
    });
    revalidateWallet();
    return fail(NO_GATEWAY);
  }

  try {
    const pushed = await requestToPay({
      msisdn: request.msisdn,
      amount: request.amount,
      reference: request.reference,
    });

    const state = stateFromGateway(pushed.state);
    await rpcAsAdmin("vanta_set_deposit_gateway", {
      p_deposit_id: request.deposit_id,
      p_tid: pushed.tid,
      p_state: state,
      p_code: null,
      p_message: null,
    });
    revalidateWallet();

    if (state === "TS") {
      return { ok: true, message: `${ugx(request.amount)} received — your wallet is credited.` };
    }

    return {
      ok: true,
      message: `Dial prompt sent to ${request.msisdn}. Enter your mobile money PIN to pay ${ugx(
        request.amount,
      )} — the wallet credits the moment it clears.`,
    };
  } catch (err) {
    const gateway = err instanceof GatewayError ? err : null;

    await rpcAsAdmin("vanta_set_deposit_gateway", {
      p_deposit_id: request.deposit_id,
      p_tid: null,
      p_state: "TF",
      p_code: gateway?.code ?? "GATEWAY_ERROR",
      p_message: gateway?.message ?? "The payment provider did not answer.",
    });
    revalidateWallet();

    return fail(
      gateway
        ? gateway.message
        : "We could not reach the payment provider. Nothing was charged — please try again.",
    );
  }
}

/**
 * Withdrawal request. The RPC checks the rules, cuts the platform fee
 * (withdrawal_fee_percent, published default 16%) and holds the gross amount.
 * Nothing is paid from here: the request waits in the payout desk queue,
 * where an admin approves it and chooses the route — a gateway disbursement
 * of the net (vanta_admin_disburse_withdrawal) or a direct manual payment.
 * A refused request returns the hold to the wallet.
 */
export async function withdrawAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const amount = Number(formData.get("amount"));
  const phone = String(formData.get("phone") ?? formData.get("destination") ?? "").trim();
  const method = String(formData.get("method") ?? "MTN MoMo");

  if (!Number.isFinite(amount) || amount < minWithdrawal) {
    return fail(`Minimum withdrawal is ${ugx(minWithdrawal)}.`, "amount");
  }
  if (!normalizeMsisdn(phone)) {
    return fail("Enter the mobile money number to pay into.", "phone");
  }

  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { data, error } = await supabase.rpc("vanta_start_withdrawal", {
    p_amount: Math.round(amount),
    p_msisdn: phone,
    p_method: method,
  });
  if (error) return fromDbError(error.message);

  const request = data as unknown as {
    reference: string;
    amount: number;
    fee?: number;
    net_amount?: number;
    msisdn: string;
  };
  const fee = request.fee ?? 0;
  const net = request.net_amount ?? request.amount;

  revalidateWallet();
  return {
    ok: true,
    message: `${ugx(net)} queued for approval (fee ${ugx(fee)} cut). An admin will approve it and pay ${request.msisdn} through the network or by hand.`,
  };
}

/**
 * "Check status": asks the gateway for the final state of this investor's open
 * movements and settles whatever it can through the same RPC the callback uses.
 * It is also the only way to confirm money on a machine the gateway cannot
 * reach, so the wallet screen always offers it.
 */
export async function reconcilePaymentsAction(): Promise<ActionState> {
  const supabase = await createServerSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);
  if (!isPaymentsConfigured) return fail(NO_GATEWAY);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your session expired — sign in again.");

  const summary = await reconcileOpenPayments({ userId: user.id });
  revalidateWallet();

  if (!summary.checked) {
    return { ok: true, message: "Nothing is waiting on the network right now." };
  }

  const parts = [
    summary.settled ? `${summary.settled} confirmed` : "",
    summary.failed ? `${summary.failed} declined` : "",
  ].filter(Boolean);

  if (parts.length) return { ok: true, message: `Wallet updated — ${parts.join(" and ")}.` };

  return {
    ok: true,
    message: "Still waiting for the network — approve the prompt on your phone if it is on screen.",
  };
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
  if (error) return fromDbError(error.message);

  revalidateWallet();
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