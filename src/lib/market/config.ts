/**
 * Live market data for the dashboard wire and signal board.
 *
 * Quintaris ships two feeds on its dashboard — a "Latest News" card slider and
 * a "Live Markets" price list — but both of its endpoints
 * (`/api/crypto-news`, `/api/coin-rates`) answer anonymous requests with a 302
 * to `/auth/login`, so nothing outside a logged-in Quintaris session can read
 * them. Vanta therefore goes to the same upstreams those endpoints proxy:
 *
 *   headlines  → public crypto news wires (RSS), default CoinTelegraph
 *   prices     → Binance public market data (keyless `data-api.binance.vision`)
 *
 * Nothing here needs a key, and every source is overridable in .env.local.
 * Server-side only, except the two NEXT_PUBLIC_ knobs the widgets read.
 */

function intEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/** Comma-separated RSS/Atom feed URLs, queried in parallel. */
export const newsFeedUrls: string[] = (
  process.env.NEWS_FEED_URLS ?? "https://cointelegraph.com/rss,https://decrypt.co/feed"
)
  .split(",")
  .map((url) => url.trim())
  .filter((url) => url.startsWith("http"));

/** How many headlines the wire is allowed to hold. */
export const newsLimit = intEnv(process.env.NEWS_LIMIT, 12, 4, 24);

/** Server-side TTL for parsed headlines — wires do not move faster. */
export const newsCacheSeconds = intEnv(process.env.NEWS_CACHE_SECONDS, 300, 60, 3600);

/** Label used when a feed carries no source of its own. */
export const newsWireLabel = process.env.NEWS_WIRE_LABEL ?? "Market wire";

/* ── Signals ─────────────────────────────────────────────────────────────── */

/** Binance spot symbols, in display order. Max 8 keeps the panel scannable. */
export const signalSymbols: string[] = (
  process.env.SIGNAL_SYMBOLS ?? "BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,LTCUSDT,TRXUSDT"
)
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s) => /^[A-Z]{2,10}(USDT|BTC|ETH)$/.test(s))
  .slice(0, 8);

/** Public market-data host. `api.binance.com` is the alternative. */
export const binanceBaseUrl = (
  process.env.BINANCE_BASE_URL ?? "https://data-api.binance.vision"
).replace(/\/$/, "");

/** Candles pulled per symbol: enough for RSI-14, EMA 9/21 and a real spark. */
export const signalHistoryBars = intEnv(process.env.SIGNAL_HISTORY_BARS, 100, 40, 500);
export const signalInterval = (process.env.SIGNAL_INTERVAL ?? "1h") as string;

/** Server-side TTL for the computed signals. */
export const signalCacheSeconds = intEnv(process.env.SIGNAL_CACHE_SECONDS, 45, 15, 600);

/* ── Knobs the widgets read (inlined at build) ────────────────────────────── */

/** How often the dashboard re-polls `/api/market`. */
export const marketRefreshSeconds = intEnv(process.env.NEXT_PUBLIC_MARKET_REFRESH_SECONDS, 45, 15, 300);

/** News card auto-advance cadence. Reduced-motion users never auto-advance. */
export const newsAutoAdvanceSeconds = intEnv(process.env.NEXT_PUBLIC_NEWS_AUTO_ADVANCE_SECONDS, 5, 3, 12);

/** Master off-switch for both widgets: `NEXT_PUBLIC_MARKET_FEEDS=off`. */
export const marketFeedsEnabled = process.env.NEXT_PUBLIC_MARKET_FEEDS !== "off";

/** Friendly names for the base asset, so rows read "Bitcoin" not "BTCUSDT". */
export const assetNames: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XRP: "XRP",
  LTC: "Litecoin",
  TRX: "TRON",
  ADA: "Cardano",
  BNB: "BNB",
  DOGE: "Dogecoin",
  LINK: "Chainlink",
  AVAX: "Avalanche",
  TON: "Toncoin",
};
