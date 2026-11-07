/**
 * One payload for both dashboard widgets.
 *
 * The server render asks for cached data and never blocks on the wires
 * (`blocking: false`), so the dashboard keeps its round-trip count even when a
 * feed is slow; the browser's poll asks for a fresh read (`blocking: true`)
 * because the user is looking at a spinner at that point.
 */

import { getNews } from "@/lib/market/news";
import { getSignals } from "@/lib/market/signals";
import { marketFeedsEnabled } from "@/lib/market/config";
import type { MarketFeed } from "@/lib/types";

const EMPTY: MarketFeed = {
  news: [],
  signals: [],
  news_at: null,
  signals_at: null,
  news_error: null,
  signals_error: null,
};

function describe(error: string | null, loaded: boolean): string | null {
  if (error) return error;
  return loaded ? null : "The feed has not loaded yet.";
}

export async function getMarketFeed(opts: { blocking?: boolean } = {}): Promise<MarketFeed> {
  if (!marketFeedsEnabled) return EMPTY;

  const blocking = opts.blocking ?? false;
  const [news, signals] = await Promise.all([getNews(blocking), getSignals(blocking)]);

  return {
    news: news.data ?? [],
    signals: signals.data ?? [],
    news_at: news.at,
    signals_at: signals.at,
    news_error: describe(news.error, Boolean(news.data?.length)),
    signals_error: describe(signals.error, Boolean(signals.data?.length)),
  };
}

export { marketFeedsEnabled };
