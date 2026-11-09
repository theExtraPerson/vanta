// Trigger the daily payouts job through the service-role RPC, exactly as the
// /api/cron/daily-payouts route does. Read-modify: credits every matured day.
// Safe to run while the only due window is 09.11.2026 22:00 (pays those 7 and
// stops, since the 10th's 22:00 window has not opened yet).
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z][A-Z0-9_]*\s*=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const res = await fetch(`${URL_}/rest/v1/rpc/vanta_run_daily_payouts`, {
  method: "POST",
  headers: {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ p_limit: 1000 }),
});

const text = await res.text();
console.log("HTTP", res.status);
console.log("credits written:", text);
if (!res.ok) process.exit(1);
