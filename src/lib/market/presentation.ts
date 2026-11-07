/**
 * Presentation maps shared by the server modules and the client widgets.
 *
 * Deliberately free of `process.env`: pulling config.ts into a client bundle
 * would inline server-only variables as undefined. Keep this file pure data.
 */

import type { NewsTag, SignalAction } from "@/lib/types";

/** Accent colour, glyph and label per news tag — the wire's classifier output. */
export const TAG_STYLE: Record<NewsTag, { accent: string; glyph: string; label: string }> = {
  bitcoin: { accent: "#f7931a", glyph: "₿", label: "Bitcoin" },
  ethereum: { accent: "#8fa5ff", glyph: "Ξ", label: "Ethereum" },
  defi: { accent: "#00e676", glyph: "⬢", label: "DeFi" },
  nft: { accent: "#ae94ff", glyph: "◈", label: "NFT" },
  regulation: { accent: "#00e5ff", glyph: "§", label: "Policy" },
  market: { accent: "#f5a623", glyph: "↗", label: "Market" },
  crypto: { accent: "#00e5ff", glyph: "◈", label: "Crypto" },
};

/**
 * Signal wording. The composite score describes how the indicators line up,
 * not what the reader should do, so the labels stay directional and the panel
 * carries an explicit disclaimer.
 */
export const ACTION_STYLE: Record<
  SignalAction,
  { label: string; chip: string; bar: string; dot: string }
> = {
  buy: {
    label: "Buy bias",
    chip: "border-mint/35 bg-mint/12 text-mint",
    bar: "bg-mint",
    dot: "bg-mint",
  },
  sell: {
    label: "Sell bias",
    chip: "border-[#ff7070]/35 bg-[#ff7070]/12 text-[#ff9a9a]",
    bar: "bg-[#ff7070]",
    dot: "bg-[#ff7070]",
  },
  neutral: {
    label: "Range-bound",
    chip: "border-slate-deep/35 bg-white/5 text-mist",
    bar: "bg-slate-deep",
    dot: "bg-slate-deep",
  },
};

/** Typographic currency marks, so a row needs no remote icon request. */
const COIN_GLYPHS: Record<string, string> = {
  BTC: "₿",
  ETH: "Ξ",
  SOL: "◎",
  XRP: "✕",
  LTC: "Ł",
  TRX: "Ŧ",
  ADA: "₳",
  BNB: "◆",
  DOGE: "Ð",
  LINK: "⬡",
  AVAX: "▲",
  TON: "◈",
  DOT: "●",
  USDT: "₮",
};

export function glyphFor(base: string): string {
  return COIN_GLYPHS[base] ?? base.charAt(0);
}
