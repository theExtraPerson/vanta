import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * Shown when a session exists but `vanta_dashboard` could not be read — the
 * database schema or the RPC bundle has not been applied to the project yet.
 * It is deliberately not a redirect: a signed-in visitor stays inside the app.
 */
export function LedgerNotice() {
  return (
    <div className="space-y-4 px-4 pt-6 pb-10">
      <div className="qx-card p-4">
        <div className="scan-line" />
        <p className="micro-label">Ledger offline</p>
        <h2 className="mt-1.5 font-display text-[18px] leading-tight font-bold text-white">
          You are signed in — the database is not ready
        </h2>
        <p className="mt-2 text-[11.5px] leading-relaxed text-mist">
          Your session is valid, but the <span className="text-fog">vanta_dashboard</span>{" "}
          function could not be read, so there are no balances to show. Run the SQL bundle
          against the Supabase project, then reload this screen.
        </p>

        <ol className="mt-3 space-y-2">
          {[
            { step: "1", text: "Open the Supabase SQL editor for this project." },
            { step: "2", text: "Run supabase/schema.sql (plans, profiles, referral codes)." },
            { step: "3", text: "Run supabase/rpc.sql (dashboard payload and money RPCs)." },
            { step: "4", text: "Reload this page." },
          ].map((s) => (
            <li key={s.step} className="flex gap-2.5">
              <span className="mt-[1px] flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-electric/30 font-display text-[9px] font-bold text-electric">
                {s.step}
              </span>
              <span className="text-[11.5px] leading-relaxed text-mist">{s.text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-lg border border-gold/22 bg-gold/[0.06] px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-gold-light">
            Need a hand? Message {brand.supportHandle} with the project reference.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/" className="btn btn-outline h-9 flex-1 text-[11px]">
          Back to site
        </Link>
        <Link href="/login" className="btn btn-primary h-9 flex-1 text-[11px]">
          Switch account
        </Link>
      </div>
    </div>
  );
}
