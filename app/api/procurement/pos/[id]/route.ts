import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, demands, grns } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, PO_DEFAULT_REMARKS, syncSupplierFromPo } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, parseInt(id)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ po: row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const items = Array.isArray(b.items) ? b.items : [];
  // Manual demand ref (printed on the PO), same rule as create.
  let demandNo: number | null = null;
  if (b.demandNo != null && String(b.demandNo).trim() !== "") {
    const n = parseInt(String(b.demandNo), 10);
    if (!isNaN(n)) demandNo = n;
  }
  await db.update(purchaseOrders).set({
    date: b.date || new Date().toISOString().slice(0, 10),
    demandNo,
    demandByName: b.demandByName || null,
    supplierName: b.supplierName || null,
    supplierAddress: b.supplierAddress || null,
    supplierContact: b.supplierContact || null,
    supplierPhone: b.supplierPhone || null,
    supplierNtn: b.supplierNtn || null,
    supplierStrn: b.supplierStrn || null,
    expectedDate: b.expectedDate || null,
    specification: b.specification || null,
    terms: b.terms || null,
    discount: Number(b.discount) || 0,
    orderPlacedBy: b.orderPlacedBy || null,
    approvedBy: b.approvedBy || null,
    remarks: b.remarks ?? PO_DEFAULT_REMARKS,
    items: JSON.stringify(items),
  }).where(eq(purchaseOrders.id, parseInt(id)));
  await syncSupplierFromPo(b.supplierName, {
    ntn: b.supplierNtn, strn: b.supplierStrn, address: b.supplierAddress, phone: b.supplierPhone,
  });
  await logActivity({ user: guard, action: "po.update", summary: `edited PO (id ${id})` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const poId = parseInt(id);

  // Note the linked demand before deleting.
  const [po] = await db.select({ demandId: purchaseOrders.demandId })
    .from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Blocked while GRRs exist — delete the GRR(s) first, so received-goods
  // records are never silently discarded.
  const linkedGrns = await db.select({ id: grns.id }).from(grns).where(eq(grns.poId, poId));
  if (linkedGrns.length) {
    return NextResponse.json({
      error: `This PO has ${linkedGrns.length} GRR(s). Delete the GRR(s) first, then delete the PO.`,
    }, { status: 409 });
  }
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));

  // Deleting a demand's only PO should re-open that demand so a new PO can be
  // raised for it. Only revert when no *other* PO still references the demand.
  if (po?.demandId) {
    const [other] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders)
      .where(and(eq(purchaseOrders.demandId, po.demandId), ne(purchaseOrders.id, poId)))
      .limit(1);
    if (!other) await db.update(demands).set({ status: "open" }).where(eq(demands.id, po.demandId));
  }

  await logActivity({ user: guard, action: "po.delete", summary: `deleted PO (id ${id})` });
  return NextResponse.json({ ok: true });
}
