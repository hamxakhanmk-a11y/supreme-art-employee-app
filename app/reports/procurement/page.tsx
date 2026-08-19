import { db } from "@/lib/db";
import { purchaseOrders, grns } from "@/lib/schema";
import { and, gte, lte } from "drizzle-orm";
import {
  ensureProcurementTables, parseItems, computePoReceipts, docNoLabel,
  type PoItem, type GrnItem,
} from "@/lib/procurement";
import ProcurementReportClient, { type MasterRow } from "./ProcurementReportClient";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string };

const normDesc = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export default async function ProcurementReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const from = sp.from || first;
  const to = sp.to || now.toISOString().slice(0, 10);

  await ensureProcurementTables();
  // POs anchor the report (they carry the description, supplier, demand ref and
  // link to GRRs). GRRs are pulled in full — not date-filtered — so a PO's
  // received status is correct even when its goods arrived after the "to" date.
  const [ps, gs] = await Promise.all([
    db.select().from(purchaseOrders).where(and(gte(purchaseOrders.date, from), lte(purchaseOrders.date, to))),
    db.select().from(grns),
  ]);

  // One row per PO line item, traced Demand → PO → GRR with a received status.
  const rows: MasterRow[] = [];
  for (const p of ps) {
    const poItems = parseItems<PoItem>(p.items);
    const poGrns = gs.filter(g => g.poId === p.id);
    const grnItems = poGrns.flatMap(g => parseItems<GrnItem>(g.items));
    const receipts = computePoReceipts(poItems, grnItems);

    // Which GRR(s) received each PO line (match by poSrNo, else by description).
    const srByDesc = new Map<string, number>();
    for (const it of poItems) {
      const d = normDesc(it.description || it.item || "");
      if (d && !srByDesc.has(d)) srByDesc.set(d, it.srNo);
    }
    const grrBySr = new Map<number, Set<string>>();
    for (const g of poGrns) {
      const label = docNoLabel(g.grnNo, g.registered);
      for (const it of parseItems<GrnItem>(g.items)) {
        let sr = it.poSrNo;
        if (sr == null) sr = srByDesc.get(normDesc(it.item || ""));
        if (sr == null) continue;
        if (!grrBySr.has(sr)) grrBySr.set(sr, new Set());
        grrBySr.get(sr)!.add(label);
      }
    }

    const poNo = docNoLabel(p.poNo, p.registered);
    const demandNo = p.demandNo != null ? String(p.demandNo) : "";
    const supplier = p.supplierName || "";
    const allGrr = [...new Set(poGrns.map(g => docNoLabel(g.grnNo, g.registered)))].join(", ");

    if (poItems.length === 0) {
      rows.push({
        description: "", supplier, demandNo, poNo, grr: allGrr,
        status: poGrns.length ? "partial" : "none", date: p.date,
      });
      continue;
    }

    poItems.forEach((it, i) => {
      const r = receipts[i];
      const status: MasterRow["status"] = r.fulfilled ? "received"
        : (r.hasReceipt || r.received > 0) ? "partial" : "none";
      rows.push({
        description: it.description || it.item || "",
        supplier, demandNo, poNo,
        grr: [...(grrBySr.get(it.srNo) ?? [])].join(", "),
        status,
        date: p.date,
      });
    });
  }

  // Newest POs first, then by PO number, then line order.
  rows.sort((a, b) => (a.date === b.date ? b.poNo.localeCompare(a.poNo, undefined, { numeric: true }) : b.date.localeCompare(a.date)));

  return <ProcurementReportClient rows={rows} from={from} to={to} />;
}
