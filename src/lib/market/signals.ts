/**
 * The dashboard signal board.
 *
 * Quintaris shows a "LIVE MARKETS" list (four prices and a sparkline that is
 * two hard-coded polylines swapped on direction) and TradingView chart
 * embeds, but no signals at all — searching its pages for BUY / SELL / HOLD
 * returns nothing. This widget goes one step further and derives an actual
 * indicator reading from real candles, so the panel is live in more than name:
 *
 *   · prices and 24h stats come from Binance's public `/ticker/24hr`
 *   · RSI-14, EMA 9/21, 24-bar ROC and volume thrust are computed here from
 *     `/klines`, on *closed* bars only — the in-progress hour has a partial
 *     volume that would distort the thrust
 *   · the sparkline is the last 24 real closes, not a decorative stub
 *
 * The composite score is a transparent weighted sum, not a prediction: it is
 * market information, deliberately labelled as nothing more on the screen.
 */

import {
  assetNames,
  binanceBaseUrl,
  signalCacheSeconds,
  signalHistoryBars,
  signalInterval,
  signalSymbols,
} from "@/lib/market/config";
import { UpstreamError, fetchJson } from "@/lib/market/http";
import { swr, type SwrResult } from "@/lib/market/cache";
import type { MarketSignal, SignalAction } from "@/lib/types";

export const SIGNALS_CACHE_KEY = "market:signals";

type RawTicker = {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
};

/** [openTime, open, high, low, close, volume, closeTime, quoteVolume, …] */
type Kline = [number, string, string, string, string, string, number, string, ...unknown[]];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Wilder's RSI — the smoothing that every charting package actually ships. */
export function wilderRsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** EMA seeded with the SMA of the first `period` values, then smoothed. */
export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;

  let acc = values.slice(0, period).reduce((sum, v) => sum + v, 0);
  let previous = acc / period;
  const k = 2 / (period + 1);

  for (let i = period; i < values.length; i += 1) {
    previous = values[i] * k + previous * (1 - k);
  }

  return previous;
}

/** Real 24-bar price path, normalised into the 60×28 viewBox of the row. */
export function sparkPoints(closes: number[], width = 60, height = 28, pad = 3): string {
  const series = closes.slice(-24);
  if (series.length < 2) return "";

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = width / (series.length - 1);

  return series
    .map((value, index) => {
      const x = index * stepX;
      const y = height - pad - ((value - min) / span) * (height - pad * 2);
      return `${round(x, 1)},${round(y, 1)}`;
    })
    .join(" ");
}

function baseOf(symbol: string): { base: string; quote: string } {
  for (const quote of ["USDT", "BTC", "ETH"]) {
    if (symbol.endsWith(quote)) return { base: symbol.slice(0, -quote.length), quote };
  }
  return { base: symbol, quote: "" };
}

function cautionFor(action: SignalAction, rsi: number, rangePosition: number): string | null {
  if (action === "buy") {
    if (rsi >= 75) return `overbought at RSI ${round(rsi, 0)} — late entry`;
    if (rangePosition >= 92) return "trading at the top of its 24h range";
  }
  if (action === "sell") {
    if (rsi <= 25) return `oversold at RSI ${round(rsi, 0)} — squeeze risk`;
    if (rangePosition <= 8) return "trading at the bottom of its 24h range";
  }
  return null;
}

/**
 * One row of the board. `klines` and `closes` are the *closed* bars only (the
 * caller already dropped the in-progress hour), so every indicator describes a
 * completed bar while `price` stays the live print.
 */
function evaluate(
  symbol: string,
  ticker: RawTicker,
  klines: Kline[],
  closes: number[],
  price: number,
): MarketSignal | null {
  const { base, quote } = baseOf(symbol);

  const change = Number(ticker.priceChangePercent);
  const high = Number(ticker.highPrice);
  const low = Number(ticker.lowPrice);
  if (!Number.isFinite(change)) return null;

  const rsi = wilderRsi(closes, 14);
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  if (rsi === null || fast === null || slow === null) return null;

  const spreadPct = ((fast - slow) / price) * 100;

  const bars = Math.min(24, closes.length - 1);
  const reference = closes[closes.length - 1 - bars];
  const roc = reference > 0 ? ((closes[closes.length - 1] - reference) / reference) * 100 : 0;

  const quoteVolumes = klines.map((k) => Number(k[7]) || 0).filter((v) => v > 0);
  // The 20 bars before the newest closed one — the classic volume-thrust base.
  const window = quoteVolumes.slice(-21, -1);
  const averageVolume = window.length ? window.reduce((sum, v) => sum + v, 0) / window.length : 0;
  const lastVolume = quoteVolumes.at(-1) ?? 0;
  const volumeRatio = averageVolume > 0 ? lastVolume / averageVolume : 1;

  const rangePosition = high > low ? clamp(((price - low) / (high - low)) * 100, 0, 100) : 50;

  // Weighted sum: trend is the loudest voice, momentum confirms it, RSI
  // displaces it and volume only amplifies the direction already taken.
  const trendScore = clamp(spreadPct / 0.8, -1, 1) * 34;
  const momentumScore = clamp(roc / 5, -1, 1) * 26;
  const rsiScore = clamp((rsi - 50) / 22, -1, 1) * 20;
  const volumeScore = clamp(volumeRatio - 1, 0, 1) * 10 * (spreadPct >= 0 ? 1 : -1);

  const score = clamp(
    Math.round(trendScore + momentumScore + rsiScore + volumeScore),
    -100,
    100,
  );

  const action: SignalAction = score >= 25 ? "buy" : score <= -25 ? "sell" : "neutral";

  const bullVotes = [spreadPct > 0, roc > 0, rsi > 50].filter(Boolean).length;
  const aligned =
    action === "sell" ? 3 - bullVotes : action === "buy" ? bullVotes : Math.max(bullVotes, 3 - bullVotes);

  const sparkSeries = [...closes.slice(-23), price];

  return {
    symbol,
    base,
    quote,
    name: assetNames[base] ?? base,
    price,
    change_pct_24h: change,
    high_24h: Number.isFinite(high) ? high : price,
    low_24h: Number.isFinite(low) ? low : price,
    range_position: round(rangePosition, 0),
    rsi: round(rsi, 1),
    ema_spread_pct: round(spreadPct, 2),
    roc_pct: round(roc, 2),
    volume_ratio: round(volumeRatio, 2),
    score,
    action,
    strength: Math.min(99, Math.abs(score)),
    aligned,
    caution: cautionFor(action, rsi, rangePosition),
    spark: sparkPoints(sparkSeries),
    spark_up: sparkSeries[sparkSeries.length - 1] >= sparkSeries[0],
    updated_at: new Date().toISOString(),
  };
}

async function produce(): Promise<MarketSignal[]> {
  if (!signalSymbols.length) throw new UpstreamError("No market symbols are configured.");

  const query = encodeURIComponent(JSON.stringify(signalSymbols));
  const tickers = await fetchJson<RawTicker[]>(
    `${binanceBaseUrl}/api/v3/ticker/24hr?symbols=${query}`,
    7_000,
  );

  // One symbol failing to return candles must not blank the whole board.
  const histories = await Promise.allSettled(
    signalSymbols.map((symbol) =>
      fetchJson<Kline[]>(
        `${binanceBaseUrl}/api/v3/klines?symbol=${symbol}&interval=${signalInterval}&limit=${signalHistoryBars}`,
        7_000,
      ),
    ),
  );

  const bySymbol = new Map(tickers.map((t) => [t.symbol, t]));
  const rows: MarketSignal[] = [];

  for (const [index, symbol] of signalSymbols.entries()) {
    const ticker = bySymbol.get(symbol);
    const history = histories[index];
    if (!ticker || history?.status !== "fulfilled") continue;

    // Drop the in-progress bar before any indicator touches the series.
    const closed = history.value.filter((bar) => Array.isArray(bar) && bar.length >= 8);
    const closes = closed.map((k) => Number(k[4])).filter(Number.isFinite);
    const price = Number(ticker.lastPrice);

    if (closes.length < 30 || !Number.isFinite(price) || price <= 0) continue;

    const row = evaluate(symbol, ticker, closed, closes, price);
    if (row) rows.push(row);
  }

  if (!rows.length) throw new UpstreamError("Binance returned no usable candles.");

  return rows;
}

export function getSignals(blocking = false): Promise<SwrResult<MarketSignal[]>> {
  return swr(SIGNALS_CACHE_KEY, {
    ttlMs: signalCacheSeconds * 1_000,
    produce,
    blocking,
    budgetMs: blocking ? 8_000 : 5_000,
  });
}
