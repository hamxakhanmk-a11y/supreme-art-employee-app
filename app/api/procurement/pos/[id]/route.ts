import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, demands, grns } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, PO_DEFAULT_REMARKS, syncSupplierFromPo, parseItems, docNoLabel, type PoItem } from "@/lib/procurement";

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
  // Manual demand ref (printed on the PO), same rule as create.
  let demandNo: number | null = null;
  if (b.demandNo != null && String(b.demandNo).trim() !== "") {
    const n = parseInt(String(b.demandNo), 10);
    if (!isNaN(n)) demandNo = n;
  }
  // The tax status (which list / sequence the PO belongs to) is fixed at
  // creation — editing never moves a PO between the registered and
  // unregistered lists, which would break its number. Keep the stored value.
  const [existing] = await db.select({ registered: purchaseOrders.registered })
    .from(purchaseOrders).where(eq(purchaseOrders.id, parseInt(id)));
  // Unregistered POs can have their number set by hand (blank = keep current).
  const manualNo = existing?.registered === false ? String(b.manualPoNo ?? "").replace(/[^0-9]/g, "") : "";
  await db.update(purchaseOrders).set({
    ...(manualNo !== "" ? { poNo: parseInt(manualNo, 10) } : {}),
    date: b.date || new Date().toISOString().slice(0, 10),
    demandNo,
    demandByName: b.demandByName || null,
    supplierName: b.supplierName || null,
    supplierBrand: b.supplierBrand || null,
    supplierAddress: b.supplierAddress || null,
    supplierContact: b.supplierContact || null,
    supplierPhone: b.supplierPhone || null,
    supplierConcernedPerson: b.supplierConcernedPerson || null,
    supplierNtn: b.supplierNtn || null,
    supplierStrn: b.supplierStrn || null,
    expectedDate: b.expectedDate || null,
    specification: b.specification || null,
    terms: b.terms || null,
    discount: Number(b.discount) || 0,
    orderPlacedBy: b.orderPlacedBy || null,
    approvedBy: b.approvedBy || null,
    remarks: b.remarks ?? PO_DEFAULT_REMARKS,
    items: JSON.stringify(items),
  }).where(eq(purchaseOrders.id, parseInt(id)));
  await syncSupplierFromPo(b.supplierName, {
    registered: existing?.registered, ntn: b.supplierNtn, strn: b.supplierStrn, address: b.supplierAddress, phone: b.supplierPhone,
    brand: b.supplierBrand, concernedPerson: b.supplierConcernedPerson,
  });
  await logActivity({ user: guard, action: "po.update", summary: `edited PO (id ${id})` });
  return NextResponse.json({ ok: true });
}

// PATCH { itemIndex, rate, tax } — update the rate / tax % on ONE line item
// of this PO, leaving the rest of the order untouched. Used by the Supplier
// Directory's By-product view so a rate can be corrected without opening the
// PO. Gross/Tax value/Net are always derived from rate × qty at render time,
// so they follow automatically — here and on the printed PO.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Two ways in: PO editors, or roles granted edit on the Supplier Directory
  // (Engineer, say) who can correct a rate there without any other PO access.
  // Only ever touches one line's rate/tax — never the rest of the order.
  let guard = await guardWrite("po");
  if (guard instanceof NextResponse) {
    const viaDirectory = await guardWrite("suppliers");
    if (viaDirectory instanceof NextResponse) return guard;
    guard = viaDirectory;
  }
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));

  const itemIndex = Number(b?.itemIndex);
  if (!Number.isInteger(itemIndex) || itemIndex < 0) {
    return NextResponse.json({ error: "itemIndex is required" }, { status: 400 });
  }
  // Blank clears the field back to "not priced yet", same as the PO form.
  const parseField = (v: unknown, label: string): string | { error: string } => {
    if (v === null || v === undefined || String(v).trim() === "") return "";
    const n = Number(v);
    if (!isFinite(n) || n < 0) return { error: `${label} must be a positive number.` };
    return String(n);
  };
  const rate = parseField(b?.rate, "Rate");
  if (typeof rate !== "string") return NextResponse.json({ error: rate.error }, { status: 400 });
  const tax = parseField(b?.tax, "Tax %");
  if (typeof tax !== "string") return NextResponse.json({ error: tax.error }, { status: 400 });

  const [po] = await db.select({
    items: purchaseOrders.items, poNo: purchaseOrders.poNo, registered: purchaseOrders.registered,
  }).from(purchaseOrders).where(eq(purchaseOrders.id, parseInt(id)));
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = parseItems<PoItem>(po.items);
  const line = items[itemIndex];
  if (!line) return NextResponse.json({ error: "That line item no longer exists on this PO." }, { status: 400 });

  items[itemIndex] = { ...line, rate, tax };
  await db.update(purchaseOrders).set({ items: JSON.stringify(items) }).where(eq(purchaseOrders.id, parseInt(id)));

  const what = line.description || line.item || `line ${itemIndex + 1}`;
  await logActivity({
    user: guard, action: "po.set-item-rate",
    summary: `set rate on PO #${docNoLabel(po.poNo, po.registered)} — "${what}": ${rate || "—"} @ ${tax || "0"}% tax`,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const poId = parseInt(id);

  // Note the linked demand + tax status before deleting.
  const [po] = await db.select({ demandId: purchaseOrders.demandId, registered: purchaseOrders.registered })
    .from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // GRRs raised against this PO decide how deletion behaves:
  //  • Unregistered PO  → its GRRs are deleted with it (auto-cascade).
  //  • Registered PO    → blocked while GRRs exist; delete the GRRs first, so
  //    received-goods records are never silently discarded.
  const linkedGrns = await db.select({ id: grns.id }).from(grns).where(eq(grns.poId, poId));
  if (linkedGrns.length) {
    if (po.registered === false) {
      await db.delete(grns).where(eq(grns.poId, poId));
    } else {
      return NextResponse.json({
        error: `This PO has ${linkedGrns.length} GRR(s). Delete the GRR(s) first, then delete the PO.`,
      }, { status: 409 });
    }
  }
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
