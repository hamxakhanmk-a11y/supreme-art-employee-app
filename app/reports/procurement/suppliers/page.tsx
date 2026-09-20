// Product / Supplier directory. Answers "who did we order this product from,
// and at what rate". Reads over existing purchase_orders rows; the only write
// is correcting a line's rate / tax %, which goes back to that PO.
//
// Two levels of access:
//   • Super Admin          — the whole report, including the per-order view
//                            with each order's gross / tax / net value.
//   • `suppliers` grant    — the By-product list only (product, supplier,
//     (e.g. Engineer)        contact details, rate, tax %). Order values are
//                            never sent to the browser for these roles.
//   • `suppliers` + edit   — the above, plus editing rate / tax % in place.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { roleCanAccess, roleCanEdit } from "@/lib/permissions";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/schema";
import { ensureProcurementTables, parseItems, qtyToNum, type PoItem } from "@/lib/procurement";
import SupplierDirectoryClient, { type DirectoryRow } from "./SupplierDirectoryClient";

export const dynamic = "force-dynamic";

export default async function SupplierDirectoryPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/reports/procurement/suppliers");
  const isOwner = user.role === "superadmin";
  if (!isOwner && !(await roleCanAccess(user.role, "suppliers"))) redirect("/?denied=suppliers");
  const canEditRates = isOwner || await roleCanEdit(user.role, "suppliers");

  await ensureProcurementTables();
  const pos = await db.select({
    id: purchaseOrders.id,
    poNo: purchaseOrders.poNo,
    date: purchaseOrders.date,
    supplierName: purchaseOrders.supplierName,
    supplierBrand: purchaseOrders.supplierBrand,
    supplierAddress: purchaseOrders.supplierAddress,
    supplierPhone: purchaseOrders.supplierPhone,
    supplierConcernedPerson: purchaseOrders.supplierConcernedPerson,
    supplierNtn: purchaseOrders.supplierNtn,
    supplierStrn: purchaseOrders.supplierStrn,
    items: purchaseOrders.items,
  }).from(purchaseOrders).orderBy(purchaseOrders.poNo);

  // Flatten every PO line into its own row — one product, one supplier, one
  // rate, one date/PO ref. No grouping or dedup here: that happens
  // client-side so the user can toggle between "every order" and "by
  // product" views. poId is the actual purchase_orders.id — that's what the
  // PO detail route needs, not the display poNo.
  const rows: DirectoryRow[] = [];
  for (const po of pos) {
    const items = parseItems<PoItem>(po.items);
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const it = items[itemIndex];
      const desc = (it.description || it.item || "").trim();
      if (!desc) continue;

      const rateNum = qtyToNum(it.rate);
      const rate = rateNum && rateNum > 0 ? rateNum : null;
      const qtyNum = qtyToNum(it.quantity);
      const qty = qtyNum && qtyNum > 0 ? qtyNum : null;
      const taxPct = qtyToNum(it.tax) || 0;

      // Gross/Tax/Net only mean something once both qty and rate are usable
      // numbers — otherwise leave them blank rather than show a misleading 0.
      // They're also what the per-order view is made of, so for roles limited
      // to By-product they're left out of the payload entirely rather than
      // merely hidden — otherwise every order's value would still be sitting
      // in the page's data for anyone who looked.
      let gross: number | null = null;
      let taxValue = 0;
      let net: number | null = null;
      if (isOwner && rate != null && qty != null) {
        gross = qty * rate;
        taxValue = gross * taxPct / 100;
        net = gross + taxValue;
      }

      rows.push({
        product: desc,
        supplier: (po.supplierName || "").trim() || "—",
        supplierBrand: (po.supplierBrand || "").trim(),
        supplierAddress: (po.supplierAddress || "").trim(),
        supplierPhone: (po.supplierPhone || "").trim(),
        supplierConcernedPerson: (po.supplierConcernedPerson || "").trim(),
        supplierNtn: (po.supplierNtn || "").trim(),
        supplierStrn: (po.supplierStrn || "").trim(),
        poId: po.id,
        poNo: po.poNo,
        itemIndex,      // which line of that PO this row came from — the By-product view edits it in place
        date: po.date || "",  // ISO yyyy-mm-dd, formatted for display client-side
        rate,
        uom: (it.uom || "").trim(),
        gross,
        taxPct,
        taxValue,
        net,
      });
    }
  }

  return <SupplierDirectoryClient rows={rows} byProductOnly={!isOwner} canEditRates={canEditRates} />;
}
