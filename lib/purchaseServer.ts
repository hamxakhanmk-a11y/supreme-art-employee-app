import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { parsePrItems, prItemsTotal, type PrItem } from "@/lib/purchase";

// Idempotently add the multi-item columns. Called before any read/write that
// touches them, so production self-migrates on deploy without a manual step.
let ensured = false;
export async function ensurePurchaseColumns() {
  if (ensured) return;
  await db.execute(sql`DO $$ BEGIN
    ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS items text NOT NULL DEFAULT '[]';
    ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS received_date date;
  END $$;`);
  ensured = true;
}

// Turn a request body into the columns we persist. Accepts either the new
// `items` array or the legacy scalar fields, then mirrors the item list back
// onto the scalar columns (first item / total value) so old readers keep working.
export function buildPrFields(b: {
  items?: unknown; itemName?: string | null; category?: string | null;
  quantity?: unknown; uom?: string | null; value?: unknown;
}): {
  items: string; itemName: string | null; category: string | null;
  quantity: number | null; uom: string | null; value: number | null;
} {
  const items: PrItem[] = parsePrItems(b);
  const first = items[0];
  const total = prItemsTotal(items);
  return {
    items: JSON.stringify(items),
    itemName: items.length ? items.map((i) => i.itemName).filter(Boolean).join("; ") : null,
    category: first?.category || null,
    quantity: items.length === 1 ? first.quantity : null,
    uom: items.length === 1 ? first.uom || null : null,
    value: total === null ? null : Math.round(total),
  };
}
