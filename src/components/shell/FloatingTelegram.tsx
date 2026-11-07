"use client";

import { useState } from "react";
import { brand } from "@/lib/brand";
import type { TelegramLinks } from "@/lib/links";

/**
 * Floating Telegram entry points.
 *
 * Quintaris keeps support one tap away at all times: a paper-plane button
 * pinned to the app column that fans open into the two channels people
 * actually use — the customer-service desk (@Micron) and the official
 * community group. It sits above the tab bar and inside the phone column so it
 * never drifts under the chrome or off to the side of the frame.
 */

const CHANNELS = [
  {
    key: "support",
    emoji: "💬",
    label: "Customer Service",
    handle: brand.supportHandle,
    href: brand.supportTelegram,
    accent: "#00e5ff",
  },
  {
    key: "community",
    emoji: "👥",
    label: "Official Community Group",
    handle: "Telegram",
    href: brand.community,
    accent: "#2aabee",
  },
] as const;

function Plane({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.5 3.3 2.9 10.6c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.4c.3.9 1.4 1.1 2 .4l2.5-2.6 4.7 3.5c.8.6 1.9.2 2.1-.8l3-15.5c.2-1-.8-1.8-1.7-1.4ZM9.4 14.1l-.6 3-1-3.1 8.5-5.9-6.9 6Z" />
    </svg>
  );
}

/** Channels default to the compiled brand and defer to the desk's live links. */
export function FloatingTelegram({ links }: { links?: TelegramLinks }) {
  const [open, setOpen] = useState(false);

  const channels = CHANNELS.map((c) =>
    c.key === "support"
      ? { ...c, href: links?.support ?? c.href, handle: links?.handle ?? c.handle }
      : { ...c, href: links?.community ?? c.href },
  );

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)" }}
    >
      <div className="flex w-full max-w-[430px] flex-col items-end gap-2 px-4">
        {open
          ? channels.map((c, i) => (
              <a
                key={c.key}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/10 bg-navy-900/90 py-2 pr-3.5 pl-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-transform hover:-translate-y-[1px]"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]"
                  style={{ backgroundColor: `${c.accent}1f`, color: c.accent }}
                  aria-hidden="true"
                >
                  {c.emoji}
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-display text-[11px] font-bold text-white">{c.label}</span>
                  <span className="mt-[3px] font-mono text-[9.5px] text-slate-deep">{c.handle}</span>
                </span>
                <Plane className="h-3.5 w-3.5 shrink-0 text-[#2aabee]" />
              </a>
            ))
          : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Hide Telegram contacts" : "Open Telegram contacts"}
          className="pointer-events-auto ml-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[#2aabee] to-[#229ed9] text-white shadow-[0_12px_34px_-10px_rgba(42,171,238,0.7)] transition-transform active:scale-95"
        >
          {open ? (
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <Plane className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  );
}
