import { sql } from "drizzle-orm";
import { db } from "./db";

// Quantities started out as INTEGER, which is fine for parts counted in pcs
// but not for consumables weighed out in kg or litres — 2.5 kg of ink has to
// be issuable. Widen both qty columns to double precision.
//
// Same self-migrating approach the procurement tables use: production's DB
// URL isn't available locally, so the change has to apply itself on first
// use rather than through a manual migration step. The /api/store/init route
// creates these tables but is superadmin-only and hit by hand, so it can't be
// relied on to carry this.
//
// Guarded on the current column type so the (table-rewriting) ALTER runs once
// and is a no-op afterwards, and by an in-memory flag so it's at most one
// round-trip per server instance.
let ensured = false;
export async function ensureStoreSchema() {
  if (ensured) return;
  await db.execute(sql`
DO $$ BEGIN
  -- Delivery / gate-pass challan number against a stock movement. Optional,
  -- and shared across every row of a bulk entry (one challan, many parts).
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS challan_no TEXT;

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
