import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, demands } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, PO_DEFAULT_REMARKS } from "@/lib/procurement";

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
  await db.update(purchaseOrders).set({
    date: b.date || new Date().toISOString().slice(0, 10),
    demandByName: b.demandByName || null,
    supplierName: b.supplierName || null,
    supplierAddress: b.supplierAddress || null,
    supplierContact: b.supplierContact || null,
    supplierPhone: b.supplierPhone || null,
    expectedDate: b.expectedDate || null,
    specification: b.specification || null,
    terms: b.terms || null,
    discount: Number(b.discount) || 0,
    orderPlacedBy: b.orderPlacedBy || null,
    approvedBy: b.approvedBy || null,
    remarks: b.remarks ?? PO_DEFAULT_REMARKS,
    items: JSON.stringify(items),
  }).where(eq(purchaseOrders.id, parseInt(id)));
  await logActivity({ user: guard, action: "po.update", summary: `edited PO (id ${id})` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const poId = parseInt(id);

  // Note the linked demand (if any) before deleting so we can re-open it.
  const [po] = await db.select({ demandId: purchaseOrders.demandId }).from(purchaseOrders).where(eq(purchaseOrders.id, poId));
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
