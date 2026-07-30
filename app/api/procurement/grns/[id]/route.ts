import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { grns, purchaseOrders } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const [row] = await db.select().from(grns).where(eq(grns.id, parseInt(id)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ grn: row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("grn");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const items = Array.isArray(b.items) ? b.items : [];
  // Manual PO ref, same rule as create.
  let poNo: number | null = null;
  if (b.poNo != null && String(b.poNo).trim() !== "") {
    const n = parseInt(String(b.poNo), 10);
    if (!isNaN(n)) poNo = n;
  }
  await db.update(grns).set({
    gatePassNo: b.gatePassNo || null,
    invNo: b.invNo || null,
    poNo,
    date: b.date || new Date().toISOString().slice(0, 10),
    receivedBy: b.receivedBy || null,
    verifiedBy: b.verifiedBy || null,
    items: JSON.stringify(items),
  }).where(eq(grns.id, parseInt(id)));
  await logActivity({ user: guard, action: "grn.update", summary: `edited GRN (id ${id})` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("grn");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const grnId = parseInt(id);

  // Note the linked PO (if any) before deleting so we can re-open it.
  const [g] = await db.select({ poId: grns.poId }).from(grns).where(eq(grns.id, grnId));
  await db.delete(grns).where(eq(grns.id, grnId));

  // Deleting a PO's only GRN re-opens that PO (back to "open" from "received")
  // so it reappears in the GRN picker. Only revert if no other GRN references it.
  if (g?.poId) {
    const [other] = await db.select({ id: grns.id }).from(grns)
      .where(and(eq(grns.poId, g.poId), ne(grns.id, grnId)))
      .limit(1);
    if (!other) await db.update(purchaseOrders).set({ status: "open" }).where(eq(purchaseOrders.id, g.poId));
  }

  await logActivity({ user: guard, action: "grn.delete", summary: `deleted GRN (id ${id})` });
  return NextResponse.json({ ok: true });
}
