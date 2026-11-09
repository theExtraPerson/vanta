// One-off helper: upsert platform_settings rows against the live project
// using the service role key from .env.local (same path the desk edits use).
// Values that change behaviour without any DDL land instantly; anything in a
// function body still needs the supabase/*.sql re-run in the SQL editor.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const arg = process.argv[2] ?? "[]";
const rows = JSON.parse(arg.startsWith("@") ? readFileSync(arg.slice(1), "utf8") : arg);
if (!rows.length) {
  console.error('usage: node apply-settings.mjs \'[{"key":"...","value":...}]\' | @file.json');
  process.exit(1);
}

const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/platform_settings`, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});

console.log(res.status, (await res.text()) || "(ok)");
