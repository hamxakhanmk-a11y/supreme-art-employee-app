import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema } from "@/lib/store";
import { storeModuleDenied, storePartsDenied, normalizeStoreModule } from "@/lib/storeAccess";

// Orders placed with suppliers (Inks & Consumables → Orders): booked, coming. An order is for a Store item
// (part_id), or - booked from a Procurement PO line the Store doesn't have yet - for a new item (item_name / unit,
// no part until it is received, when the item is added and linked). What has arrived against an order is the
// stock ins that carry its id (transactions.order_id), so receiving is a stock in and reversing one takes it off
// the order again. Placing, changing, cancelling and deleting orders is Store · Orders; receiving is a stock in.

const rowsOf = (r: unknown): Record<string, unknown>[] => ((r as { rows?: unknown[] }).rows ?? r) as Record<string, unknown>[];
const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);
const err = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// GET /api/store/orders?module=consumables — every order of the module, with what has come in so far.
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  const mod = normalizeStoreModule(req.nextUrl.searchParams.get("module") || "consumables");
  const no = await storeModuleDenied(guard, mod);
  if (no) return no;
  try {
    await ensureStoreSchema();
    const rows = rowsOf(await db.execute(sql`
      SELECT o.id, o.part_id AS "partId", o.item_name AS "itemName", o.unit, o.qty, o.supplier, o.po_no AS "poNo",
             o.po_id AS "poId", o.po_sr AS "poSr",
             o.order_date::text AS "orderDate", o.expected_date::text AS "expectedDate", o.notes,
             o.cancelled_at AS "cancelledAt", o.created_by AS "createdBy", o.created_at AS "createdAt",
             COALESCE((SELECT SUM(t.qty) FROM transactions t WHERE t.order_id = o.id AND t.type = 'in'), 0) AS "receivedQty",
             (SELECT MAX(t.date)::text FROM transactions t WHERE t.order_id = o.id AND t.type = 'in') AS "lastReceived"
      FROM store_orders o LEFT JOIN parts p ON p.id = o.part_id
      WHERE COALESCE(p.module, o.module) = ${mod}
      ORDER BY o.id DESC`));
    return NextResponse.json(rows.map(r => ({ ...r, qty: Number(r.qty), receivedQty: Number(r.receivedQty) })));
  } catch (e) { return err(e); }
}

interface OrderIn { partId: number | null; itemName: string; unit: string; qty: number; supplier: string; poNo: string; poId: number | null; poSr: number | null; orderDate: string | null; expectedDate: string | null; notes: string }
function orderIn(b: Record<string, unknown>): OrderIn {
  return {
    partId: parseInt(String(b?.partId ?? "")) || null,
    itemName: text(b?.itemName, 200), unit: text(b?.unit, 20),
    qty: Math.round(Number(b?.qty) * 1000) / 1000,
    supplier: text(b?.supplier, 120), poNo: text(b?.poNo, 60), notes: text(b?.notes, 500),
    poId: parseInt(String(b?.poId ?? "")) || null, poSr: parseInt(String(b?.poSr ?? "")) || null,
    orderDate: isoDate(b?.orderDate), expectedDate: isoDate(b?.expectedDate),
  };
}

// POST { partId | itemName+unit, qty, supplier?, poNo?, poId?, poSr?, orderDate, expectedDate?, notes? } — book an
// order; { orders: [...] , module } books several at once (the lines of a PO).
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store.orders");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const mod = normalizeStoreModule(b?.module || "consumables");
    const noMod = await storeModuleDenied(guard, mod);
    if (noMod) return noMod;
    const list: OrderIn[] = (Array.isArray(b?.orders) ? b.orders : [b]).map(orderIn);
    if (!list.length) return bad("Nothing to order.");
    for (const o of list) {
      if (!o.partId && !o.itemName) return bad("Choose the item that was ordered.");
      if (!(o.qty > 0)) return bad(`Enter the quantity ordered${o.itemName ? ` for ${o.itemName}` : ""}.`);
      if (!o.orderDate) return bad("Enter the order date.");
    }
    const ids: number[] = list.map(o => o.partId).filter((n): n is number => !!n);
    const no = await storePartsDenied(guard, ids);
    if (no) return no;
    const names = new Map<number, Record<string, unknown>>();
    if (ids.length) {
      for (const p of rowsOf(await db.execute(sql`SELECT id, name, unit, module FROM parts WHERE id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)}) AND deleted_at IS NULL`))) names.set(Number(p.id), p);
      if (ids.some(i => !names.has(i))) return bad("One of those items was not found in the Store.");
    }
    const made: number[] = [];
    for (const o of list) {
      const p = o.partId ? names.get(o.partId) : null;
      const [row] = rowsOf(await db.execute(sql`
        INSERT INTO store_orders (part_id, item_name, unit, module, qty, supplier, po_no, po_id, po_sr, order_date, expected_date, notes, created_by)
        VALUES (${o.partId}, ${p ? String(p.name) : o.itemName}, ${p ? String(p.unit || "") : o.unit}, ${mod}, ${o.qty}, ${o.supplier}, ${o.poNo},
                ${o.poId}, ${o.poSr}, ${o.orderDate}::date, ${o.expectedDate}::date, ${o.notes}, ${guard.name || ""})
        RETURNING id`));
      made.push(Number(row?.id));
    }
    const first = list[0];
    await logActivity({
      user: guard, action: "store.order.create",
      summary: list.length > 1
        ? `ordered ${list.length} items${first.poNo ? ` on PO ${first.poNo}` : ""}${first.supplier ? ` from ${first.supplier}` : ""}`
        : `ordered ${first.qty} ${(first.partId ? names.get(first.partId)?.unit : first.unit) || ""} of "${first.partId ? names.get(first.partId)?.name : first.itemName}"${first.supplier ? ` from ${first.supplier}` : ""}${first.poNo ? ` (PO ${first.poNo})` : ""}`.replace("  ", " "),
    });
    return NextResponse.json({ ok: true, ids: made });
  } catch (e) { return err(e); }
}

// PUT { id, qty, supplier, poNo, orderDate, expectedDate, notes } — change an order; { id, cancel: true | false } —
// cancel it (what has come in stays) or take the cancel back; { id, partId } — the Store item a new-item order is
// (added on receiving, or picked).
export async function PUT(req: NextRequest) {
  const guard = await guardWrite(["store.orders", "store.stockin"]);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const id = parseInt(b?.id);
    const [o] = rowsOf(await db.execute(sql`
      SELECT o.part_id AS "partId", o.module, COALESCE(p.name, o.item_name) AS name, COALESCE(p.unit, o.unit) AS unit,
             COALESCE((SELECT SUM(t.qty) FROM transactions t WHERE t.order_id = o.id AND t.type = 'in'), 0) AS received
      FROM store_orders o LEFT JOIN parts p ON p.id = o.part_id WHERE o.id = ${id}`));
    if (!o) return bad("That order was not found.", 404);
    const noMod = await storeModuleDenied(guard, o.module);
    if (noMod) return noMod;
    if (o.partId) { const no = await storePartsDenied(guard, [Number(o.partId)]); if (no) return no; }
    // Linking an item: the receiver (Stock In) may do it, for the item they are receiving.
    if (b?.partId !== undefined && Object.keys(b).every(k => k === "id" || k === "partId")) {
      const partId = parseInt(b.partId);
      if (o.partId) return bad("This order is already for a Store item.");
      const [p] = rowsOf(await db.execute(sql`SELECT name, module FROM parts WHERE id = ${partId} AND deleted_at IS NULL`));
      if (!p || p.module !== o.module) return bad("That item was not found in this store.");
      await db.execute(sql`UPDATE store_orders SET part_id = ${partId} WHERE id = ${id}`);
      await logActivity({ user: guard, action: "store.order.link", summary: `linked order ${id} ("${o.name}") to the Store item "${p.name}"` });
      return NextResponse.json({ ok: true });
    }
    // Everything else is Store · Orders.
    const own = await guardWrite("store.orders");
    if (own instanceof NextResponse) return own;
    if (typeof b?.cancel === "boolean") {
      await db.execute(sql`UPDATE store_orders SET cancelled_at = ${b.cancel ? sql`now()` : sql`NULL`} WHERE id = ${id}`);
      await logActivity({ user: guard, action: b.cancel ? "store.order.cancel" : "store.order.uncancel", summary: `${b.cancel ? "cancelled" : "re-opened"} the order of "${o.name}" (order ${id})` });
      return NextResponse.json({ ok: true });
    }
    const f = orderIn(b);
    if (!(f.qty > 0)) return bad("Enter the quantity ordered.");
    if (f.qty < Number(o.received) - 0.0005) return bad(`${o.received} ${o.unit || ""} has already come in against this order; the order can't be less than that.`.replace("  ", " "));
    if (!f.orderDate) return bad("Enter the order date.");
    await db.execute(sql`
      UPDATE store_orders SET qty = ${f.qty}, supplier = ${f.supplier}, po_no = ${f.poNo}, order_date = ${f.orderDate}::date,
             expected_date = ${f.expectedDate}::date, notes = ${f.notes}
      WHERE id = ${id}`);
    await logActivity({ user: guard, action: "store.order.update", summary: `changed the order of "${o.name}" (order ${id}): ${f.qty} ${o.unit || ""}`.trim() });
    return NextResponse.json({ ok: true });
  } catch (e) { return err(e); }
}

// DELETE ?id= — an order nothing has come in against (one with deliveries is cancelled instead).
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store.orders");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const id = parseInt(req.nextUrl.searchParams.get("id") || "");
    const [o] = rowsOf(await db.execute(sql`
      SELECT o.part_id AS "partId", o.module, COALESCE(p.name, o.item_name) AS name,
             (SELECT COUNT(*) FROM transactions t WHERE t.order_id = o.id) AS n
      FROM store_orders o LEFT JOIN parts p ON p.id = o.part_id WHERE o.id = ${id}`));
    if (!o) return bad("That order was not found.", 404);
    const noMod = await storeModuleDenied(guard, o.module);
    if (noMod) return noMod;
    if (Number(o.n) > 0) return bad("Stock has come in against this order, so it can't be deleted - cancel it instead.");
    await db.execute(sql`DELETE FROM store_orders WHERE id = ${id}`);
    await logActivity({ user: guard, action: "store.order.delete", summary: `deleted the order of "${o.name}" (order ${id})` });
    return NextResponse.json({ ok: true });
  } catch (e) { return err(e); }
}
