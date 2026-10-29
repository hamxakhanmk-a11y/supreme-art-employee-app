import { sql } from "drizzle-orm";
import { db } from "./db";

// Schema the store needs that the original tables didn't have. Same
// self-migrating approach the procurement tables use: production's DB URL isn't
// available locally, so changes have to apply themselves on first use rather
// than through a manual migration step. The /api/store/init route creates the
// base tables but is superadmin-only and hit by hand, so it can't be relied on
// to carry these.
//
// Everything lives in ONE statement — a single DO block — because the Neon HTTP
// driver refuses a query carrying several commands. Each step is written to be
// a no-op the second time, and an in-memory flag keeps it to at most one
// round-trip per server instance.
//
// Call this from reads as well as writes: a read naming a column this creates
// will throw on a database that hasn't had it added yet.
let ensured = false;
export async function ensureStoreSchema() {
  if (ensured) return;
  await db.execute(sql`
DO $$ BEGIN
  -- Delivery / gate-pass challan number against a stock movement. Optional,
  -- and shared across every row of a bulk entry (one challan, many parts).
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS challan_no TEXT;

  -- Who entered a stock movement (their name at the time). Older movements
  -- have none recorded.
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by TEXT;

  -- One-off jobs this module has already run, so each runs once.
  CREATE TABLE IF NOT EXISTS store_migrations (
    name TEXT PRIMARY KEY,
    ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Stock recipients who aren't on the payroll (contractors, outside workshops),
  -- added from the store's own "Issued To" picker.
  CREATE TABLE IF NOT EXISTS store_recipients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- On LOWER(name), so "Ali Traders" can't come back as "ali traders".
  CREATE UNIQUE INDEX IF NOT EXISTS store_recipients_name_key
    ON store_recipients (LOWER(name));

  -- "Does not add up" warnings the owner chose to ignore: the difference at the
  -- time, so the warning comes back if the part's gap changes.
  CREATE TABLE IF NOT EXISTS store_ledger_ignores (
    part_id INTEGER PRIMARY KEY REFERENCES parts(id) ON DELETE CASCADE,
    diff DOUBLE PRECISION NOT NULL,
    ignored_by TEXT NOT NULL DEFAULT '',
    ignored_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts' AND column_name = 'qty' AND data_type = 'integer'
  ) THEN
    ALTER TABLE parts ALTER COLUMN qty TYPE double precision;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'qty' AND data_type = 'integer'
  ) THEN
    ALTER TABLE transactions ALTER COLUMN qty TYPE double precision;
  END IF;
END $$;
  `);
  ensured = true;
  await backfillDoneByOnce();
}

// ---- "Done by" for entries made before names were kept ------------------------------------
// Every stock in / out, quantity edit and reconcile has always been written to
// the main Activity Log (who + a sentence), but the movement itself kept no
// name. This copies the name across, once, by finding the Activity Log line
// that describes each movement.
//
// Only a CERTAIN match is used: the movement's sentence is rebuilt exactly the
// way the log line was written, and the name is taken only when every log line
// with that sentence belongs to the same person. Anything ambiguous (two
// people issued the same thing, or the part was renamed since) is left blank —
// nothing is guessed. It only ever fills an empty "created_by" and never
// changes one that is already set, so running it again is harmless.
const LABEL_SQL = `(CASE WHEN COALESCE(p.sku, '') <> '' THEN '[' || p.sku || '] ' ELSE '' END) || p.name`;

export async function backfillDoneBy(): Promise<number> {
  let filled = 0;
  const count = (r: any) => Number((r as any).rowCount ?? (r as any).affectedRows ?? 0);

  // 1. Stock in / stock out: stocked|issued <qty> <unit> of "<label>"[ to <issued to>][ (challan <no>)]
  filled += count(await db.execute(sql.raw(`
    WITH exp AS (
      SELECT t.id,
             'store.' || p.module || '.txn.' || t.type AS action,
             (CASE t.type WHEN 'in' THEN 'stocked' ELSE 'issued' END) || ' ' || t.qty::text || ' ' || COALESCE(p.unit, '')
               || ' of "' || ${LABEL_SQL} || '"'
               || (CASE WHEN COALESCE(t.issued_to, '') <> '' THEN ' to ' || t.issued_to ELSE '' END)
               || (CASE WHEN COALESCE(t.challan_no, '') <> '' THEN ' (challan ' || t.challan_no || ')' ELSE '' END) AS summary
      FROM transactions t JOIN parts p ON p.id = t.part_id
      WHERE COALESCE(t.created_by, '') = ''
        AND COALESCE(t.purpose, '') <> 'Adjustment'
        AND COALESCE(t.ref, '') NOT LIKE 'Qty Edit%'
    ), m AS (
      SELECT e.id, MIN(a.user_name) AS who, COUNT(DISTINCT a.user_name) AS n
      FROM exp e JOIN activity_log a ON a.action = e.action AND a.summary = e.summary
      GROUP BY e.id
    )
    UPDATE transactions t SET created_by = m.who FROM m WHERE t.id = m.id AND m.n = 1 AND COALESCE(m.who, '') <> ''
  `)));

  // 2. Quantity edits: edited qty of "<label>": <before> → <after> <unit> (<+/-diff>)
  filled += count(await db.execute(sql.raw(`
    WITH exp AS (
      SELECT t.id,
             'store.' || p.module || '.part.qty_edit' AS action,
             'edited qty of "' || ${LABEL_SQL} || '": ' || replace(t.notes, 'Qty corrected via Edit: ', '') || ' (' AS prefix
      FROM transactions t JOIN parts p ON p.id = t.part_id
      WHERE COALESCE(t.created_by, '') = '' AND t.ref LIKE 'Qty Edit%' AND t.notes LIKE 'Qty corrected via Edit: %'
    ), m AS (
      SELECT e.id, MIN(a.user_name) AS who, COUNT(DISTINCT a.user_name) AS n
      FROM exp e JOIN activity_log a ON a.action = e.action AND starts_with(a.summary, e.prefix)
      GROUP BY e.id
    )
    UPDATE transactions t SET created_by = m.who FROM m WHERE t.id = m.id AND m.n = 1 AND COALESCE(m.who, '') <> ''
  `)));

  // 3. Reconcile adjustments: reconciled "<label>": recorded an adjustment of <+/-qty> <unit> dated <date> (quantity on hand unchanged)
  filled += count(await db.execute(sql.raw(`
    WITH exp AS (
      SELECT t.id,
             'store.' || p.module || '.txn.reconcile' AS action,
             'reconciled "' || ${LABEL_SQL} || '": recorded an adjustment of ' || (CASE t.type WHEN 'in' THEN '+' ELSE '-' END)
               || t.qty::text || ' ' || COALESCE(p.unit, '') || ' dated ' || t.date::text || ' (quantity on hand unchanged)' AS summary
      FROM transactions t JOIN parts p ON p.id = t.part_id
      WHERE COALESCE(t.created_by, '') = '' AND t.purpose = 'Adjustment' AND t.notes LIKE 'Opening balance adjustment%'
    ), m AS (
      SELECT e.id, MIN(a.user_name) AS who, COUNT(DISTINCT a.user_name) AS n
      FROM exp e JOIN activity_log a ON a.action = e.action AND a.summary = e.summary
      GROUP BY e.id
    )
    UPDATE transactions t SET created_by = m.who FROM m WHERE t.id = m.id AND m.n = 1 AND COALESCE(m.who, '') <> ''
  `)));
  return filled;
}

// Runs the job above once per database: the marker is written only after it has
// finished, so a failure is simply tried again next time, and a failure never
// stops the store from opening.
let backfillChecked = false;
async function backfillDoneByOnce() {
  if (backfillChecked) return;
  backfillChecked = true;
  try {
    const done = await db.execute(sql`SELECT 1 FROM store_migrations WHERE name = 'done-by-backfill-2026-10'`);
    if (((done as any).rows ?? (done as any)).length) return;
    const filled = await backfillDoneBy();
    await db.execute(sql`INSERT INTO store_migrations (name) VALUES ('done-by-backfill-2026-10') ON CONFLICT DO NOTHING`);
    console.log(`store: filled "done by" on ${filled} older stock entries from the Activity Log`);
  } catch (e) {
    backfillChecked = false;
    console.error("store done-by backfill failed (will retry):", e);
  }
}

// Quantities are held as floats, so repeatedly adding and subtracting values
// like 1.3 would otherwise drift into 4.699999999999999 and show that way.
// Three decimals is well past anything weighed out in practice.
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}
