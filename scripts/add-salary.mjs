// Incremental migration — adds salary columns to employees + creates salary_slips table.
// Usage: node scripts/add-salary.mjs
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
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS conveyance INTEGER DEFAULT 0`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS house_rent_percent INTEGER DEFAULT 0`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS medical_percent INTEGER DEFAULT 0`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS income_tax_percent INTEGER DEFAULT 0`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS eobi_employee_percent INTEGER DEFAULT 0`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS eobi_employer_percent INTEGER DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS salary_slips (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    employee_code VARCHAR(20) NOT NULL,
    employee_name VARCHAR(160) NOT NULL,
    designation VARCHAR(80),
    department VARCHAR(60),
    basic_salary INTEGER NOT NULL DEFAULT 0,
    conveyance INTEGER NOT NULL DEFAULT 0,
    house_rent_percent INTEGER NOT NULL DEFAULT 0,
    medical_percent INTEGER NOT NULL DEFAULT 0,
    income_tax_percent INTEGER NOT NULL DEFAULT 0,
    eobi_employee_percent INTEGER NOT NULL DEFAULT 0,
    eobi_employer_percent INTEGER NOT NULL DEFAULT 0,
    house_rent INTEGER NOT NULL DEFAULT 0,
    medical INTEGER NOT NULL DEFAULT 0,
    overtime INTEGER NOT NULL DEFAULT 0,
    gross_earnings INTEGER NOT NULL DEFAULT 0,
    days_present INTEGER NOT NULL DEFAULT 0,
    days_absent INTEGER NOT NULL DEFAULT 0,
    days_on_leave INTEGER NOT NULL DEFAULT 0,
    week_offs INTEGER NOT NULL DEFAULT 0,
    income_tax INTEGER NOT NULL DEFAULT 0,
    eobi_employee INTEGER NOT NULL DEFAULT 0,
    eobi_employer INTEGER NOT NULL DEFAULT 0,
    absent_deduction INTEGER NOT NULL DEFAULT 0,
    other_deduction INTEGER NOT NULL DEFAULT 0,
    total_deductions INTEGER NOT NULL DEFAULT 0,
    net_pay INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    generated_by VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_salary_slips_employee ON salary_slips(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_slips_period ON salary_slips(year, month)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_slips_emp_period ON salary_slips(employee_id, year, month)`,
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
console.log("\n✅ Salary migration complete");
