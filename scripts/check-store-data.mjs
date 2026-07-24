// Quick health check on the employee DB's store tables.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const buf = readFileSync(envPath);
const raw = buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString("utf16le") : buf.toString("utf8").replace(/^﻿/, "");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);
console.log("=== Row counts ===");
console.log(await sql`SELECT
  (SELECT COUNT(*)::int FROM parts)                                  AS parts_total,
  (SELECT COUNT(*)::int FROM parts WHERE deleted_at IS NULL)         AS parts_active,
  (SELECT COUNT(*)::int FROM parts WHERE deleted_at IS NOT NULL)     AS parts_trash,
  (SELECT COUNT(*)::int FROM categories)                             AS cats_total,
  (SELECT COUNT(*)::int FROM machines)                               AS machines_total,
  (SELECT COUNT(*)::int FROM transactions)                           AS txns_total`);

console.log("\n=== parts.module distribution (active) ===");
console.log(await sql`
  SELECT module, COUNT(*)::int AS n
  FROM parts WHERE deleted_at IS NULL
  GROUP BY module ORDER BY n DESC
`);

console.log("\n=== First 3 active parts (any module) ===");
console.log(await sql`SELECT id, sku, name, module, category FROM parts WHERE deleted_at IS NULL ORDER BY id LIMIT 3`);

console.log("\n=== What the app queries — parts for module='machinery' ===");
console.log(await sql`
  SELECT COUNT(*)::int AS c FROM parts
  WHERE module = 'machinery' AND deleted_at IS NULL
`);
