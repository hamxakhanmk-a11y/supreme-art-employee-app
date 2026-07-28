import { db } from "@/lib/db";
import { demands, purchaseOrders, grns, inspections } from "@/lib/schema";
import { and, gte, lte } from "drizzle-orm";
import {
  ensureProcurementTables, parseItems, fmtDate, poLineMoney,
  type DemandItem, type PoItem, type GrnItem, type InspectionRow,
} from "@/lib/procurement";
import ProcurementReportClient, { type DocRow, type ExportData, type ExportRow } from "./ProcurementReportClient";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string };

export default async function ProcurementReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const from = sp.from || first;
  const to = sp.to || now.toISOString().slice(0, 10);

  await ensureProcurementTables();
  const [ds, ps, gs, is] = await Promise.all([
    db.select().from(demands).where(and(gte(demands.date, from), lte(demands.date, to))),
    db.select().from(purchaseOrders).where(and(gte(purchaseOrders.date, from), lte(purchaseOrders.date, to))),
    db.select().from(grns).where(and(gte(grns.date, from), lte(grns.date, to))),
    db.select().from(inspections).where(and(gte(inspections.date, from), lte(inspections.date, to))),
  ]);

  const rows: DocRow[] = [
    ...ds.map(d => ({
      kind: "demand" as const,
      id: d.id,
      no: d.demandNo,
      date: d.date,
      ref: null,
      party: d.demandBy || d.department || "",
      items: parseItems<unknown>(d.items).length,
      // A demand that has been turned into a PO is no longer just "created".
      status: d.status === "open" ? "Demand created" : "PO created",
      by: d.createdByName || "",
    })),
    ...ps.map(p => ({
      kind: "po" as const,
      id: p.id,
      no: p.poNo,
      date: p.date,
      ref: p.demandNo,
      party: p.supplierName || "",
      items: parseItems<unknown>(p.items).length,
      status: p.status === "received" ? "Delivered" : "PO created",
      by: p.createdByName || "",
    })),
    ...gs.map(g => ({
      kind: "grn" as const,
      id: g.id,
      no: g.grnNo,
      date: g.date,
      ref: g.poNo,
      party: g.receivedBy || "",
      items: parseItems<unknown>(g.items).length,
      status: "Delivered",
      by: g.createdByName || "",
    })),
    ...is.map(i => ({
      kind: "inspection" as const,
      id: i.id,
      no: i.inspNo,
      date: i.date,
      ref: i.poNo,
      party: i.supplierName || i.materialType || "",
      // Item count is meaningless here — the grid is a fixed parameter list.
      items: null,
      status: "Inspected",
      by: i.inspectedBy || i.createdByName || "",
    })),
  ].sort((a, b) => (a.date === b.date ? b.no - a.no : b.date.localeCompare(a.date)));

  // Full, item-level export data — one spreadsheet line per line item, with all
  // the document + product + supplier fields. Tagged with the same "kind-id"
  // key used on screen, so the client can export exactly what the filters show.
  const dash = (v: unknown) => (v == null || v === "" ? "" : String(v));

  const exportData: ExportData = {
    demand: ds.flatMap((d): ExportRow[] => {
      const its = parseItems<DemandItem>(d.items);
      const base = [
        d.demandNo, fmtDate(d.date), fmtDate(d.requiredBy), dash(d.demandBy), dash(d.department),
        dash(d.preparedBy), dash(d.approvedBy), d.status === "open" ? "Demand created" : "PO created",
      ];
      const key = `demand-${d.id}`;
      if (its.length === 0) return [{ key, cells: [...base, "", "", "", "", "", dash(d.createdByName)] }];
      return its.map((it) => ({
        key,
        cells: [...base, it.srNo, dash(it.material), dash(it.requiredFor), dash(it.quantity), dash(it.remarks), dash(d.createdByName)],
      }));
    }),
    po: ps.flatMap((p): ExportRow[] => {
      const its = parseItems<PoItem>(p.items);
      const base = [
        p.poNo, fmtDate(p.date), p.demandNo != null ? String(p.demandNo) : "", dash(p.supplierName),
        dash(p.supplierAddress), dash(p.supplierContact || p.supplierPhone), fmtDate(p.expectedDate),
        dash(p.orderPlacedBy), p.status === "received" ? "Delivered" : "PO created",
      ];
      const key = `po-${p.id}`;
      if (its.length === 0) return [{ key, cells: [...base, "", "", "", "", "", "", "", "", "", dash(p.createdByName)] }];
      return its.map((it) => {
        const { rate, gross, taxPct, taxValue, net } = poLineMoney(it);
        return {
          key,
          cells: [
            ...base, it.srNo, dash(it.description || it.item), dash(it.quantity), dash(it.uom),
            rate || "", gross || "", it.tax ? taxPct : "", taxValue || "", net || "", dash(p.createdByName),
          ],
        };
      });
    }),
    grn: gs.flatMap((g): ExportRow[] => {
      const its = parseItems<GrnItem>(g.items);
      const base = [
        g.grnNo, dash(g.gatePassNo), fmtDate(g.date), g.poNo != null ? String(g.poNo) : "",
        dash(g.receivedBy), dash(g.verifiedBy),
      ];
      const key = `grn-${g.id}`;
      if (its.length === 0) return [{ key, cells: [...base, "", "", "", dash(g.createdByName)] }];
      return its.map((it) => ({
        key,
        cells: [...base, it.srNo, dash(it.item), dash(it.quantity), dash(g.createdByName)],
      }));
    }),
    inspection: is.flatMap((i): ExportRow[] => {
      const rowsIn = parseItems<InspectionRow>(i.results);
      const base = [
        i.inspNo, fmtDate(i.date), i.poNo != null ? String(i.poNo) : "", dash(i.materialType),
        dash(i.supplierName), dash(i.inspectedBy || i.createdByName),
      ];
      const key = `inspection-${i.id}`;
      if (rowsIn.length === 0) return [{ key, cells: [...base, "", "", "", "", "", ""] }];
      return rowsIn.map((r) => ({
        key,
        cells: [...base, dash(r.parameter), dash(r.standard), ...[0, 1, 2, 3].map((n) => dash(r.samples?.[n]))],
      }));
    }),
  };

  return <ProcurementReportClient rows={rows} from={from} to={to} exportData={exportData} />;
}
