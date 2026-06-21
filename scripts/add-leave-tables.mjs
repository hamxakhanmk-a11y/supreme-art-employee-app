// Adds leave_types and leave_requests tables, seeds defaults.
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
  `CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    days_allowed INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    color VARCHAR(16) DEFAULT '#185FA5',
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INTEGER NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    decided_at TIMESTAMP,
    decided_by VARCHAR(80),
    decision_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // Seed default leave types if table is empty
  `INSERT INTO leave_types (name, days_allowed, is_paid, color, description)
   SELECT 'Annual Leave', 14, TRUE, '#185FA5', 'Yearly paid leave for vacation and personal time.'
   WHERE NOT EXISTS (SELECT 1 FROM leave_types)`,
  `INSERT INTO leave_types (name, days_allowed, is_paid, color, description)
   SELECT 'Sick Leave', 10, TRUE, '#A32D2D', 'Paid leave for illness or medical reasons.'
   WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Sick Leave')`,
  `INSERT INTO leave_types (name, days_allowed, is_paid, color, description)
   SELECT 'Casual Leave', 8, TRUE, '#854F0B', 'Short paid leave for personal matters.'
   WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Casual Leave')`,
  `INSERT INTO leave_types (name, days_allowed, is_paid, color, description)
   SELECT 'Unpaid Leave', 0, FALSE, '#888888', 'Leave without pay.'
   WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE name = 'Unpaid Leave')`,
];

console.log(`Running ${stmts.length} statements…`);
for (const s of stmts) {
  process.stdout.write(`  ${s.replace(/\s+/g, " ").slice(0, 70)}… `);
  try { await sql.query(s); console.log("OK"); }
  catch (e) { console.log("FAIL:", e.message); process.exit(1); }
}
console.log("✅ Done");
