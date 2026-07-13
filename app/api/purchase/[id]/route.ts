import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// PATCH /api/purchase/[id]  -> quick workflow action from the row buttons.
//   { action: "approve" | "reject" | "received" }
// Toggles: clicking an already-active action clears it back to pending.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const { action } = await req.json();
    const col = purchaseRequisitions;

    // Single round-trip: toggle in-place with a CASE on the current value.
    const patch =
      action === "approve" ? { hrApproval: sql`CASE WHEN ${col.hrApproval} = 'Approved' THEN NULL ELSE 'Approved' END` } :
      action === "reject"  ? { hrApproval: sql`CASE WHEN ${col.hrApproval} = 'Rejected' THEN NULL ELSE 'Rejected' END` } :
      action === "received" ? {
        status: sql`CASE WHEN ${col.status} = 'Material Received' THEN 'PR Raised' ELSE 'Material Received' END`,
        receivedByAdmin: sql`CASE WHEN ${col.status} = 'Material Received' THEN false ELSE true END`,
      } : null;
    if (!patch) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    const [updated] = await db.update(col)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(col.id, parseInt(id))).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const verb =
      action === "approve" ? (updated.hrApproval === "Approved" ? "HR-approved" : "cleared HR approval on") :
      action === "reject"  ? (updated.hrApproval === "Rejected" ? "HR-rejected" : "cleared HR rejection on") :
      (updated.status === "Material Received" ? "marked received" : "un-marked received on");
    await logActivity({
      user: guard, action: `purchase.${action}`,
      summary: `PR #${updated.prNo ?? "—"} ${verb} — ${updated.itemName ?? ""}`.trim(),
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/purchase/[id]  -> update any editable fields
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    if (!b.date || !b.department || !b.itemName?.trim()) {
      return NextResponse.json({ error: "date, department and itemName are required" }, { status: 400 });
    }
    const prNoParsed = b.prNo === null || b.prNo === "" || b.prNo === undefined ? NaN : parseInt(b.prNo);
    const [updated] = await db.update(purchaseRequisitions).set({
      prNo: isNaN(prNoParsed) ? null : prNoParsed,
      date: b.date,
      department: b.department,
      concernedPerson: b.concernedPerson?.trim() || null,
      category: b.category || null,
      itemName: b.itemName.trim(),
      quantity: b.quantity === null || b.quantity === "" || b.quantity === undefined ? null : Number(b.quantity),
      uom: b.uom || null,
      receivedByAdmin: !!b.receivedByAdmin,
      value: b.value === null || b.value === "" || b.value === undefined ? null : Math.round(Number(b.value)),
      requiredDate: b.requiredDate || null,
      hodApproval: b.hodApproval || null,
      hrApproval: b.hrApproval || null,
      status: b.status || "PR Raised",
      poNo: b.poNo?.trim() || null,
      remarks: b.remarks?.trim() || null,
      updatedAt: new Date(),
    }).where(eq(purchaseRequisitions.id, parseInt(id))).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logActivity({
      user: guard, action: "purchase.update",
      summary: `PR #${updated.prNo} updated — ${updated.itemName} (${updated.status})`,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/purchase/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const [victim] = await db.select().from(purchaseRequisitions)
      .where(eq(purchaseRequisitions.id, parseInt(id)));
    await db.delete(purchaseRequisitions).where(eq(purchaseRequisitions.id, parseInt(id)));
    if (victim) {
      await logActivity({
        user: guard, action: "purchase.delete",
        summary: `PR #${victim.prNo} deleted — ${victim.itemName}`,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
