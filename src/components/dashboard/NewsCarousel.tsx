"use client";

import { useEffect, useRef, useState } from "react";
import { newsAutoAdvanceSeconds } from "@/lib/market/config";
import { useMarketFeed } from "@/lib/market/client";
import { TAG_STYLE } from "@/lib/market/presentation";
import type { MarketFeed, NewsItem } from "@/lib/types";

/**
 * The dashboard news wire — Quintaris' "Latest News" slider, rebuilt.
 *
 * Same language as the reference (210px scroll-snap cards, tag chip, three-line
 * headline, source + relative age, dot pagination that is derived from the
 * scroll position rather than a counter). Two things change: it advances by
 * itself, which the reference never did, and a card links to its own article
 * instead of one hard-coded news page.
 *
 * Auto-advance stands down while the pointer is over the slider, while a card
 * has keyboard focus, when the reader pins it off with the pause button, and
 * for anyone whose system asks for reduced motion.
 */

/** 210px card + 10px gap — the step the reference slider divided by as well. */
const CARD_STEP = 220;

type CarouselProps = {
  items: NewsItem[];
  /** populated when the wire failed; the last good items stay on screen */
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
};

function CardMedia({ item }: { item: NewsItem }) {
  const style = TAG_STYLE[item.tag] ?? TAG_STYLE.crypto;
  const [failed, setFailed] = useState(false);

  if (!item.image || failed) {
    return (
      <div
        className="flex h-24 w-full items-center justify-center"
        style={{
          background: `linear-gradient(140deg, ${style.accent}22, rgba(9,18,32,0.9) 70%)`,
        }}
      >
        <span className="font-display text-2xl font-bold" style={{ color: style.accent }}>
          {style.glyph}
        </span>
      </div>
    );
  }

  return (
    // Remote wire imagery is decorative and untrusted: a bare img keeps Next
    // out of the optimisation path, and a failure falls back to the glyph tile.
    <img
      src={item.image}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-24 w-full bg-navy-900 object-cover opacity-90 transition-opacity group-hover:opacity-100"
    />
  );
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const style = TAG_STYLE[item.tag] ?? TAG_STYLE.crypto;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="card-in group w-[210px] shrink-0 snap-start overflow-hidden rounded-2xl border border-electric/12 bg-navy-800 transition-colors hover:border-electric/40"
      style={{ animationDelay: `${Math.min(index, 8) * 0.06}s` }}
      aria-label={`${style.label} news: ${item.title}`}
    >
      <div className="relative">
        <CardMedia item={item} />
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-[2px] font-display text-[8.5px] font-bold uppercase tracking-[0.14em]"
          style={{ color: style.accent, background: "rgba(5,10,20,0.72)", border: `1px solid ${style.accent}59` }}
        >
          {style.label}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <p className="line-clamp-3 font-display text-[12px] leading-[1.35] font-semibold text-fog">
          {item.title}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[9.5px] text-slate-deep">
          <span className="truncate text-mist">{item.source}</span>
          {item.age_label ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{item.age_label}</span>
            </>
          ) : null}
        </p>
      </div>
    </a>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-electric/20 bg-electric/6 text-electric transition-colors hover:border-electric/45 hover:bg-electric/12"
    >
      {children}
    </button>
  );
}

export function NewsCarousel({ items, error, loading, onRefresh }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [held, setHeld] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const count = items.length;
  const autoplay = count > 1 && !hovered && !held && !reducedMotion;

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    // Wrapping back to the first card is a rewind, not a scrub across the rail.
    const left = index <= 0 ? 0 : index * CARD_STEP;
    track.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
    setActive(Math.max(0, Math.min(index, count - 1)));
  };

  // The slider is the source of truth for the dots: drag, flick and keyboard
  // scrolling all land here, exactly like the reference implementation.
  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / CARD_STEP);
    setActive(Math.max(0, Math.min(index, count - 1)));
  };

  useEffect(() => {
    if (!autoplay) return;

    const id = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const next = (Math.round(track.scrollLeft / CARD_STEP) + 1) % count;
      scrollToIndex(next);
    }, newsAutoAdvanceSeconds * 1_000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, count, reducedMotion]);

  const dots = Math.min(count, 10);
  const shown = count ? Math.min(active, dots - 1) : 0;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Latest crypto news"
      className="-mt-1"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.1em] text-white uppercase">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" aria-hidden="true" />
          Latest news
        </h3>

        <div className="flex items-center gap-1.5">
          <span className="mr-0.5 font-display text-[9.5px] font-bold tracking-[0.14em] text-slate-deep uppercase">
            {count ? `${count} cards` : "wire off"}
          </span>
          <IconButton
            label={held ? "Resume the news carousel" : "Pause the news carousel"}
            pressed={held}
            onClick={() => setHeld((value) => !value)}
          >
            {held ? (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5h3v13H8zM13 5.5h3v13h-3z" />
              </svg>
            )}
          </IconButton>
          <IconButton label="Refresh the news wire" onClick={onRefresh}>
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 ${loading ? "spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 12a8 8 0 1 1-2.4-5.7" />
              <path d="M20 4v4h-4" />
            </svg>
          </IconButton>
        </div>
      </div>

      {autoplay ? (
        <div className="mt-2 h-px w-full overflow-hidden bg-white/6">
          <div
            key={`${shown}-${count}`}
            data-paused={hovered || held}
            className="wire-tick h-px w-full bg-gradient-to-r from-electric/75 to-royal/75"
            style={{ "--tick": `${newsAutoAdvanceSeconds}s` } as React.CSSProperties}
          />
        </div>
      ) : null}

      {count === 0 ? (
        <div className="surface mt-2 rounded-2xl px-4 py-5 text-center">
          <p className="text-[11.5px] text-mist">The news wire is offline right now.</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-deep">
            {error ?? "No headlines came back from the configured feeds."}
          </p>
        </div>
      ) : (
        <>
          <div
            ref={trackRef}
            onScroll={handleScroll}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setHovered(true)}
            onBlurCapture={() => setHovered(false)}
            className="no-scrollbar mt-2 -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1"
          >
            {items.map((item, index) => (
              <NewsCard key={item.id} item={item} index={index} />
            ))}
          </div>

          {dots > 1 ? (
            <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: dots }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => scrollToIndex(index)}
                  aria-label={`Show headline ${index + 1} of ${dots}`}
                  className={`h-[5px] rounded-full transition-all ${
                    index === shown ? "w-[14px] bg-electric" : "w-[5px] bg-electric/25 hover:bg-electric/50"
                  }`}
                />
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mt-1.5 text-[9.5px] text-slate-deep">
              Showing the last headlines that loaded — the wire stopped responding.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Server-rendered wrapper: seeds the shared store with the page payload. */
export function NewsWire({ initial }: { initial: MarketFeed }) {
  const { feed, loading, error, refresh } = useMarketFeed(initial);

  return (
    <NewsCarousel
      items={feed.news}
      error={feed.news_error ?? error}
      loading={loading}
      onRefresh={() => void refresh()}
    />
  );
}
