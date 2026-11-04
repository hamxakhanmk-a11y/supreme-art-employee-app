// Product / Supplier directory. Answers "who did we order this product from,
// and at what rate". Reads over existing purchase_orders rows; purchase
// orders are never written to from here. Rates shown come off each product's
// most recent PO unless someone has noted their own figure against that
// product + supplier, which is kept separately (supplier_product_rates) as
// reference only.
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
import { purchaseOrders, supplierProductRates, grns } from "@/lib/schema";
import { ensureProcurementTables, parseItems, computePoReceipts, loadChecklist, type PoItem, type GrnItem } from "@/lib/procurement";
import { procurementExpenses, poLineValue, type ExpenseLine, type SkippedLine } from "@/lib/expenses";
import SupplierDirectoryClient, { type DirectoryRow, type ReceivedRow } from "./SupplierDirectoryClient";

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
    registered: purchaseOrders.registered,
    discount: purchaseOrders.discount,
  }).from(purchaseOrders).orderBy(purchaseOrders.poNo);

  // What has arrived of each PO line, from every GRR raised against the PO — the same reckoning that sets
  // the PO's own open / partial / received status.
  const grnRows = await db.select({
    id: grns.id, grnNo: grns.grnNo, registered: grns.registered, date: grns.date, poId: grns.poId, poNo: grns.poNo,
    items: grns.items, inspection: grns.inspection,
  }).from(grns);
  const grnItemsByPo = new Map<number, GrnItem[]>();
  for (const g of grnRows) if (g.poId != null) grnItemsByPo.set(g.poId, [...(grnItemsByPo.get(g.poId) ?? []), ...parseItems<GrnItem>(g.items)]);

  // Flatten every PO line into its own row — one product, one supplier, one
  // rate, one date/PO ref. No grouping or dedup here: that happens
  // client-side so the user can toggle between "every order" and "by
  // product" views. poId is the actual purchase_orders.id — that's what the
  // PO detail route needs, not the display poNo.
  const rows: DirectoryRow[] = [];
  for (const po of pos) {
    const items = parseItems<PoItem>(po.items);
    const receipts = new Map(computePoReceipts(items, grnItemsByPo.get(po.id) ?? []).map(r => [r.srNo, r]));
    for (const it of items) {
      const desc = (it.description || it.item || "").trim();
      if (!desc) continue;

      // The same arithmetic as the dashboard's Ordered expense (lib/expenses.ts), so the two totals agree.
      const v = poLineValue(it);
      const { rate, taxPct } = v;

      // Gross/Tax/Net only mean something once both qty and rate are usable
      // numbers — otherwise leave them blank rather than show a misleading 0.
      // They're also what the per-order view is made of, so for roles limited
      // to By-product they're left out of the payload entirely rather than
      // merely hidden — otherwise every order's value would still be sitting
      // in the page's data for anyone who looked.
      const gross = isOwner ? v.gross : null;
      const taxValue = isOwner ? v.taxValue : 0;
      const net = isOwner ? v.net : null;

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
        date: po.date || "",  // ISO yyyy-mm-dd, formatted for display client-side
        rate,
        uom: (it.uom || "").trim(),
        gross,
        taxPct,
        taxValue,
        net,
        received: (() => {
          const r = receipts.get(it.srNo);
          if (!r || !(r.hasReceipt || r.received > 0)) return "none" as const;
          return r.fulfilled ? "full" as const : "partial" as const;
        })(),
        receivedQty: receipts.get(it.srNo)?.received ?? 0,
        orderedQty: receipts.get(it.srNo)?.ordered ?? null,
      });
    }
  }

  // Received only (the owner's): every GRR line, on its GRR date, valued exactly as the dashboard's Procurement
  // is (lib/expenses.ts: received qty × PO rate + tax, less the PO's discount share, never more than ordered,
  // rejected GRRs left out). All dates are worked out here; the page narrows them to its From–To.
  const received: ReceivedRow[] = [];
  let receivedNotCounted = 0;
  if (isOwner) {
    const lines: ExpenseLine[] = [], skipped: SkippedLine[] = [];
    procurementExpenses(grnRows, pos.map(p => ({ ...p, supplierName: p.supplierName })), await loadChecklist(), "0000-01-01", "9999-12-31", lines, skipped);
    receivedNotCounted = skipped.length;
    // A GRR checked against several categories gives one line per category; here it is one row again.
    const byLine = new Map<string, ReceivedRow>();
    for (const l of lines) {
      const r = byLine.get(l.lineId!);
      if (r) { r.net += l.amount; continue; }
      byLine.set(l.lineId!, {
        lineId: l.lineId!, date: l.date, product: l.description, supplier: l.supplier || "—", grr: l.ref, href: l.href,
        po: l.po || "", poDate: l.poDate || "", qty: l.qty ?? 0, rate: l.rate ?? 0, taxPct: l.taxPct ?? 0, net: l.amount, calc: l.calc || "",
      });
    }
    received.push(...byLine.values());
  }

  // Hand-noted reference rates, keyed the same way the By-product view groups
  // (exact product description + supplier name). Where one exists it's shown
  // instead of the PO's rate; the PO itself is never changed by it.
  const noted = await db.select().from(supplierProductRates);
  const rateNotes: Record<string, { rate: number | null; taxPct: number | null }> = {};
  for (const n of noted) rateNotes[JSON.stringify([n.product, n.supplier])] = { rate: n.rate, taxPct: n.taxPct };

  return (
    <SupplierDirectoryClient
      rows={rows}
      rateNotes={rateNotes}
      received={received}
      receivedNotCounted={receivedNotCounted}
      byProductOnly={!isOwner}
      canEditRates={canEditRates}
    />
  );
}
