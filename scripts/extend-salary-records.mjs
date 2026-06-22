// Extend salary_records with snapshot + computed columns; drop unused salary_slips.
// Usage: node scripts/extend-salary-records.mjs
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
  // Drop the unused salary_slips table from earlier work
  `DROP TABLE IF EXISTS salary_slips CASCADE`,
  // Extend salary_records
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS month_num INTEGER`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS employee_code VARCHAR(20)`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS employee_name VARCHAR(160)`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS designation VARCHAR(80)`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS department VARCHAR(60)`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS house_rent_percent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS medical_percent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS income_tax_percent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS eobi_employee_percent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS eobi_employer_percent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS house_rent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS medical INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS gross_earnings INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS income_tax INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS eobi_employee INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS eobi_employer INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS absent_deduction INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS total_deductions INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS net_pay INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS generated_by VARCHAR(120)`,
  `ALTER TABLE salary_records ALTER COLUMN conveyance SET DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_salary_records_period ON salary_records(year, month_num)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_records_employee ON salary_records(employee_id)`,
];

console.log(`Running ${STMTS.length} statements…`);
for (const s of STMTS) {
  try {
    process.stdout.write(`  ${s.slice(0, 60).replace(/\s+/g, " ")}… `);
    await sql.query(s);
    console.log("OK");
  } catch (e) {
    console.log("FAIL:", e.message);
    process.exit(1);
  }
}
console.log("\n✅ salary_records extension complete");
