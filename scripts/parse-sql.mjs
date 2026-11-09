// Parse the Supabase SQL files with the real Postgres grammar (via libpg_query
// wasm) and report the first syntax error per file. Run: node scripts/parse-sql.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("pgsql-parser");

let bad = 0;
for (const file of ["schema.sql", "rpc.sql", "admin.sql"]) {
  const sql = readFileSync(new URL(`../supabase/${file}`, import.meta.url), "utf8");
  try {
    const stmts = parse(sql);
    const n = Array.isArray(stmts) ? stmts.length : (stmts.statements ?? stmts.parseTrees ?? []).length;
    console.log(`${file}: OK (${n} statements)`);
  } catch (err) {
    bad += 1;
    console.error(`${file}: FAIL ${String(err.message).split("\n")[0]}`);
  }
}
process.exit(bad ? 1 : 0);
