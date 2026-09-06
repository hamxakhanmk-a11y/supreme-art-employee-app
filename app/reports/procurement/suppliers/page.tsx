// Product / Supplier directory — read-only, Super Admin only.
// Answers "who did we order this product from", nothing more. Does not
// touch Demand/PO/GRN data or forms in any way — pure read over existing
// purchase_orders rows.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/schema";
import { ensureProcurementTables, parseItems, fmtDate, type PoItem } from "@/lib/procurement";
import SupplierDirectoryClient, { type DirectoryRow } from "./SupplierDirectoryClient";

export const dynamic = "force-dynamic";

export default async function SupplierDirectoryPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/reports/procurement/suppliers");
  if (user.role !== "superadmin") redirect("/");

  await ensureProcurementTables();
  const pos = await db.select({
    poNo: purchaseOrders.poNo,
    date: purchaseOrders.date,
    supplierName: purchaseOrders.supplierName,
    items: purchaseOrders.items,
  }).from(purchaseOrders).orderBy(purchaseOrders.poNo);

  // Flatten every PO line into its own row — one product, one supplier, one
  // date/PO ref. No grouping or dedup here: that happens client-side so the
  // user can toggle between "every order" and "by product" views.
  const rows: DirectoryRow[] = [];
  for (const po of pos) {
    const items = parseItems<PoItem>(po.items);
    for (const it of items) {
      const desc = (it.description || it.item || "").trim();
      if (!desc) continue;
      rows.push({
        product: desc,
        supplier: (po.supplierName || "").trim() || "—",
        poNo: po.poNo,
        date: fmtDate(po.date),
      });
    }
  }

  return <SupplierDirectoryClient rows={rows} />;
}
