"use client";

import { useState } from "react";

export function ReferralLinkBox({
  code,
  link,
  note,
}: {
  code: string;
  link: string;
  note?: string;
}) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  async function copy(value: string, which: "link" | "code") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="qx-card p-3.5">
      <div className="scan-line" />
      <p className="micro-label">Referral link</p>
      <div className="mt-1.5 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate rounded-lg border border-electric/12 bg-navy-900/70 px-2.5 py-1.5 font-mono text-[10.5px] text-fog/90">
          {link}
        </p>
        <button
          type="button"
          onClick={() => copy(link, "link")}
          className="btn btn-primary h-8 shrink-0 px-3 text-[10px]"
        >
          {copied === "link" ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-gold/22 bg-gold/[0.06] px-2.5 py-1.5">
        <div className="min-w-0">
          <p className="text-[8px] font-bold tracking-[0.2em] text-slate-deep uppercase">Code</p>
          <p className="truncate font-mono text-[12px] font-semibold tracking-[0.14em] text-gold">
            {code}
          </p>
        </div>
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="btn btn-outline h-7 shrink-0 px-2.5 text-[9.5px]"
        >
          {copied === "code" ? "Copied" : "Copy"}
        </button>
      </div>

      {note && <p className="mt-2 text-[10px] leading-relaxed text-slate-deep">{note}</p>}
    </div>
  );
}