/**
 * The dashboard news wire.
 *
 * Quintaris renders its "Latest News" slider from `/api/crypto-news`, which is
 * a proxy for a paid news API and answers anonymous requests with a 302 to its
 * login page. The same headlines are published openly as RSS/Atom, so Vanta
 * reads the wires directly and keeps the interesting parts of the widget: the
 * tag classifier, the relative timestamps and the card slider.
 *
 * Two deliberate improvements over the reference implementation:
 *   · cards link to the real article (`item.link`), not one hard-coded page;
 *   · the timestamp comes from `published_at`, which the reference read as
 *     `pubDate` and therefore always rendered blank.
 *
 * Parsing is regex-based on purpose: these are flat syndication feeds, and
 * pulling in an XML parser to read twelve `<item>` blocks is not worth the
 * dependency. Feeds are treated as untrusted input — every field is decoded,
 * length-clamped and validated before it reaches the client.
 */

import { UpstreamError, fetchText } from "@/lib/market/http";
import { newsCacheSeconds, newsFeedUrls, newsLimit, newsWireLabel } from "@/lib/market/config";
import { swr, type SwrResult } from "@/lib/market/cache";
import type { NewsItem, NewsTag } from "@/lib/types";

export const NEWS_CACHE_KEY = "market:news";

/* ── Entity + field decoding ─────────────────────────────────────────────── */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
};

function codePoint(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return "";
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]{1,6});/gi, (_m, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_m, dec: string) => codePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED[name.toLowerCase()] ?? match);
}

function unwrapCdata(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cdata ? cdata[1] : raw;
}

/** Visible text of an element: CDATA unwrapped, markup removed, whitespace flat. */
function textOf(raw: string): string {
  return decodeEntities(unwrapCdata(raw).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Raw inner markup of the first matching element, entities already decoded. */
function rawOf(block: string, names: string[]): string {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
    if (match) {
      const value = textOf(match[1]);
      if (value) return value;
    }
  }
  return "";
}

function attrOf(block: string, tag: string, attr: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*?\\b${attr}\\s*=\\s*"([^"]*)"`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

/* ── Classification ──────────────────────────────────────────────────────── */

type TagRule = { tag: NewsTag; pattern: RegExp };

/** First match wins, exactly like the reference widget's classifier. */
const TAG_RULES: TagRule[] = [
  { tag: "bitcoin", pattern: /\b(bitcoin|btc|satoshi|halving|lightning network|sats)\b/i },
  { tag: "ethereum", pattern: /\b(ethereum|ether|\beth\b|rollup|layer\s?-?\s?2|staking|vitalik)\b/i },
  { tag: "defi", pattern: /\b(defi|decentralized finance|uniswap|lend|yield|stablecoin|aave)\b/i },
  { tag: "nft", pattern: /\b(nft|non[-\s]?fungible|collectible|pfp)\b/i },
  {
    tag: "regulation",
    pattern: /\b(regulat|sec\b|lawsuit|court|ruling|ban|tax|licence|license|compliance)\b/i,
  },
  {
    tag: "market",
    pattern: /\b(price|rally|crash|bull|bear|market|etf|fund|trading|volume|breakout|prediction)\b/i,
  },
];

export function classifyTag(title: string, keywords = ""): NewsTag {
  const haystack = `${title} ${keywords}`;
  return TAG_RULES.find((rule) => rule.pattern.test(haystack))?.tag ?? "crypto";
}

/* ── Item normalisation ──────────────────────────────────────────────────── */

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function imageOf(block: string, markupHint: string): string | null {
  for (const tag of ["media:content", "media:thumbnail"]) {
    const url = attrOf(block, tag, "url");
    if (isHttpUrl(url) && !/\.(pdf|mp4|mp3|mov|avi|wav)$/i.test(url)) return url;
  }

  const enclosure = block.match(/<enclosure\b[^>]*>/i)?.[0] ?? "";
  if (/type\s*=\s*"image/i.test(enclosure)) {
    const url = enclosure.match(/url\s*=\s*"([^"]*)"/i)?.[1] ?? "";
    if (isHttpUrl(url)) return url;
  }

  const inline = markupHint.match(/<img\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? "";
  return isHttpUrl(inline) ? inline : null;
}

/** "cointelegraph.com/news" reads as "Cointelegraph", not the RSS channel title. */
function hostLabel(itemUrl: string): string | null {
  try {
    const host = new URL(itemUrl).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    // decrypt.co → decrypt, fs.blog → fs, static.sub.example.co.uk → example.
    const name = (parts.length > 2 ? parts[parts.length - 2] : parts[0] ?? "")
      .split("-")
      .join(" ");
    if (name.length < 3) return null;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return null;
  }
}

/**
 * The publisher, preferring the site the headline actually links to.
 * RSS channel titles are unreliable as bylines — CoinTelegraph's reads
 * "Cointelegraph.com News", and Decrypt's carries a trailing feed generator.
 */
function sourceOf(itemUrl: string, declared: string, feedTitle: string): string {
  const host = hostLabel(itemUrl);
  if (host) return host.slice(0, 40);

  const candidate = declared || feedTitle;
  if (candidate) return candidate.replace(/\s+(news|feed|rss)$/i, "").slice(0, 40);

  return newsWireLabel;
}

/** Feeds love "Headline | Publisher"; the publisher gets its own slot. */
function cleanTitle(raw: string): string {
  const value = raw.replace(/\s+/g, " ").trim();
  const bar = value.lastIndexOf("|");
  if (bar > 24 && value.length - bar <= 32) return value.slice(0, bar).trim();
  return value;
}

export function ageLabel(publishedMs: number, nowMs = Date.now()): string {
  const delta = Math.max(0, nowMs - publishedMs);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** FNV-1a, so React keys stay stable across refreshes for the same article. */
function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36);
}

function normalize(block: string, feedTitle: string, now: number): NewsItem | null {
  const declaredLink = rawOf(block, ["link"]);
  const url = attrOf(block, "link", "href") || (isHttpUrl(declaredLink) ? declaredLink : "");
  if (!url) return null;

  const title = cleanTitle(rawOf(block, ["title", "media:title"]));
  // Ad slots and syndication stubs show up as one- or two-word "items".
  if (title.length < 18 || title.length > 190) return null;

  const publishedRaw = rawOf(block, ["pubDate", "published", "updated", "dc:date", "date"]);
  const parsed = Date.parse(publishedRaw);
  // Feeds in the wild carry clock-skewed dates; anything in the future by more
  // than an hour is dropped rather than jumping to the top of the slider.
  const publishedMs = Number.isFinite(parsed) && parsed <= now + 3_600_000 ? parsed : null;
  const publishedAt = publishedMs === null ? null : new Date(publishedMs).toISOString();

  // Keep the markup for the image hunt only — never rendered.
  const markup = block.match(
    /<content:encoded(?:\s[^>]*)?>([\s\S]*?)<\/content:encoded>|<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i,
  );
  const description = markup ? (markup[1] ?? markup[2] ?? "") : "";

  return {
    id: `nw-${hash(url)}`,
    title,
    url,
    source: sourceOf(url, rawOf(block, ["source"]), feedTitle),
    image: imageOf(block, description),
    tag: classifyTag(title, rawOf(block, ["keywords", "category", "media:keywords", "media:category"])),
    published_at: publishedAt,
    age_label: publishedMs === null ? "" : ageLabel(publishedMs, now),
  };
}

/* ── Feed reading ────────────────────────────────────────────────────────── */

const BLOCK_RE = /<item(?:\s[^>]*)?>[\s\S]*?<\/item>|<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi;

export async function readFeed(feedUrl: string): Promise<NewsItem[]> {
  const xml = await fetchText(feedUrl, 7_000);
  const feedTitle = textOf(xml.match(/<(?:title|generator)(?:\s[^>]*)?>([\s\S]*?)<\/(?:title|generator)>/i)?.[1] ?? "");
  const now = Date.now();

  const items: NewsItem[] = [];
  const blocks = xml.match(BLOCK_RE) ?? [];

  for (const block of blocks) {
    const item = normalize(block, feedTitle, now);
    if (item) items.push(item);
    // Stop early: a wire can carry hundreds of items and the slider shows a dozen.
    if (items.length >= newsLimit * 2) break;
  }

  return items;
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const unique: NewsItem[] = [];

  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 64);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

async function produce(): Promise<NewsItem[]> {
  if (!newsFeedUrls.length) throw new UpstreamError("No news feeds are configured.");

  const settled = await Promise.allSettled(newsFeedUrls.map((url) => readFeed(url)));
  const merged = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const failures = settled
    .filter((result) => result.status === "rejected")
    .map((result) => (result as PromiseRejectedResult).reason);

  if (!merged.length) {
    const reason = failures[0] instanceof Error ? failures[0].message : "unknown error";
    throw new UpstreamError(
      merged.length ? "Empty wire." : `Every news feed failed (${failures.length}/${newsFeedUrls.length}): ${reason}`,
    );
  }

  const dated = merged.map((item, index) => ({ item, index }));
  // Newest first; undated items fall back to their order in the feed.
  dated.sort((a, b) => {
    const at = a.item.published_at ? Date.parse(a.item.published_at) : 0;
    const bt = b.item.published_at ? Date.parse(b.item.published_at) : 0;
    if (bt !== at) return bt - at;
    return a.index - b.index;
  });

  return dedupe(dated.map((entry) => entry.item)).slice(0, newsLimit);
}

/**
 * Headlines for the wire. `blocking` is false during a server render (return
 * the cached slider and refresh behind the request) and true for an explicit
 * refresh from the browser, where the user is waiting on the spinner.
 */
export function getNews(blocking = false): Promise<SwrResult<NewsItem[]>> {
  return swr(NEWS_CACHE_KEY, {
    ttlMs: newsCacheSeconds * 1_000,
    produce,
    blocking,
    budgetMs: blocking ? 8_000 : 5_000,
  });
}
