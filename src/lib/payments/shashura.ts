/**
 * SHASHURA Gateway client — mobile money collections and payouts for Uganda.
 * Docs: https://shashura.com/developers
 *
 * Server-side only. Everything is keyed off four environment variables:
 *   SHASHURA_CLIENT_ID, SHASHURA_CLIENT_SECRET, SHASHURA_ENV (sandbox|production)
 *   and SHASHURA_WEBHOOK_SECRET for inbound callbacks.
 *
 * Flow the ledger relies on:
 *   collect  POST /requestToPay  → USSD PIN prompt on the payer's phone
 *   pay out  POST /disburse      → money pushed to a wallet
 *   look up  GET  /enquiry/{ref} → PENDING | TS (success) | TF (failed)
 *   push     POST your callback  → `transaction.finalized` (HMAC signed)
 *
 * The gateway reference we send is always our own `DEP-…` / `WDR-…` string, so
 * a callback or an enquiry can be matched back to a ledger row without a second
 * identifier. References are unique per app: re-using one returns 409.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { isPaymentsConfigured, shashura } from "@/lib/supabase/config";

export { isPaymentsConfigured };

export type GatewayState = "PENDING" | "TS" | "TF";

export type GatewayFailure = { code: string; message: string };

export type CollectResult = {
  tid: string;
  state?: GatewayState;
  message?: string;
};

export type DisburseResult = {
  tid: string;
  /** `PENDING` for MTN (settles on callback), `TS` for Airtel (instant). */
  status?: string;
  amount?: number;
  charge?: number;
  message?: string;
};

export type EnquiryResult = {
  tid: string;
  external_ref: string;
  msisdn?: string;
  amount?: number;
  state: GatewayState;
  network_ref?: string;
  created_at?: string;
  failure?: GatewayFailure;
};

/** A gateway rejection, translated into something an investor can act on. */
export class GatewayError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(message: string, code = "GATEWAY_ERROR", httpStatus = 0) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** API codes plus operator failure codes, mapped to plain English. */
const EXPLAIN: Record<string, string> = {
  INVALID_INPUT: "The payment gateway rejected the amount or the phone number.",
  UNAUTHORIZED: "The payment gateway credentials were refused.",
  EXPIRED_TOKEN: "The payment gateway session expired.",
  INVALID_SECRET: "The payment gateway client secret does not match this app.",
  INVALID_APP: "No payment gateway app matches these credentials.",
  INSUFFICIENT_FUNDS:
    "There was not enough balance on that mobile money account for this transaction.",
  IP_NOT_WHITELISTED: "This server's IP address is not on the gateway allow-list.",
  NOT_FOUND: "The gateway has no record of that payment yet — try again in a minute.",
  METHOD_NOT_ALLOWED: "The gateway endpoint was called incorrectly.",
  DUPLICATE_REFERENCE: "That payment request was already sent — check your wallet balance.",
  WRONG_PIN: "The wrong PIN was entered on the phone prompt.",
  CANCELLED_BY_USER: "The payment prompt was cancelled on the phone.",
  TIMED_OUT: "The payment prompt on the phone timed out before an answer.",
  LIMIT_EXCEEDED: "That amount exceeds the mobile money account's transaction limit.",
  ACCOUNT_ERROR: "That mobile money account could not be reached.",
  PROVIDER_ERROR: "The mobile network reported an error — the request can be retried.",
  UNKNOWN: "The mobile network declined the transaction.",
  "Server Error": "The payment gateway reported an internal error.",
};

function explain(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return EXPLAIN[code] ?? fallback;
}

/* ── Auth ─────────────────────────────────────────────────────────────────── */

type TokenSlot = { token: string; expiresAt: number };

// Reuse the token across warm invocations; the gateway hands back the same
// token with its remaining lifetime if asked again before expiry.
const globalSlot = globalThis as unknown as { __vantaShashuraToken?: TokenSlot };

export async function accessToken(force = false): Promise<string> {
  if (!isPaymentsConfigured) {
    throw new GatewayError(
      "The payment gateway is not configured. Set SHASHURA_CLIENT_ID and SHASHURA_CLIENT_SECRET.",
      "NOT_CONFIGURED",
    );
  }

  const cached = globalSlot.__vantaShashuraToken;
  if (!force && cached && cached.expiresAt > Date.now()) return cached.token;

  const response = await fetch(`${shashura.baseUrl}/auth`, {
    method: "POST",
    headers: {
      "X-CLIENT-ID": shashura.clientId,
      "X-Target-Environment": shashura.environment,
      "X-COUNTRY": shashura.country,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: shashura.clientId,
      client_secret: shashura.clientSecret,
    }),
    cache: "no-store",
  });

  const payload = await readJson<{
    status?: string;
    code?: string;
    message?: string;
    data?: { access_token?: string; expires_in?: number };
  }>(response, "Could not sign in to the payment gateway.");

  const token = payload.data?.access_token;
  if (!token) {
    throw new GatewayError(
      explain(payload.code, "The payment gateway refused our credentials."),
      payload.code ?? "INVALID_APP",
      response.status,
    );
  }

  const seconds = payload.data?.expires_in ?? 3600;
  globalSlot.__vantaShashuraToken = { token, expiresAt: Date.now() + (seconds - 60) * 1000 };
  return token;
}

/* ── Calls ────────────────────────────────────────────────────────────────── */

type Envelope<T> = {
  status?: string;
  code?: string;
  message?: string;
  data?: T;
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<Envelope<T>> {
  return send<T>("POST", path, body, false);
}

async function send<T>(
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | undefined,
  retried: boolean,
): Promise<Envelope<T>> {
  const token = await accessToken(retried);

  const response = await fetch(`${shashura.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-CLIENT-ID": shashura.clientId,
      "X-Target-Environment": shashura.environment,
      "X-COUNTRY": shashura.country,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  // A token that expired mid-deploy is worth exactly one retry.
  if (response.status === 401 && !retried) {
    globalSlot.__vantaShashuraToken = undefined;
    return send<T>(method, path, body, true);
  }

  const payload = await readJson<Envelope<T>>(
    response,
    `The payment gateway did not answer (${path}).`,
  );

  if (payload.status && payload.status !== "success") {
    throw new GatewayError(
      explain(payload.code, payload.message ?? "The payment gateway refused this request."),
      payload.code ?? "GATEWAY_ERROR",
      response.status,
    );
  }

  return payload;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const envelope = (parsed ?? {}) as { code?: string; message?: string };
    throw new GatewayError(
      explain(envelope.code, envelope.message ?? fallback),
      envelope.code ?? "GATEWAY_ERROR",
      response.status,
    );
  }

  return (parsed ?? {}) as T;
}

/**
 * Collection: pushes a PIN prompt to the payer. Returns 202 as soon as the
 * prompt is delivered — the money only lands after the payer approves, so the
 * ledger is written by the callback (or by `enquiry` when polling).
 */
export async function requestToPay(input: {
  msisdn: string;
  amount: number;
  reference: string;
}): Promise<CollectResult> {
  const payload = await post<{
    tid?: string;
    state?: GatewayState;
    status?: string;
    message?: string;
  }>("/requestToPay", {
    msisdn: input.msisdn,
    amount: Math.round(input.amount),
    reference: input.reference,
  });

  const data = payload.data ?? {};
  if (!data.tid) {
    throw new GatewayError(
      data.message ?? "The gateway did not start the payment prompt.",
      "NO_TID",
    );
  }

  return { tid: data.tid, state: data.state, message: data.message };
}

/** Disbursement: pays money out to a wallet, funded by the merchant balance. */
export async function disburse(input: {
  msisdn: string;
  amount: number;
  reference: string;
  remarks?: string;
}): Promise<DisburseResult> {
  const payload = await post<{
    tid?: string;
    status?: string;
    amount?: number;
    charge?: number;
    message?: string;
  }>("/disburse", {
    msisdn: input.msisdn,
    amount: Math.round(input.amount),
    reference: input.reference,
    remarks: input.remarks ?? "Vanta Fintech payout",
  });

  const data = payload.data ?? {};
  if (!data.tid) {
    throw new GatewayError(
      data.message ?? "The gateway did not accept the payout.",
      "NO_TID",
    );
  }

  return {
    tid: data.tid,
    status: data.status,
    amount: data.amount,
    charge: data.charge,
    message: data.message,
  };
}

/** Status lookup by our reference or the gateway's tid. */
export async function enquiry(identifier: string): Promise<EnquiryResult | null> {
  const payload = await send<EnquiryResult | null>(
    "GET",
    `/enquiry/${encodeURIComponent(identifier)}`,
    undefined,
    false,
  );

  const data = payload.data;
  if (!data || !data.state) return null;
  return data;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Normalises any way a Ugandan writes their number into the gateway's
 * international MSISDN (2567XXXXXXXX). Mirrors vanta_normalize_msisdn():
 * subscribers are 07… (MTN and Airtel) or 03… (Utel), so the operator digit is
 * not validated here — the gateway reports LIMIT/ACCOUNT errors instead.
 */
export function normalizeMsisdn(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");

  if (/^2560\d{9}$/.test(digits)) return `256${digits.slice(4)}`;
  if (/^256\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `256${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `256${digits}`;
  return null;
}

/** Maps an enquiry answer onto the callback payload shape the ledger reads. */
export function enquiryToEvent(
  enquiry: EnquiryResult,
  type: "COLLECTION" | "DISBURSEMENT" = enquiry.external_ref?.startsWith("WDR")
    ? "DISBURSEMENT"
    : "COLLECTION",
): Record<string, unknown> {
  return {
    event: "transaction.finalized",
    environment: shashura.environment,
    tid: enquiry.tid,
    external_ref: enquiry.external_ref,
    type,
    status: enquiry.state === "TS" ? "SUCCESSFUL" : enquiry.state === "TF" ? "FAILED" : "PENDING",
    amount: enquiry.amount,
    msisdn: enquiry.msisdn,
    network_ref: enquiry.network_ref,
    timestamp: enquiry.created_at,
    ...(enquiry.failure ? { failure: enquiry.failure } : {}),
  };
}

/**
 * Verifies the `X-Shashura-Signature` header: HMAC-SHA256 of the raw body
 * keyed with the app's webhook secret. Unsigned payloads are refused outright —
 * settle money through the enquiry endpoint while developing instead.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !shashura.webhookSecret) return false;

  const expected = createHmac("sha256", shashura.webhookSecret).update(rawBody, "utf8").digest("hex");
  const given = signature.trim().replace(/^sha256=/i, "");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/** Gateway-side state → the ledger's three-way view. */
export function stateFromGateway(value?: string): GatewayState {
  const v = (value ?? "").toUpperCase();
  if (v === "TS" || v === "SUCCESSFUL" || v === "COMPLETED") return "TS";
  if (v === "TF" || v === "FAILED" || v === "REJECTED") return "TF";
  return "PENDING";
}
