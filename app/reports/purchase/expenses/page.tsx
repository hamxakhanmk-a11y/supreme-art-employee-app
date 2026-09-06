// Expense Report — read-only, Super Admin only.
// Every expense line item raised through the Purchase Requisition register,
// with its category and value. Does not touch the Purchase register or its
// forms in any way — pure read over existing purchase_requisitions rows.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/schema";
import { parsePrItems } from "@/lib/purchase";
import ExpenseReportClient, { type ExpenseRow } from "./ExpenseReportClient";

export const dynamic = "force-dynamic";

export default async function ExpenseReportPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/reports/purchase/expenses");
  if (user.role !== "superadmin") redirect("/");

  const prs = await db.select({
    id: purchaseRequisitions.id,
    prNo: purchaseRequisitions.prNo,
    date: purchaseRequisitions.date,
    department: purchaseRequisitions.department,
    category: purchaseRequisitions.category,
    items: purchaseRequisitions.items,
    itemName: purchaseRequisitions.itemName,
    quantity: purchaseRequisitions.quantity,
    uom: purchaseRequisitions.uom,
    value: purchaseRequisitions.value,
  }).from(purchaseRequisitions).orderBy(purchaseRequisitions.id);

  // Flatten every line item into its own expense row — one description, one
  // value, one category. parsePrItems already handles both the modern
  // multi-item JSON and the legacy single-line scalar columns, so old and
  // new requisitions come through the same shape.
  const rows: ExpenseRow[] = [];
  for (const pr of prs) {
    const items = parsePrItems(pr);
    for (const it of items) {
      if (!it.itemName && it.value == null) continue;
      rows.push({
        prNo: pr.prNo,
        date: pr.date || "",                       // ISO yyyy-mm-dd, or "" if never set
        department: pr.department || "",
        category: it.category || pr.category || "",
        description: it.itemName || "",
        quantity: it.quantity,
        uom: it.uom || "",
        value: it.value,
      });
    }
  }

  return <ExpenseReportClient rows={rows} />;
}
