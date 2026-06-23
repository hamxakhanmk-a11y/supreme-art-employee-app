// Adds incomeTaxAmount + eobiEmployeeAmount columns (PKR overrides for the
// percent-based fields) to employees and salary_records.
// Usage: node scripts/add-pkr-amounts.mjs
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

const STMTS = [
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS income_tax_amount INTEGER DEFAULT 0`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS eobi_employee_amount INTEGER DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS income_tax_amount INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS eobi_employee_amount INTEGER NOT NULL DEFAULT 0`,
];

console.log(`Running ${STMTS.length} statements…`);
for (const s of STMTS) {
  try {
    process.stdout.write(`  ${s.slice(0, 70).replace(/\s+/g, " ")}… `);
    await sql.query(s);
    console.log("OK");
  } catch (e) {
    console.log("FAIL:", e.message);
    process.exit(1);
  }
}
console.log("\n✅ PKR-amount columns added");
