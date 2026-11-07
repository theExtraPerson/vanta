"use client";

/**
 * One poll for both market widgets.
 *
 * The news slider and the signal board live at different heights of the same
 * screen, so they share a single store instead of each hitting `/api/market`:
 * one request every `NEXT_PUBLIC_MARKET_REFRESH_SECONDS`, one in-flight guard,
 * and no requests at all while the tab is hidden.
 *
 * `useSyncExternalStore` keeps this hydration-safe: the server snapshot is the
 * payload already rendered into the HTML, so the first client paint matches.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { marketRefreshSeconds } from "@/lib/market/config";
import type { MarketFeed } from "@/lib/types";

export type MarketSnapshot = {
  feed: MarketFeed | null;
  loading: boolean;
  error: string | null;
};

let snapshot: MarketSnapshot = { feed: null, loading: false, error: null };
let polling = false;
let timer: ReturnType<typeof setInterval> | null = null;
let wiredVisibility = false;
const listeners = new Set<() => void>();

function commit(next: Partial<MarketSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const notify of listeners) notify();
}

async function poll(force: boolean): Promise<void> {
  if (polling) return;
  // A hidden tab is not showing the wire; do not spend the upstream quota.
  if (!force && typeof document !== "undefined" && document.hidden) return;

  polling = true;
  commit({ loading: true });
  try {
    const response = await fetch("/api/market", { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Sign in again to refresh the market feed."
          : `Market feed responded ${response.status}.`,
      );
    }

    commit({ feed: (await response.json()) as MarketFeed, error: null });
  } catch (cause) {
    // Keep the last payload on screen; say why it stopped moving.
    commit({ error: cause instanceof Error ? cause.message : String(cause) });
  } finally {
    polling = false;
    commit({ loading: false });
  }
}

function startPolling(): void {
  if (typeof window === "undefined" || timer) return;

  const seconds = Math.max(20, marketRefreshSeconds);
  timer = setInterval(() => void poll(false), seconds * 1_000);

  if (!wiredVisibility) {
    wiredVisibility = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void poll(true);
    });
  }
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  startPolling();
  return () => {
    listeners.delete(notify);
  };
}

/**
 * @param initial the payload already rendered on the server.
 */
export function useMarketFeed(initial: MarketFeed) {
  const fallback = useMemo<MarketSnapshot>(
    () => ({ feed: initial, loading: false, error: null }),
    [initial],
  );

  const getSnapshot = useCallback(() => (snapshot.feed ? snapshot : fallback), [fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The first client render seeds the store from the HTML it just hydrated.
  useEffect(() => {
    if (!snapshot.feed) commit({ feed: initial });
  }, [initial]);

  const refresh = useCallback(() => poll(true), []);

  return {
    feed: state.feed ?? initial,
    loading: state.loading,
    error: state.error,
    refresh,
  };
}
