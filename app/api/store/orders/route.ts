import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema } from "@/lib/store";
import { storeModuleDenied, storePartsDenied } from "@/lib/storeAccess";

// Orders placed with suppliers (Inks & Consumables → Orders): booked, coming. What has arrived against an order
// is the stock ins that carry its id (transactions.order_id), so receiving is a stock in and reversing one takes
// it off the order again. Placing, changing, cancelling and deleting orders is Store · Orders; receiving is a
// stock in (Store · Stock In, /api/store/transactions with orderId).

const rowsOf = (r: unknown): Record<string, unknown>[] => ((r as { rows?: unknown[] }).rows ?? r) as Record<string, unknown>[];
const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);

// GET /api/store/orders?module=consumables — every order of the module's items, with what has come in so far.
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  const mod = req.nextUrl.searchParams.get("module") === "machinery" ? "machinery" : "consumables";
  const no = await storeModuleDenied(guard, mod);
  if (no) return no;
  try {
    await ensureStoreSchema();
    const rows = rowsOf(await db.execute(sql`
      SELECT o.id, o.part_id AS "partId", o.qty, o.supplier, o.po_no AS "poNo",
             o.order_date::text AS "orderDate", o.expected_date::text AS "expectedDate", o.notes,
             o.cancelled_at AS "cancelledAt", o.created_by AS "createdBy", o.created_at AS "createdAt",
             COALESCE((SELECT SUM(t.qty) FROM transactions t WHERE t.order_id = o.id AND t.type = 'in'), 0) AS "receivedQty",
             (SELECT MAX(t.date)::text FROM transactions t WHERE t.order_id = o.id AND t.type = 'in') AS "lastReceived"
      FROM store_orders o JOIN parts p ON p.id = o.part_id
      WHERE p.module = ${mod}
      ORDER BY o.id DESC`));
    return NextResponse.json(rows.map(r => ({ ...r, qty: Number(r.qty), receivedQty: Number(r.receivedQty) })));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function fields(b: Record<string, unknown>) {
  return {
    qty: Math.round(Number(b?.qty) * 1000) / 1000,
    supplier: text(b?.supplier, 120), poNo: text(b?.poNo, 60), notes: text(b?.notes, 500),
    orderDate: isoDate(b?.orderDate), expectedDate: isoDate(b?.expectedDate),
  };
}

// POST { partId, qty, supplier?, poNo?, orderDate, expectedDate?, notes? } — book an order.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store.orders");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const partId = parseInt(b?.partId);
    const f = fields(b);
    if (!partId) return NextResponse.json({ error: "Choose the item that was ordered." }, { status: 400 });
    if (!(f.qty > 0)) return NextResponse.json({ error: "Enter the quantity ordered." }, { status: 400 });
    if (!f.orderDate) return NextResponse.json({ error: "Enter the order date." }, { status: 400 });
    const no = await storePartsDenied(guard, [partId]);
    if (no) return no;
    const [p] = rowsOf(await db.execute(sql`SELECT name, unit FROM parts WHERE id = ${partId} AND deleted_at IS NULL`));
    if (!p) return NextResponse.json({ error: "That item was not found." }, { status: 400 });
    const [row] = rowsOf(await db.execute(sql`
      INSERT INTO store_orders (part_id, qty, supplier, po_no, order_date, expected_date, notes, created_by)
      VALUES (${partId}, ${f.qty}, ${f.supplier}, ${f.poNo}, ${f.orderDate}::date, ${f.expectedDate}::date, ${f.notes}, ${guard.name || ""})
      RETURNING id`));
    await logActivity({ user: guard, action: "store.order.create", summary: `ordered ${f.qty} ${p.unit || ""} of "${p.name}"${f.supplier ? ` from ${f.supplier}` : ""}${f.poNo ? ` (PO ${f.poNo})` : ""}`.replace("  ", " ") });
    return NextResponse.json({ ok: true, id: row?.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// PUT { id, qty, supplier, poNo, orderDate, expectedDate, notes } — change an order; { id, cancel: true | false } —
// cancel it (what has come in stays) or take the cancel back.
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("store.orders");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const id = parseInt(b?.id);
    const [o] = rowsOf(await db.execute(sql`
      SELECT o.part_id AS "partId", p.name, p.unit,
             COALESCE((SELECT SUM(t.qty) FROM transactions t WHERE t.order_id = o.id AND t.type = 'in'), 0) AS received
      FROM store_orders o JOIN parts p ON p.id = o.part_id WHERE o.id = ${id}`));
    if (!o) return NextResponse.json({ error: "That order was not found." }, { status: 404 });
    const no = await storePartsDenied(guard, [Number(o.partId)]);
    if (no) return no;
    if (typeof b?.cancel === "boolean") {
      await db.execute(sql`UPDATE store_orders SET cancelled_at = ${b.cancel ? sql`now()` : sql`NULL`} WHERE id = ${id}`);
      await logActivity({ user: guard, action: b.cancel ? "store.order.cancel" : "store.order.uncancel", summary: `${b.cancel ? "cancelled" : "re-opened"} the order of "${o.name}" (order ${id})` });
      return NextResponse.json({ ok: true });
    }
    const f = fields(b);
    if (!(f.qty > 0)) return NextResponse.json({ error: "Enter the quantity ordered." }, { status: 400 });
    if (f.qty < Number(o.received) - 0.0005) return NextResponse.json({ error: `${o.received} ${o.unit || ""} has already come in against this order; the order can't be less than that.`.replace("  ", " ") }, { status: 400 });
    if (!f.orderDate) return NextResponse.json({ error: "Enter the order date." }, { status: 400 });
    await db.execute(sql`
      UPDATE store_orders SET qty = ${f.qty}, supplier = ${f.supplier}, po_no = ${f.poNo}, order_date = ${f.orderDate}::date,
             expected_date = ${f.expectedDate}::date, notes = ${f.notes}
      WHERE id = ${id}`);
    await logActivity({ user: guard, action: "store.order.update", summary: `changed the order of "${o.name}" (order ${id}): ${f.qty} ${o.unit || ""}`.trim() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE ?id= — an order nothing has come in against (one with deliveries is cancelled instead).
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store.orders");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const id = parseInt(req.nextUrl.searchParams.get("id") || "");
    const [o] = rowsOf(await db.execute(sql`
      SELECT o.part_id AS "partId", p.name,
             (SELECT COUNT(*) FROM transactions t WHERE t.order_id = o.id) AS n
      FROM store_orders o JOIN parts p ON p.id = o.part_id WHERE o.id = ${id}`));
    if (!o) return NextResponse.json({ error: "That order was not found." }, { status: 404 });
    const no = await storePartsDenied(guard, [Number(o.partId)]);
    if (no) return no;
    if (Number(o.n) > 0) return NextResponse.json({ error: "Stock has come in against this order, so it can't be deleted - cancel it instead." }, { status: 400 });
    await db.execute(sql`DELETE FROM store_orders WHERE id = ${id}`);
    await logActivity({ user: guard, action: "store.order.delete", summary: `deleted the order of "${o.name}" (order ${id})` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
