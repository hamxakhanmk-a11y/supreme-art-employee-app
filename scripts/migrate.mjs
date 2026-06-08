// Direct migration script — drops old tables, creates new schema.
// Usage: node scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
try {
  const buf = readFileSync(envPath);
  // Detect UTF-16 LE BOM (ff fe) — Notepad's default
  let env;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    env = buf.slice(2).toString("utf16le");
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    // UTF-16 BE — swap bytes then decode as LE
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    env = swapped.toString("utf16le");
  } else {
    env = buf.toString("utf8").replace(/^﻿/, "");
  }
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (e) { console.error("Cannot read .env.local:", e.message); process.exit(1); }

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const SQL = `
-- Drop everything we previously had
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS payroll CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS salary_structures CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS leave_balances CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS employee_documents CASCADE;
DROP TABLE IF EXISTS experience_records CASCADE;
DROP TABLE IF EXISTS education_records CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- Employees
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  father_name VARCHAR(120),
  dob DATE,
  gender VARCHAR(12),
  marital_status VARCHAR(12),
  nationality VARCHAR(60),
  religion VARCHAR(40),
  blood_group VARCHAR(6),
  cnic VARCHAR(20),
  cnic_expiry DATE,
  passport_number VARCHAR(30),
  passport_expiry DATE,
  phone VARCHAR(25),
  alt_phone VARCHAR(25),
  email VARCHAR(120),
  current_address TEXT,
  permanent_address TEXT,
  city VARCHAR(60),
  emergency_name VARCHAR(120),
  emergency_relation VARCHAR(40),
  emergency_phone VARCHAR(25),
  designation VARCHAR(80),
  department VARCHAR(60),
  joining_date DATE,
  employment_type VARCHAR(20),
  reporting_manager VARCHAR(120),
  work_location VARCHAR(80),
  shift VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  basic_salary INTEGER,
  bank_name VARCHAR(80),
  account_title VARCHAR(120),
  account_number VARCHAR(40),
  iban VARCHAR(40),
  photo_url TEXT,
  cnic_front_url TEXT,
  cnic_back_url TEXT,
  passport_url TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE education_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  degree VARCHAR(100) NOT NULL,
  institution VARCHAR(160),
  year_completed VARCHAR(10),
  grade VARCHAR(30),
  certificate_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE experience_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company VARCHAR(160) NOT NULL,
  position VARCHAR(100),
  from_date DATE,
  to_date DATE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

// Split on semicolons but keep simple — Neon HTTP driver runs one stmt at a time
const stmts = SQL.split(/;\s*$/m).map(s => s.trim()).filter(Boolean);
console.log(`Running ${stmts.length} statements…`);
for (const s of stmts) {
  try {
    process.stdout.write(`  ${s.slice(0, 60).replace(/\s+/g, " ")}… `);
    await sql.query(s);
    console.log("OK");
  } catch (e) {
    console.log("FAIL:", e.message);
    process.exit(1);
  }
}
console.log("\n✅ Migration complete");
