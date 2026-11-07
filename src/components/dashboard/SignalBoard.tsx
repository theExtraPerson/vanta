"use client";

import { useMarketFeed } from "@/lib/market/client";
import { ACTION_STYLE, glyphFor } from "@/lib/market/presentation";
import { clockTime, signedPct, usd } from "@/lib/format";
import type { MarketFeed, MarketSignal } from "@/lib/types";

/**
 * The dashboard signal board.
 *
 * Quintaris stops at a "LIVE MARKETS" list: four prices, a 24h badge and a
 * sparkline whose points are two hard-coded polylines swapped on direction, so
 * every coin draws the identical shape. Here the polyline is the last 24 real
 * hourly closes, and each row carries an actual reading — RSI-14, the EMA 9/21
 * spread, 24-bar rate of change and volume thrust, combined into a directional
 * bias on the server (see src/lib/market/signals.ts).
 *
 * It is indicator output, not advice, and the footer says so in plain words.
 */

function Row({ signal, index }: { signal: MarketSignal; index: number }) {
  const style = ACTION_STYLE[signal.action] ?? ACTION_STYLE.neutral;
  const up = signal.change_pct_24h >= 0;
  const sparkStroke = signal.spark_up ? "var(--color-mint)" : "#ff5252";

  return (
    <li
      className="card-in border-b border-white/5 px-3 py-2.5 last:border-b-0"
      style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-electric/16 bg-navy-900 font-display text-[13px] font-bold text-electric">
          {glyphFor(signal.base)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-display text-[12px] leading-none font-bold text-white">
            {signal.base}
            <span className="text-slate-deep">/{signal.quote}</span>
          </p>
          <p className="mt-1 truncate text-[9.5px] text-slate-deep">{signal.name}</p>
        </div>

        {signal.spark ? (
          <svg
            viewBox="0 0 60 28"
            preserveAspectRatio="none"
            className="h-7 w-[55px] shrink-0"
            aria-hidden="true"
          >
            <polyline
              points={signal.spark}
              fill="none"
              stroke={sparkStroke}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}

        <div className="w-[86px] shrink-0 text-right">
          {/* keyed on the print, so a new price flashes once as it arrives */}
          <p key={signal.price} className="price-flash font-display text-[12.5px] leading-none font-bold text-white">
            {usd(signal.price)}
          </p>
          <p
            className={`mt-1 inline-flex rounded-full px-1.5 py-[1px] font-mono text-[9.5px] ${
              up ? "bg-mint/12 text-mint" : "bg-[#ff7070]/12 text-[#ff9a9a]"
            }`}
          >
            {up ? "▲" : "▼"} {signedPct(signal.change_pct_24h)}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`shrink-0 rounded-full border px-2 py-[2px] font-display text-[8.5px] font-bold uppercase tracking-[0.12em] ${style.chip}`}
        >
          {style.label}
        </span>

        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/6" title={`strength ${signal.strength}`}>
          <div className={`h-1 rounded-full ${style.bar}`} style={{ width: `${signal.strength}%` }} />
        </div>

        <span className="shrink-0 font-mono text-[9.5px] text-slate-deep">{signal.score > 0 ? `+${signal.score}` : signal.score}</span>
      </div>

      <p className="mt-1.5 font-mono text-[9.5px] leading-relaxed text-slate-deep">
        RSI {signal.rsi.toFixed(1)} · EMA {signedPct(signal.ema_spread_pct)} · ROC {signedPct(signal.roc_pct)} · vol ×
        {signal.volume_ratio.toFixed(2)} · range {signal.range_position}% · {signal.aligned}/3 agree
      </p>

      {signal.caution ? (
        <p className="mt-1 text-[9.5px] text-gold">watch: {signal.caution}</p>
      ) : null}
    </li>
  );
}

export function SignalBoard({ initial }: { initial: MarketFeed }) {
  const { feed, loading, error, refresh } = useMarketFeed(initial);
  const rows = feed.signals;
  const stale = feed.signals_error ?? error;
  const asOf = rows.length ? clockTime(rows[0].updated_at) : null;

  return (
    <section aria-label="Live crypto trading signals">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.1em] text-white uppercase">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" aria-hidden="true" />
          Trading signals
        </h3>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[9.5px] text-slate-deep">
            {asOf ? `candles ${asOf}` : "no print yet"}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-1 rounded-full border border-electric/20 bg-electric/6 px-2.5 py-[3px] font-display text-[9px] font-bold uppercase tracking-[0.14em] text-electric transition-colors hover:border-electric/45"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3 w-3 ${loading ? "spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 12a8 8 0 1 1-2.4-5.7" />
              <path d="M20 4v4h-4" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="surface rounded-2xl px-4 py-5 text-center">
          <p className="text-[11.5px] text-mist">Signals are offline right now.</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-deep">
            {stale ?? "The market data source did not answer."} They come back on the next poll.
          </p>
        </div>
      ) : (
        <div className="surface rounded-2xl">
          <ul>
            {rows.map((signal, index) => (
              <Row key={signal.symbol} signal={signal} index={index} />
            ))}
          </ul>

          <p className="border-t border-white/5 px-3 py-2.5 text-[9.5px] leading-relaxed text-slate-deep">
            Directional bias from hourly RSI-14, EMA 9/21, 24-bar rate of change and volume thrust on
            Binance spot candles. Market information, recalculated every few seconds — not financial
            advice, and it has nothing to do with your VINTA cycles.
          </p>
        </div>
      )}

      {rows.length && stale ? (
        <p className="mt-1.5 text-[9.5px] text-gold">
          Last good candles. The market source stopped answering: {stale}
        </p>
      ) : null}
    </section>
  );
}
