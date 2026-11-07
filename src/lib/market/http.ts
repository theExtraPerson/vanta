/**
 * Fetch helpers for the market widgets. Server-side only.
 *
 * Upstreams are third parties we do not control, so every call is bounded: a
 * feed that hangs must degrade to "stale data" rather than stall a render.
 */

/** Some wires reject a headless client, so identify the dashboard politely. */
const USER_AGENT = process.env.MARKET_USER_AGENT ?? "VantaFintech/1.0 (dashboard market wire)";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

async function send(url: string, timeoutMs: number, accept: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept },
      // Our own TTL cache owns freshness; Next must not add a layer on top.
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new UpstreamError(`${new URL(url).host} is unreachable (${reason})`);
  }

  if (!response.ok) {
    throw new UpstreamError(`${new URL(url).host} responded ${response.status}`, response.status);
  }

  return response;
}

export async function fetchText(url: string, timeoutMs = 6_000): Promise<string> {
  const response = await send(url, timeoutMs, "application/rss+xml, application/xml, text/xml, */*");
  return response.text();
}

export async function fetchJson<T>(url: string, timeoutMs = 6_000): Promise<T> {
  const response = await send(url, timeoutMs, "application/json");
  return (await response.json()) as T;
}
