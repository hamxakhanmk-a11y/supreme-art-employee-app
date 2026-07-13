import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/schema";
import { sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// GET /api/purchase  -> full register, newest first (filtering happens client-side)
export async function GET() {
  try {
    const rows = await db.select().from(purchaseRequisitions)
      .orderBy(sql`pr_no DESC NULLS LAST, date DESC NULLS LAST`);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/purchase  { date, department, itemName, ... }  (prNo auto-assigned)
export async function POST(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json();
    if (!b.date || !b.department || !b.itemName?.trim()) {
      return NextResponse.json({ error: "date, department and itemName are required" }, { status: 400 });
    }
    const [{ next }] = await db.select({ next: sql<number>`COALESCE(MAX(pr_no), 0) + 1` })
      .from(purchaseRequisitions);
    const [created] = await db.insert(purchaseRequisitions).values({
      prNo: next,
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
    }).returning();
    await logActivity({
      user: guard, action: "purchase.create",
      summary: `PR #${created.prNo} raised — ${created.itemName} (${created.department})`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
