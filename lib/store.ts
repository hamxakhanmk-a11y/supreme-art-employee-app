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
}

// Quantities are held as floats, so repeatedly adding and subtracting values
// like 1.3 would otherwise drift into 4.699999999999999 and show that way.
// Three decimals is well past anything weighed out in practice.
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}
