import { NextResponse } from "next/server";
import { desc, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { inspections, purchaseOrders } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, nextNumber, NUMBER_START } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const rows = await db.select().from(inspections).orderBy(desc(inspections.inspNo));
  return NextResponse.json({ inspections: rows });
}

export async function POST(req: Request) {
  const guard = await guardWrite("inspection");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const b = await req.json().catch(() => ({}));

  const [{ n }] = await db.select({ n: max(inspections.inspNo) }).from(inspections);
  const inspNo = nextNumber(n, NUMBER_START.inspection);

  // Optional link to a PO — stamps its number.
  let poId: number | null = null;
  let poNo: number | null = null;
  if (b.poId) {
    const [p] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, Number(b.poId)));
    if (p) { poId = p.id; poNo = p.poNo; }
  }

  const results = Array.isArray(b.results) ? b.results : [];
  const [row] = await db.insert(inspections).values({
    inspNo,
    poId,
    poNo,
    date: b.date || new Date().toISOString().slice(0, 10),
    materialType: b.materialType || null,
    supplierName: b.supplierName || null,
    results: JSON.stringify(results),
    inspectedBy: b.inspectedBy || null,
    createdByUserId: guard.id,
    createdByName: guard.name,
  }).returning();

  await logActivity({
    user: guard, action: "inspection.create",
    summary: `created Inspection #${inspNo}${poNo ? ` (for PO #${poNo})` : ""}`,
  });
  return NextResponse.json({ inspection: row });
}
