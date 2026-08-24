import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { grns, purchaseOrders } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, nextGrnNo, recomputePoStatus } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const rows = await db.select().from(grns).orderBy(desc(grns.grnNo));
  return NextResponse.json({ grns: rows });
}

export async function POST(req: Request) {
  const guard = await guardWrite("grn");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const b = await req.json().catch(() => ({}));

  // Optional link to a PO (picker) — stamps its number and marks it received.
  let poId: number | null = null;
  let poNo: number | null = null;
  if (b.poId) {
    const [p] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, Number(b.poId)));
    if (p) { poId = p.id; poNo = p.poNo; }
  }
  // Manual "PO Ref No" — overrides / fills the number when typed by hand.
  if (b.poNo != null && String(b.poNo).trim() !== "") {
    const n = parseInt(String(b.poNo), 10);
    if (!isNaN(n)) poNo = n;
  }

  const grnNo = await nextGrnNo();

  const items = Array.isArray(b.items) ? b.items : [];
  const [row] = await db.insert(grns).values({
    grnNo,
    poId,
    poNo,
    gatePassNo: b.gatePassNo || null,
    invNo: b.invNo || null,
    date: b.date || new Date().toISOString().slice(0, 10),
    receivedBy: b.receivedBy || null,
    verifiedBy: b.verifiedBy || null,
    items: JSON.stringify(items),
    createdByUserId: guard.id,
    createdByName: guard.name,
  }).returning();

  // Reconcile the source PO — partial vs fully received, based on all its GRNs.
  await recomputePoStatus(poId);

  await logActivity({
    user: guard, action: "grn.create",
    summary: `created GRN #${grnNo}${poNo ? ` (for PO #${poNo})` : ""}`,
  });
  return NextResponse.json({ grn: row });
}
