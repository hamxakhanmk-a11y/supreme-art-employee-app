import { NextResponse } from "next/server";
import { desc, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, demands } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, PO_DEFAULT_REMARKS } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const rows = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.poNo));
  return NextResponse.json({ pos: rows });
}

export async function POST(req: Request) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const b = await req.json().catch(() => ({}));

  const [{ n }] = await db.select({ n: max(purchaseOrders.poNo) }).from(purchaseOrders);
  const poNo = Number(n ?? 0) + 1;

  // Optional link to a demand.
  let demandId: number | null = null;
  let demandNo: number | null = null;
  if (b.demandId) {
    const [d] = await db.select().from(demands).where(eq(demands.id, Number(b.demandId)));
    if (d) { demandId = d.id; demandNo = d.demandNo; }
  }

  const items = Array.isArray(b.items) ? b.items : [];
  const [row] = await db.insert(purchaseOrders).values({
    poNo,
    demandId,
    demandNo,
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
    status: "open",
    createdByUserId: guard.id,
    createdByName: guard.name,
  }).returning();

  // Mark the source demand as ordered.
  if (demandId) await db.update(demands).set({ status: "ordered" }).where(eq(demands.id, demandId));

  await logActivity({
    user: guard, action: "po.create",
    summary: `created PO #${poNo}${demandNo ? ` (from Demand #${demandNo})` : ""}`,
  });
  return NextResponse.json({ po: row });
}
