// Product / Supplier directory — read-only, Super Admin only.
// Answers "who did we order this product from, and at what rate", nothing
// more. Does not touch Demand/PO/GRN data or forms in any way — pure read
// over existing purchase_orders rows.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/schema";
import { ensureProcurementTables, parseItems, fmtDate, qtyToNum, type PoItem } from "@/lib/procurement";
import SupplierDirectoryClient, { type DirectoryRow } from "./SupplierDirectoryClient";

export const dynamic = "force-dynamic";

export default async function SupplierDirectoryPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/reports/procurement/suppliers");
  if (user.role !== "superadmin") redirect("/");

  await ensureProcurementTables();
  const pos = await db.select({
    id: purchaseOrders.id,
    poNo: purchaseOrders.poNo,
    date: purchaseOrders.date,
    supplierName: purchaseOrders.supplierName,
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
    for (const it of items) {
      const desc = (it.description || it.item || "").trim();
      if (!desc) continue;

      const rateNum = qtyToNum(it.rate);
      const rate = rateNum && rateNum > 0 ? rateNum : null;
      const qtyNum = qtyToNum(it.quantity);
      const qty = qtyNum && qtyNum > 0 ? qtyNum : null;
      const taxPct = qtyToNum(it.tax) || 0;

      // Gross/Tax/Net only mean something once both qty and rate are usable
      // numbers — otherwise leave them blank rather than show a misleading 0.
      let gross: number | null = null;
      let taxValue = 0;
      let net: number | null = null;
      if (rate != null && qty != null) {
        gross = qty * rate;
        taxValue = gross * taxPct / 100;
        net = gross + taxValue;
      }

      rows.push({
        product: desc,
        supplier: (po.supplierName || "").trim() || "—",
        poId: po.id,
        poNo: po.poNo,
        date: fmtDate(po.date),
        rate,
        uom: (it.uom || "").trim(),
        gross,
        taxPct,
        taxValue,
        net,
      });
    }
  }

  return <SupplierDirectoryClient rows={rows} />;
}
