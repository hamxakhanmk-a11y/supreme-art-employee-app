// One-shot migration: fully copies the standalone parts-store DB into the
// employee-app DB. Wipes and re-imports so re-runs are safe and the target
// mirrors the source exactly (except users/sessions/setup_tokens/activity_log
// which are deliberately skipped — the employee app owns those).
//
// Tables copied 1:1 (schema + rows):
//   - categories        (with module)
//   - machines
//   - parts             (with sku, module, machine, image_url, deleted_at)
//   - transactions
//
// Usage:
//   STORE_DATABASE_URL='postgresql://...' node scripts/migrate-store-data.mjs
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

const STORE_URL = process.env.STORE_DATABASE_URL;
const EMP_URL   = process.env.DATABASE_URL;
if (!STORE_URL) { console.error("STORE_DATABASE_URL env var required"); process.exit(1); }
if (!EMP_URL)   { console.error(".env.local DATABASE_URL not set");     process.exit(1); }

const store = neon(STORE_URL);
const emp   = neon(EMP_URL);

// ---------------------------------------------------------------------------
// Target schema — matches the live store app's ensureTables().
// ---------------------------------------------------------------------------
async function ensureEmployeeSchema() {
  await emp.query(`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT 'machinery'
  )`);
  await emp.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'machinery'`);
  await emp.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key`);
  await emp.query(`CREATE UNIQUE INDEX IF NOT EXISTS categories_module_name_key ON categories(module, name)`);

  await emp.query(`CREATE TABLE IF NOT EXISTS parts (
    id SERIAL PRIMARY KEY, sku TEXT, name TEXT NOT NULL, category TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT 'machinery',
    unit TEXT NOT NULL DEFAULT 'pcs',
    qty INTEGER NOT NULL DEFAULT 0, min_qty INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT ''
  )`);
  await emp.query(`ALTER TABLE parts ADD COLUMN IF NOT EXISTS sku TEXT`);
  await emp.query(`ALTER TABLE parts ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'machinery'`);
  await emp.query(`ALTER TABLE parts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
  await emp.query(`ALTER TABLE parts ADD COLUMN IF NOT EXISTS machine TEXT DEFAULT ''`);
  await emp.query(`ALTER TABLE parts ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await emp.query(`CREATE UNIQUE INDEX IF NOT EXISTS parts_sku_active_unique_ci ON parts(LOWER(sku)) WHERE sku IS NOT NULL AND deleted_at IS NULL`);

  await emp.query(`CREATE TABLE IF NOT EXISTS machines (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT 'machinery'
  )`);
  await emp.query(`CREATE UNIQUE INDEX IF NOT EXISTS machines_module_name_key ON machines(module, name)`);

  await emp.query(`CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('in','out')),
    part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL, date DATE NOT NULL,
    ref TEXT DEFAULT '', notes TEXT DEFAULT '', issued_to TEXT DEFAULT '', purpose TEXT DEFAULT ''
  )`);
}

async function counts(sql, label) {
  const c = await sql.query(`SELECT
    (SELECT COUNT(*)::int FROM categories)   AS cats,
    (SELECT COUNT(*)::int FROM machines WHERE true) AS machs,
    (SELECT COUNT(*)::int FROM parts WHERE deleted_at IS NULL) AS parts_active,
    (SELECT COUNT(*)::int FROM parts WHERE deleted_at IS NOT NULL) AS parts_trash,
    (SELECT COUNT(*)::int FROM transactions) AS txns`);
  const r = c[0] || c.rows?.[0];
  console.log(`  [${label}] categories=${r.cats}  machines=${r.machs}  parts_active=${r.parts_active}  parts_trash=${r.parts_trash}  transactions=${r.txns}`);
  return r;
}

async function wipeTargetTables() {
  // Transactions FK cascades from parts, but we also nuke transactions
  // explicitly so IDs restart fresh with sequences bumped to source MAX.
  await emp.query(`TRUNCATE transactions, parts, machines, categories RESTART IDENTITY CASCADE`);
}

async function copyCategories() {
  const rows = (await store.query(`SELECT id, name, module FROM categories ORDER BY id`)).rows ?? [];
  for (const r of rows) {
    await emp.query(
      `INSERT INTO categories (id, name, module) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [r.id, r.name, r.module || "machinery"]
    );
  }
  return rows.length;
}

async function copyMachines() {
  // Older store DBs might not have the machines table yet — swallow that.
  let rows = [];
  try {
    rows = (await store.query(`SELECT id, name, module FROM machines ORDER BY id`)).rows ?? [];
  } catch (e) {
    if (/relation .* does not exist/i.test(e.message)) return 0;
    throw e;
  }
  for (const r of rows) {
    await emp.query(
      `INSERT INTO machines (id, name, module) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [r.id, r.name, r.module || "machinery"]
    );
  }
  return rows.length;
}

async function copyParts() {
  const rows = (await store.query(`
    SELECT id, sku, name, category, module, machine, unit, qty, min_qty, description,
           image_url, deleted_at::text AS deleted_at
    FROM parts ORDER BY id
  `)).rows ?? [];
  for (const r of rows) {
    await emp.query(
      `INSERT INTO parts (id, sku, name, category, module, machine, unit, qty, min_qty, description, image_url, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.sku ?? null, r.name, r.category, r.module || "machinery",
       r.machine ?? "", r.unit || "pcs", r.qty, r.min_qty, r.description ?? "",
       r.image_url ?? null, r.deleted_at || null]
    );
  }
  return rows.length;
}

async function copyTransactions() {
  const rows = (await store.query(`
    SELECT id, type, part_id, qty, date::text AS date, ref, notes, issued_to, purpose
    FROM transactions ORDER BY id
  `)).rows ?? [];
  for (const r of rows) {
    await emp.query(
      `INSERT INTO transactions (id, type, part_id, qty, date, ref, notes, issued_to, purpose)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.type, r.part_id, r.qty, r.date, r.ref ?? "", r.notes ?? "", r.issued_to ?? "", r.purpose ?? ""]
    );
  }
  return rows.length;
}

async function bumpSequences() {
  await emp.query(`SELECT setval(pg_get_serial_sequence('categories', 'id'),   COALESCE((SELECT MAX(id) FROM categories), 1))`);
  await emp.query(`SELECT setval(pg_get_serial_sequence('machines', 'id'),     COALESCE((SELECT MAX(id) FROM machines), 1))`);
  await emp.query(`SELECT setval(pg_get_serial_sequence('parts', 'id'),        COALESCE((SELECT MAX(id) FROM parts), 1))`);
  await emp.query(`SELECT setval(pg_get_serial_sequence('transactions', 'id'), COALESCE((SELECT MAX(id) FROM transactions), 1))`);
}

(async () => {
  try {
    console.log("Ensuring target schema…");
    await ensureEmployeeSchema();

    console.log("\nBEFORE:");
    await counts(store, "store   ");
    await counts(emp,   "employee");

    console.log("\nWiping target tables (idempotent re-run)…");
    await wipeTargetTables();

    console.log("Copying rows…");
    const cats  = await copyCategories();   console.log(`  categories:   ${cats}`);
    const machs = await copyMachines();     console.log(`  machines:     ${machs}`);
    const parts = await copyParts();        console.log(`  parts:        ${parts}`);
    const txns  = await copyTransactions(); console.log(`  transactions: ${txns}`);

    console.log("\nBumping sequences…");
    await bumpSequences();

    console.log("\nAFTER:");
    await counts(emp, "employee");
    console.log("\n✅ Migration complete.");
  } catch (e) {
    console.error("\n❌ Migration failed:", e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
