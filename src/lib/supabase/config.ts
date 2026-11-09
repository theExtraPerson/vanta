export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Supabase auth is email based, but Vanta accounts are created with a username
 * and a mobile number only. Every username is mapped onto a deterministic
 * address inside the platform domain, so `username + password` is all a user
 * ever needs to sign in.
 */
export const USERNAME_DOMAIN = process.env.NEXT_PUBLIC_USERNAME_DOMAIN ?? "vantatech.online";

export const usernamePattern = /^[a-z0-9_]{3,16}$/;
export const referralCodePattern = /^[A-Z0-9]{5,12}$/;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export function emailForUsername(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

/**
 * Accepts whatever an invitee pastes into the referral field — a bare code, a
 * `?code=` query string or a full invite link — and returns the code itself.
 */
export function parseReferralCode(raw: string) {
  const value = raw.trim();
  if (!value) return "";

  const fromQuery = value.match(/[?&]code=([^&\s]+)/i);
  const candidate = fromQuery
    ? decodeURIComponent(fromQuery[1])
    : value.split(/[/?#]/).filter(Boolean).pop() ?? value;

  return candidate.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12);
}

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/**
 * Money rules. The database enforces the same figures in rpc.sql — these exist
 * so the forms can state them before a round-trip. UGX throughout.
 */
export const minDeposit = Number(process.env.NEXT_PUBLIC_MIN_DEPOSIT ?? 10_000);
export const minWithdrawal = Number(process.env.NEXT_PUBLIC_MIN_WITHDRAWAL ?? 5_000);

/** Platform clock: all schedules are read in Ugandan local time. */
export const platformTimezone = process.env.NEXT_PUBLIC_PLATFORM_TZ ?? "Africa/Kampala";

/** Daily earnings mature at 22:00 local time. */
export const earningsMatureAt = process.env.NEXT_PUBLIC_EARNINGS_MATURE_AT ?? "22:00";

/** Withdrawals are only accepted between 09:00 and 22:00 local time. */
export const withdrawalOpensAt = process.env.NEXT_PUBLIC_WITHDRAWAL_OPENS ?? "09:00";
export const withdrawalClosesAt = process.env.NEXT_PUBLIC_WITHDRAWAL_CLOSES ?? "22:00";

/**
 * Platform fee cut from every withdrawal before the member is paid (percent).
 * The live value comes from the withdrawal_fee_percent setting; this mirror
 * only seeds the form hint before the rules round-trip.
 */
export const withdrawalFeePercent = Number(process.env.NEXT_PUBLIC_WITHDRAWAL_FEE_PERCENT ?? 16);

/* ── Shashura mobile-money gateway (server only) ─────────────────────────────
 * https://shashura.com/developers — collections (requestToPay) and payouts
 * (disburse). Secrets stay on the server: none of these are NEXT_PUBLIC_.
 */
export const shashura = {
  baseUrl: (process.env.SHASHURA_BASE_URL ?? "https://shashura.com/api/v1").replace(/\/$/, ""),
  clientId: process.env.SHASHURA_CLIENT_ID ?? "",
  clientSecret: process.env.SHASHURA_CLIENT_SECRET ?? "",
  /** `sandbox` or `production` — sent as the X-Target-Environment header. */
  environment: (process.env.SHASHURA_ENV ?? "sandbox") as "sandbox" | "production",
  country: process.env.SHASHURA_COUNTRY ?? "UG",
  webhookSecret: process.env.SHASHURA_WEBHOOK_SECRET ?? "",
};

export const isPaymentsConfigured = Boolean(shashura.clientId && shashura.clientSecret);