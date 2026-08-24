import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, demands } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, PO_DEFAULT_REMARKS, nextPoNo, syncSupplierFromPo } from "@/lib/procurement";

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

  // Every PO belongs to a list. Registered and unregistered are numbered as two
  // separate sequences, so we must know which one before assigning a number.
  const registered = b.registered === true ? true : b.registered === false ? false : null;
  if (registered === null) {
    return NextResponse.json({ error: "Choose the Registered or Unregistered list first." }, { status: 400 });
  }
  const poNo = await nextPoNo(registered);

  // Optional link to a demand (picker) — stamps its number and marks it ordered.
  let demandId: number | null = null;
  let demandNo: number | null = null;
  if (b.demandId) {
    const [d] = await db.select().from(demands).where(eq(demands.id, Number(b.demandId)));
    if (d) { demandId = d.id; demandNo = d.demandNo; }
  }
  // Manual "Demand Form Ref No" — overrides / fills the number when typed by
  // hand (e.g. the demand's PO was deleted, or referencing an off-system demand).
  if (b.demandNo != null && String(b.demandNo).trim() !== "") {
    const n = parseInt(String(b.demandNo), 10);
    if (!isNaN(n)) demandNo = n;
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
    supplierNtn: b.supplierNtn || null,
    supplierStrn: b.supplierStrn || null,
    expectedDate: b.expectedDate || null,
    specification: b.specification || null,
    terms: b.terms || null,
    discount: Number(b.discount) || 0,
    registered,
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
  // Push the supplier's details (list, NTN, STRN, address, contact) onto the
  // saved directory so the next PO for this supplier auto-fills them.
  await syncSupplierFromPo(b.supplierName, {
    registered, ntn: b.supplierNtn, strn: b.supplierStrn, address: b.supplierAddress, phone: b.supplierPhone,
  });

  await logActivity({
    user: guard, action: "po.create",
    summary: `created PO #${poNo}${demandNo ? ` (from Demand #${demandNo})` : ""}`,
  });
  return NextResponse.json({ po: row });
}
