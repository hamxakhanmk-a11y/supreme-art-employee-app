import { db } from "@/lib/db";
import { demands, purchaseOrders, grns, inspections } from "@/lib/schema";
import { and, gte, lte } from "drizzle-orm";
import { ensureProcurementTables, parseItems } from "@/lib/procurement";
import ProcurementReportClient, { type DocRow } from "./ProcurementReportClient";

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

  return <ProcurementReportClient rows={rows} from={from} to={to} />;
}
