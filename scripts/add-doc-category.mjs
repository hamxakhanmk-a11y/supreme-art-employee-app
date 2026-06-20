// Add category + form_date + notes columns to other_documents
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
  `ALTER TABLE other_documents ADD COLUMN IF NOT EXISTS category VARCHAR(20)`,
  `ALTER TABLE other_documents ADD COLUMN IF NOT EXISTS form_date DATE`,
  `ALTER TABLE other_documents ADD COLUMN IF NOT EXISTS notes TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_other_documents_category ON other_documents(category)`,
];

console.log(`Running ${stmts.length} statements…`);
for (const s of stmts) {
  process.stdout.write(`  ${s.slice(0, 80)}… `);
  try { await sql.query(s); console.log("OK"); }
  catch (e) { console.log("FAIL:", e.message); process.exit(1); }
}
console.log("Done");
