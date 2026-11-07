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

export const minDeposit = Number(process.env.NEXT_PUBLIC_MIN_DEPOSIT ?? 20_000);
export const minWithdrawal = Number(process.env.NEXT_PUBLIC_MIN_WITHDRAWAL ?? 20_000);