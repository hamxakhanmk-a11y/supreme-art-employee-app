// Adds attendance fields and the closures table.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
try {
  const buf = readFileSync(envPath);
  let env;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) env = buf.slice(2).toString("utf16le");
  else env = buf.toString("utf8").replace(/^﻿/, "");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (e) { console.error("Cannot read .env.local:", e.message); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const sql = neon(process.env.DATABASE_URL);

const stmts = [
  `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in VARCHAR(8)`,
  `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out VARCHAR(8)`,
  `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS attendance_emp_date_uniq ON attendance(employee_id, date)`,
  `CREATE TABLE IF NOT EXISTS attendance_days (
    date DATE PRIMARY KEY,
    closed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_by VARCHAR(80)
  )`,
];

console.log(`Running ${stmts.length} statements…`);
for (const s of stmts) {
  process.stdout.write(`  ${s.replace(/\s+/g, " ").slice(0, 70)}… `);
  try { await sql.query(s); console.log("OK"); }
  catch (e) { console.log("FAIL:", e.message); process.exit(1); }
}
console.log("✅ Done");
