"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The "Download" tile in Quick Actions — the fifth door next to Deposit,
 * Withdraw, Plans and Invite.
 *
 * Chromium fires `beforeinstallprompt` when the manifest and HTTPS checks
 * pass; we stash the event and replay it on tap. Where the browser never
 * fires it (iOS Safari, or an app already running installed) the tile falls
 * back to the manual Add-to-Home-Screen hint instead of silently doing
 * nothing.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const tileClass =
  "flex flex-col items-center gap-1.5 rounded-2xl border border-electric/12 bg-navy-900/60 px-1 py-3 transition-colors hover:border-electric/35";

export function InstallAppTile() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the browser's own omnibox install affordance alive too
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const tap = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }
    setHint(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHint(false), 4200);
  };

  return (
    <div className="relative">
      <button type="button" onClick={tap} className={`${tileClass} w-full`} aria-label="Download the Vanta app">
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] text-gold"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3.5v10" />
          <path d="M8 10l4 4 4-4" />
          <path d="M5 19.5h14" />
        </svg>
        <span className="font-display text-[9px] font-bold tracking-[0.06em] text-mist uppercase">
          {installed ? "Installed" : "Download"}
        </span>
      </button>

      {hint && (
        <div className="pointer-events-none absolute bottom-full right-0 z-40 mb-1.5 w-44 rounded-xl border border-electric/25 bg-navy-900/95 px-3 py-2 text-[10px] leading-relaxed text-mist shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {installed
            ? "Vanta is already installed on this device."
            : "Use your browser menu → “Add to Home screen” / “Install app” to get the Vanta app."}
        </div>
      )}
    </div>
  );
}
