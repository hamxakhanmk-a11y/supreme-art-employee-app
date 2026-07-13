import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

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
    const [updated] = await db.update(purchaseRequisitions).set({
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
