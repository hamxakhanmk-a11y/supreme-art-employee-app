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

  -- Inks & Consumables batches: the batch a stock in puts the stock into, or a stock out
  -- takes it from (1 = 1st batch, 2 = 2nd ...). Empty means the 1st batch: everything that
  -- was in the store before batches were kept is the 1st batch.
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS batch INTEGER;

  -- The purchase order and supplier invoice a stock in came with. Optional; printed on its sticker.
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS po_no TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS invoice_no TEXT;
  -- The batch number as the keeper wrote it for the sticker (02-2026 unless typed over). Empty: the automatic one.
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS batch_label TEXT;

  -- When it was entered (date AND time; the movement's own "date" has no time).
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

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

  -- Supplier and brand names hidden from the Add / Edit dropdowns (Inks & Consumables),
  -- e.g. a typo duplicate. The items keep their supplier / brand; only the suggestion goes.
  CREATE TABLE IF NOT EXISTS store_dropdown_hidden (
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    hidden_by TEXT NOT NULL DEFAULT '',
    hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (field, value)
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

// ---- "Done by" and "When" for entries made before they were kept ---------------------------
// Every stock in / out, quantity edit and reconcile has always been written to
// the main Activity Log (who + when + a sentence), but the movement itself kept
// neither. This copies the name and the time across, once each, by finding the
// Activity Log line that describes the movement.
//
// Only a CERTAIN match is used. The movement's sentence is rebuilt exactly the
// way the log line was written, then:
//  • name: taken only when every log line with that sentence belongs to the
//    same person;
//  • time: taken only when exactly one log line has that sentence AND exactly
//    one movement does (two identical movements can't be told apart by time).
// Anything ambiguous (the part was renamed since, two people did the same
// thing, ...) is left blank - nothing is guessed. It only ever fills an empty
// value and never changes one that is set, so running it again is harmless.
const LABEL_SQL = `(CASE WHEN COALESCE(p.sku, '') <> '' THEN '[' || p.sku || '] ' ELSE '' END) || p.name`;

// The three kinds of movement and the log sentence each one wrote. "match" is how
// the rebuilt sentence is compared with a log line.
function movementKinds(empty: string) {
  return [
    // stocked|issued <qty> <unit> of "<label>"[ to <issued to>][ (challan <no>)]
    { match: "a.summary = e.summary", exp: `
      SELECT t.id,
             'store.' || p.module || '.txn.' || t.type AS action,
             (CASE t.type WHEN 'in' THEN 'stocked' ELSE 'issued' END) || ' ' || t.qty::text || ' ' || COALESCE(p.unit, '')
               || ' of "' || ${LABEL_SQL} || '"'
               || (CASE WHEN COALESCE(t.issued_to, '') <> '' THEN ' to ' || t.issued_to ELSE '' END)
               || (CASE WHEN COALESCE(t.challan_no, '') <> '' THEN ' (challan ' || t.challan_no || ')' ELSE '' END) AS summary
      FROM transactions t JOIN parts p ON p.id = t.part_id
      WHERE ${empty} AND COALESCE(t.purpose, '') <> 'Adjustment' AND COALESCE(t.ref, '') NOT LIKE 'Qty Edit%'` },
    // edited qty of "<label>": <before> → <after> <unit> (<+/-diff>)
    { match: "starts_with(a.summary, e.summary)", exp: `
      SELECT t.id,
             'store.' || p.module || '.part.qty_edit' AS action,
             'edited qty of "' || ${LABEL_SQL} || '": ' || replace(t.notes, 'Qty corrected via Edit: ', '') || ' (' AS summary
      FROM transactions t JOIN parts p ON p.id = t.part_id
      WHERE ${empty} AND t.ref LIKE 'Qty Edit%' AND t.notes LIKE 'Qty corrected via Edit: %'` },
    // reconciled "<label>": recorded an adjustment of <+/-qty> <unit> dated <date> (quantity on hand unchanged)
    { match: "a.summary = e.summary", exp: `
      SELECT t.id,
             'store.' || p.module || '.txn.reconcile' AS action,
             'reconciled "' || ${LABEL_SQL} || '": recorded an adjustment of ' || (CASE t.type WHEN 'in' THEN '+' ELSE '-' END)
               || t.qty::text || ' ' || COALESCE(p.unit, '') || ' dated ' || t.date::text || ' (quantity on hand unchanged)' AS summary
      FROM transactions t JOIN parts p ON p.id = t.part_id
      WHERE ${empty} AND t.purpose = 'Adjustment' AND t.notes LIKE 'Opening balance adjustment%'` },
  ];
}

const rowsAffected = (r: any): number => Number((r as any).rowCount ?? (r as any).affectedRows ?? 0);

export async function backfillDoneBy(): Promise<number> {
  let filled = 0;
  for (const k of movementKinds(`COALESCE(t.created_by, '') = ''`)) {
    filled += rowsAffected(await db.execute(sql.raw(`
      WITH exp AS (${k.exp}),
      m AS (
        SELECT e.id, MIN(a.user_name) AS who, COUNT(DISTINCT a.user_name) AS n
        FROM exp e JOIN activity_log a ON a.action = e.action AND ${k.match}
        GROUP BY e.id
      )
      UPDATE transactions t SET created_by = m.who FROM m WHERE t.id = m.id AND m.n = 1 AND COALESCE(m.who, '') <> ''
    `)));
  }
  return filled;
}

export async function backfillCreatedAt(): Promise<number> {
  let filled = 0;
  for (const k of movementKinds("t.created_at IS NULL")) {
    filled += rowsAffected(await db.execute(sql.raw(`
      WITH exp AS (
        SELECT x.*, COUNT(*) OVER (PARTITION BY x.action, x.summary) AS n_same FROM (${k.exp}) x
      ), m AS (
        SELECT e.id, MIN(a.created_at) AS at, COUNT(*) AS n_logs
        FROM exp e JOIN activity_log a ON a.action = e.action AND ${k.match}
        WHERE e.n_same = 1
        GROUP BY e.id
      )
      UPDATE transactions t SET created_at = (m.at AT TIME ZONE 'UTC') FROM m WHERE t.id = m.id AND m.n_logs = 1
    `)));
  }
  return filled;
}

// Runs each job above once per database: its marker is written only after it has
// finished, so a failure is simply tried again next time, and a failure never
// stops the store from opening.
const backfillChecked = new Set<string>();
async function runOnce(name: string, job: () => Promise<number>) {
  if (backfillChecked.has(name)) return;
  backfillChecked.add(name);
  try {
    const done = await db.execute(sql`SELECT 1 FROM store_migrations WHERE name = ${name}`);
    if (((done as any).rows ?? (done as any)).length) return;
    const filled = await job();
    await db.execute(sql`INSERT INTO store_migrations (name) VALUES (${name}) ON CONFLICT DO NOTHING`);
    console.log(`store: ${name} filled ${filled} older stock entries from the Activity Log`);
  } catch (e) {
    backfillChecked.delete(name);
    console.error(`store ${name} failed (will retry):`, e);
  }
}
async function backfillDoneByOnce() {
  await runOnce("done-by-backfill-2026-10", backfillDoneBy);
  await runOnce("created-at-backfill-2026-10", backfillCreatedAt);
}

// Quantities are held as floats, so repeatedly adding and subtracting values
// like 1.3 would otherwise drift into 4.699999999999999 and show that way.
// Three decimals is well past anything weighed out in practice.
const ORD = ["th", "st", "nd", "rd"];
/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(n: number): string {
  const v = n % 100;
  return n + (ORD[(v - 20) % 10] || ORD[v] || ORD[0]);
}

// Batches of an Inks & Consumables part. A stock in opens a new batch (or adds to one); a stock out
// takes from one. A later batch (2nd, 3rd ...) holds what came into it less what went out of it. The
// 1st batch is whatever is on hand that is not in a later one, so the batches always add up to the
// quantity on hand even where older movements do not (stock before batches were kept, adjustments).
//   skipTxns / qtyOverride: the same sum as it would be without those movements, at that quantity
//   (used to check a reversal before it is made).
export async function batchBalances(partId: number, opts: { skipTxns?: number[]; qtyOverride?: number } = {}) {
  await ensureStoreSchema();   // the batch column
  const rowsOf = (r: any): any[] => (r as any).rows ?? (r as any);
  const [part] = rowsOf(await db.execute(sql`SELECT qty FROM parts WHERE id = ${partId}`));
  const qty = opts.qtyOverride ?? Number(part?.qty ?? 0);
  const skip = opts.skipTxns?.length ? sql`AND id NOT IN (${sql.join(opts.skipTxns.map(i => sql`${i}`), sql`, `)})` : sql``;
  const rows = rowsOf(await db.execute(sql`
    SELECT COALESCE(batch, 1) AS b, SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END) AS bal
    FROM transactions WHERE part_id = ${partId} ${skip} GROUP BY 1`));
  const later = rows.filter(r => Number(r.b) >= 2).map(r => ({ n: Number(r.b), qty: roundQty(Number(r.bal)) })).sort((a, b) => a.n - b.n);
  const laterSum = later.reduce((s, x) => s + x.qty, 0);
  return {
    batches: [{ n: 1, qty: roundQty(qty - laterSum) }, ...later],
    // False for a part that has never had any stock: its first stock in is the 1st batch.
    any: rows.length > 0 || qty > 0,
  };
}

export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}
