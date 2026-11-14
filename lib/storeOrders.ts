// A stock in made with a P.O. No. (the Stock In form, Bulk Stock In, or the number typed on its sticker later)
// counts against the order booked for that item on that P.O. in Inks & Consumables → Orders, so the order shows
// it received - the same as using the order's own Received / Partial (owner, 2026-11-14).
import { sql } from "drizzle-orm";
import { db } from "./db";
import { productKey } from "./rateChanges";

const rowsOf = (r: unknown): Record<string, unknown>[] => ((r as { rows?: unknown[] }).rows ?? r) as Record<string, unknown>[];

// The P.O. as digits, so "10501", "PO 10501" and "P.O.#10501" are one number.
export const poDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

// The open order this stock in belongs to, or null: on the same P.O., not cancelled, not yet all in - for this
// item (the oldest first), else a new-item order on that P.O. whose name is this item's (it is then linked to
// the item). Nothing is matched without a P.O. number.
export async function orderForStockIn(partId: number, poNo: unknown): Promise<number | null> {
  const po = poDigits(poNo);
  if (!po) return null;
  const orders = rowsOf(await db.execute(sql`
    SELECT o.id, o.part_id AS "partId", o.item_name AS "itemName", o.module, o.qty,
           COALESCE((SELECT SUM(t.qty) FROM transactions t WHERE t.order_id = o.id AND t.type = 'in'), 0) AS received
    FROM store_orders o
    WHERE o.cancelled_at IS NULL AND regexp_replace(o.po_no, '[^0-9]', '', 'g') = ${po}
    ORDER BY o.id`));
  const open = orders.filter(o => Number(o.qty) - Number(o.received) > 0.0005);
  const mine = open.find(o => Number(o.partId) === partId);
  if (mine) return Number(mine.id);
  const unlinked = open.filter(o => !o.partId);
  if (!unlinked.length) return null;
  const [p] = rowsOf(await db.execute(sql`SELECT name, sku, module FROM parts WHERE id = ${partId}`));
  if (!p) return null;
  const keys = new Set([productKey(String(p.name || "")), productKey(`${p.sku || ""} ${p.name || ""}`)].filter(Boolean));
  const named = unlinked.find(o => o.module === p.module && keys.has(productKey(String(o.itemName || ""))));
  if (!named) return null;
  await db.execute(sql`UPDATE store_orders SET part_id = ${partId} WHERE id = ${named.id} AND part_id IS NULL`);
  return Number(named.id);
}
