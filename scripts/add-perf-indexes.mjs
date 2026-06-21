// Performance indexes — speeds up FK lookups & common filters
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
  `CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)`,
  `CREATE INDEX IF NOT EXISTS idx_education_employee ON education_records(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_experience_employee ON experience_records(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date)`,
];

console.log(`Creating ${stmts.length} indexes…`);
for (const s of stmts) {
  process.stdout.write(`  ${s.split(" ON ")[0].replace("CREATE INDEX IF NOT EXISTS ", "")}… `);
  try { await sql.query(s); console.log("OK"); }
  catch (e) { console.log("FAIL:", e.message); process.exit(1); }
}
console.log("Done");
