/**
 * A tiny stale-while-revalidate store for the market widgets.
 *
 * Two properties matter here:
 *
 *  1. The dashboard must never wait on a third-party wire. On a warm cache the
 *     server returns the previous payload immediately and recomputes in the
 *     background; on a cold cache it awaits, but only for `budgetMs`.
 *  2. An upstream outage must not blank the screen. A failed refresh keeps the
 *     last good value and records the error, so the widgets can say
 *     "showing the last update at 14:03" instead of disappearing.
 *
 * Held on `globalThis` so the map survives module reloads in `next dev`.
 */

type Entry<T> = {
  value: T;
  /** when the value was successfully produced (0 = never) */
  at: number;
  /** last failure message, cleared on the next success */
  error: string | null;
};

const g = globalThis as typeof globalThis & {
  __vantaMarketCache?: Map<string, Entry<unknown>>;
  __vantaMarketInflight?: Map<string, Promise<Entry<unknown>>>;
};

const store: Map<string, Entry<unknown>> = (g.__vantaMarketCache ??= new Map());
const inflight: Map<string, Promise<Entry<unknown>>> = (g.__vantaMarketInflight ??= new Map());

export type SwrResult<T> = {
  /** `null` only when the feed has never succeeded on this process. */
  data: T | null;
  /** epoch ms of the successful produce that produced `data`; null if none */
  at: number | null;
  /** why the last refresh failed, if it did */
  error: string | null;
  /** true when `data` came from an unexpired cache entry */
  fresh: boolean;
};

function startRefresh<T>(key: string, produce: () => Promise<T>): Promise<Entry<T>> {
  const running = inflight.get(key) as Promise<Entry<T>> | undefined;
  if (running) return running;

  const run: Promise<Entry<T>> = (async () => {
    let outcome: Entry<T>;
    try {
      outcome = { value: await produce(), at: Date.now(), error: null };
      store.set(key, outcome as Entry<unknown>);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const previous = store.get(key) as Entry<T> | undefined;
      // Keep showing whatever we had; remember that it stopped being fresh.
      outcome = previous
        ? { ...previous, error: message }
        : ({ value: undefined as unknown as T, at: 0, error: message } as Entry<T>);
      store.set(key, outcome as Entry<unknown>);
    } finally {
      inflight.delete(key);
    }
    return outcome;
  })();

  inflight.set(key, run as Promise<Entry<unknown>>);
  return run;
}

function snapshot<T>(key: string, ttlMs: number): SwrResult<T> | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry || entry.at === 0) return entry?.error ? { data: null, at: null, error: entry.error, fresh: false } : null;

  return {
    data: entry.value,
    at: entry.at,
    error: entry.error,
    fresh: entry.error === null && Date.now() - entry.at < ttlMs,
  };
}

/**
 * Reads `key`, producing fresh data when it is older than `ttlMs`.
 *
 * - `blocking: false` (server render) — an expired entry is returned as-is and
 *   refreshed in the background, so the page pays nothing for the upstream.
 * - `blocking: true` (explicit refresh) — waits for the new value, up to
 *   `budgetMs`, and still falls back to the stale one if the wait times out.
 */
export async function swr<T>(
  key: string,
  opts: {
    ttlMs: number;
    produce: () => Promise<T>;
    blocking?: boolean;
    /** cold-start / blocking wait budget; the work continues after it lapses */
    budgetMs?: number;
  },
): Promise<SwrResult<T>> {
  const { ttlMs, produce, blocking = false, budgetMs = 4_000 } = opts;
  const hit = snapshot<T>(key, ttlMs);

  if (hit?.fresh) return hit;

  if (hit) {
    const refresh = startRefresh(key, produce);
    if (!blocking) return hit;

    const winner = await Promise.race([
      refresh.then((entry) => entry as Entry<T> | undefined),
      new Promise<null>((resolveAfter) =>
        setTimeout(() => resolveAfter(null), budgetMs).unref?.(),
      ),
    ]);

    return winner
      ? { data: winner.value, at: winner.at || null, error: winner.error, fresh: winner.error === null }
      : hit;
  }

  // Cold cache: the widgets need something to render, so await the first run.
  const entry = await Promise.race([
    startRefresh(key, produce),
    new Promise<null>((resolveAfter) => setTimeout(() => resolveAfter(null), budgetMs).unref?.()),
  ]);

  if (!entry) {
    return {
      data: null,
      at: null,
      error: `Timed out after ${budgetMs}ms waiting for the feed.`,
      fresh: false,
    };
  }

  return {
    data: entry.value === undefined ? null : entry.value,
    at: entry.at || null,
    error: entry.error,
    fresh: entry.error === null,
  };
}

/** Drops an entry so the next read refetches (used by tests/manual refreshes). */
export function invalidate(key: string): void {
  store.delete(key);
}
