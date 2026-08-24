import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { grns } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, recomputePoStatus } from "@/lib/procurement";

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
  // Unregistered GRRs can have their number set by hand (blank = keep current).
  const [existing] = await db.select({ registered: grns.registered }).from(grns).where(eq(grns.id, parseInt(id)));
  const manualNo = existing?.registered === false ? String(b.manualGrnNo ?? "").replace(/[^0-9]/g, "") : "";
  await db.update(grns).set({
    ...(manualNo !== "" ? { grnNo: parseInt(manualNo, 10) } : {}),
    gatePassNo: b.gatePassNo || null,
    invNo: b.invNo || null,
    poNo,
    date: b.date || new Date().toISOString().slice(0, 10),
    receivedBy: b.receivedBy || null,
    verifiedBy: b.verifiedBy || null,
    items: JSON.stringify(items),
  }).where(eq(grns.id, parseInt(id)));
  // Editing received quantities can change the PO's partial/received status.
  const [gRow] = await db.select({ poId: grns.poId }).from(grns).where(eq(grns.id, parseInt(id)));
  await recomputePoStatus(gRow?.poId);
  await logActivity({ user: guard, action: "grn.update", summary: `edited GRN (id ${id})` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("grn");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const grnId = parseInt(id);

  // Note the linked PO (if any) before deleting so we can reconcile it after.
  const [g] = await db.select({ poId: grns.poId }).from(grns).where(eq(grns.id, grnId));
  await db.delete(grns).where(eq(grns.id, grnId));

  // Deleting a GRN gives back its received quantities — the PO may drop from
  // received → partial, or partial → open, so recompute from what's left.
  await recomputePoStatus(g?.poId);

  await logActivity({ user: guard, action: "grn.delete", summary: `deleted GRN (id ${id})` });
  return NextResponse.json({ ok: true });
}
