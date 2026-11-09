// Read-only earnings probe. Nothing is written or triggered.
// 1. vanta_rules via anon key  → which rpc.sql generation is live
// 2. platform_settings         → earnings_mature_at + dead withdrawal_mode row
// 3. investments               → owed-day arithmetic under the NEW maturity rule
// 4. recent earning transactions → when credits actually hit the ledger
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z][A-Z0-9_]*\s*=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) throw new Error("missing env keys");

const jget = async (path, key, opts = {}) => {
  const res = await fetch(URL_ + "/rest/v1" + path, {
    headers: {
      apikey: key,
      ...(key === SERVICE ? { Authorization: `Bearer ${SERVICE}` } : {}),
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    ...opts,
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
};

// Mirror of the NEW vanta_maturity_at: start's local date + index days at HH:MM
// Africa/Kampala, rolled +1 day when it would land at/before the start instant.
const TZ = "Africa/Kampala";
const localParts = (iso) => {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(iso)).reduce((a, x) => (a[x.type] = x.value, a), {});
  return p;
};
const KampalaEpoch = (iso) => {
  const p = localParts(iso);
  // UTC epoch of a wall-clock reading in EAT (UTC+3, no DST) = shift by 3h
  return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - 3 * 3600_000;
};
const maturityAt = (startedIso, index, at) => {
  const p = localParts(startedIso);
  let due = Date.parse(`${p.year}-${p.month}-${p.day}T${at}:00Z`) - 3 * 3600_000
    + index * 86_400_000;
  if (due <= KampalaEpoch(startedIso)) due += 86_400_000;
  return due;
};

const now = Date.now();
console.log("now (UTC):", new Date(now).toISOString());

// 1 — live rules generation
const rules = await jget("/rpc/vanta_rules", ANON, { method: "POST", body: "{}" });
console.log("\n== vanta_rules (live) ==");
console.log(JSON.stringify(rules, null, 1));

// 2 — settings rows (service role reads the table directly)
const settings = await jget("/platform_settings?select=key,value&order=key", SERVICE);
console.log("\n== platform_settings ==");
for (const s of settings) console.log(` ${s.key} = ${JSON.stringify(s.value)}`);

// 3 — investments and what each one is owed under the NEW rule
const invs = await jget(
  "/investments?select=id,user_id,plan_slug,amount,daily_return,duration_days,days_paid,status,started_at,last_paid_at&order=started_at.desc&limit=100",
  SERVICE,
);
const matureAt = String(rules.earnings_mature_at ?? "22:00");
console.log(`\n== investments (${invs.length}) — owed days at ${matureAt} ${TZ} ==`);
let totalOwed = 0, totalOwedValue = 0, activeCount = 0;
for (const i of invs) {
  if (i.status !== "active") continue;
  activeCount++;
  let owed = 0;
  for (let d = i.days_paid; d < i.duration_days; d++) {
    if (maturityAt(i.started_at, d, matureAt) <= now) owed++;
    else break;
  }
  totalOwed += owed;
  totalOwedValue += owed * Number(i.daily_return);
  if (owed > 0 || !i.last_paid_at) {
    console.log(
      ` ${i.plan_slug.padEnd(6)} days ${i.days_paid}/${i.duration_days}` +
      ` started=${i.started_at} last_paid=${i.last_paid_at ?? "NEVER"} → OWED ${owed} day(s) = ${(owed * Number(i.daily_return)).toLocaleString()} UGX` +
      ` (day ${i.days_paid + 1} matured ${new Date(maturityAt(i.started_at, i.days_paid, matureAt)).toISOString()})`,
    );
  }
}
console.log(`\n active cycles: ${activeCount}; matured-but-uncredited days right now: ${totalOwed} (${totalOwedValue.toLocaleString()} UGX)`);

// 4 — recent earnings credits: when do they actually land?
const txs = await jget(
  "/transactions?select=created_at,type,amount,note,reference&order=created_at.desc&limit=40&type=in.(earning,capital_return)",
  SERVICE,
);
console.log("\n== last 40 earning/capital_return rows (UTC) ==");
for (const t of txs) console.log(` ${t.created_at}  ${t.type.padEnd(14)} ${Number(t.amount).toLocaleString().padStart(10)}  ${t.note ?? ""}`);

const earns = txs.filter((t) => t.type === "earning");
if (earns.length) {
  const hours = new Set(earns.map((t) => {
    const p = localParts(t.created_at);
    return `${p.hour}:${p.minute}`;
  }));
  console.log(`\n earning rows appear at local hours: ${[...hours].join(", ")}`);
  console.log(` newest earning row: ${earns[0].created_at} · oldest in window: ${earns.at(-1).created_at}`);
}
