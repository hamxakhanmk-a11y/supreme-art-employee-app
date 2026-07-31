// Adds brand / supplier / rack_no to the store's parts table. These are used
// by the Inks & Consumables module (which drops the Machine field instead).
// Usage: node scripts/add-store-ink-fields.mjs
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
try {
  const buf = readFileSync(envPath);
  const raw = buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString("utf16le") : buf.toString("utf8").replace(/^﻿/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (e) { console.error("Cannot read .env.local:", e.message); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);

const STMTS = [
  `ALTER TABLE parts ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT ''`,
  `ALTER TABLE parts ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT ''`,
  `ALTER TABLE parts ADD COLUMN IF NOT EXISTS rack_no TEXT DEFAULT ''`,
];

console.log(`Running ${STMTS.length} statements…`);
for (const s of STMTS) {
  process.stdout.write(`  ${s.slice(0, 70)}… `);
  try { await sql.query(s); console.log("OK"); }
  catch (e) { console.log("FAIL:", e.message); process.exit(1); }
}
const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'parts' AND column_name IN ('brand','supplier','rack_no')
  ORDER BY column_name`;
console.log("\n✅ parts now has:", (cols.rows ?? cols).map(r => r.column_name).join(", "));
