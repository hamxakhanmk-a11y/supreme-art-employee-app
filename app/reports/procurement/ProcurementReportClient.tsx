"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate } from "@/lib/procurement";
import { downloadWorkbookXlsx, type SheetSpec } from "@/lib/xlsx";

export interface DocRow {
  kind: "demand" | "po" | "grn" | "inspection";
  id: number;
  no: number;
  date: string;
  ref: number | null;      // demand no on a PO, PO no on a GRN / inspection
  party: string;           // requester / supplier / receiver
  items: number | null;    // null where a count is meaningless (inspection)
  status: string;          // Demand created | PO created | Delivered | Inspected
  by: string;
}

// One fully-detailed spreadsheet line, tagged with the "kind-id" of its parent
// document so the client can export exactly the rows the filters are showing.
export interface ExportRow { key: string; cells: (string | number | null)[] }
export interface ExportData {
  demand: ExportRow[];
  po: ExportRow[];
  grn: ExportRow[];
  inspection: ExportRow[];
}

// Column layout for each detailed export sheet (order matches page.tsx cells).
const SHEETS = {
  demand: {
    sheetName: "Demands",
    headers: ["Demand No", "Date", "Required By", "Demanded By", "Department", "Prepared By", "Approved By", "Status", "Sr", "Material", "Required For", "Qty", "Item Remarks", "Created By"],
    colWidths: [11, 12, 12, 18, 18, 14, 14, 14, 5, 26, 20, 8, 22, 16],
  },
  po: {
    sheetName: "Purchase Orders",
    headers: ["PO No", "Date", "Demand Ref", "Supplier", "Supplier Address", "Supplier Contact", "Delivery Date", "Order Placed By", "Status", "Sr", "Description", "Qty", "UOM", "Rate", "Gross", "Tax %", "Tax Value", "Net Value", "Created By"],
    colWidths: [10, 12, 11, 22, 28, 18, 13, 16, 13, 5, 26, 8, 8, 12, 13, 8, 13, 14, 16],
  },
  grn: {
    sheetName: "Deliveries (GRR)",
    headers: ["GRR No", "Gate Pass No", "Date", "PO Ref", "Received By", "Verified By", "Sr", "Item", "Qty", "Created By"],
    colWidths: [10, 16, 12, 10, 16, 16, 5, 26, 8, 16],
  },
  inspection: {
    sheetName: "Inspections",
    headers: ["Insp No", "Date", "PO Ref", "Material Type", "Supplier", "Inspected By", "Parameter", "Standard", "Sample 1", "Sample 2", "Sample 3", "Sample 4"],
    colWidths: [10, 12, 10, 20, 22, 16, 22, 16, 12, 12, 12, 12],
  },
} as const;

type Filter = "all" | "demand" | "po" | "delivered" | "inspection";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "demand", label: "Demand created" },
  { key: "po", label: "PO created" },
  { key: "delivered", label: "Delivered" },
  { key: "inspection", label: "Inspected" },
];

const KIND = {
  demand: { label: "Demand", fg: "#185FA5", bg: "#e0f2fe", href: "/procurement/demand" },
  po: { label: "PO", fg: "#B45309", bg: "#fef3c7", href: "/procurement/po" },
  grn: { label: "GRR", fg: "#15803D", bg: "#dcf5dc", href: "/procurement/grn" },
  inspection: { label: "Inspection", fg: "#7C3AED", bg: "#ede9fe", href: "/procurement/inspection" },
} as const;

function matches(r: DocRow, f: Filter) {
  if (f === "all") return true;
  if (f === "demand") return r.kind === "demand";
  if (f === "po") return r.kind === "po";
  if (f === "inspection") return r.kind === "inspection";
  return r.status === "Delivered";   // delivered = goods received
}

export default function ProcurementReportClient({ rows, from, to, exportData }: { rows: DocRow[]; from: string; to: string; exportData: ExportData }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const shown = useMemo(() => rows.filter(r => {
    if (!matches(r, filter)) return false;
    if (!q.trim()) return true;
    const hay = `${KIND[r.kind].label} ${r.no} ${r.party} ${r.status} ${r.by}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }), [rows, filter, q]);

  const counts = useMemo(() => ({
    all: rows.length,
    demand: rows.filter(r => r.kind === "demand").length,
    po: rows.filter(r => r.kind === "po").length,
    delivered: rows.filter(r => r.status === "Delivered").length,
    inspection: rows.filter(r => r.kind === "inspection").length,
  }), [rows]);

  function exportXlsx() {
    // Only export the document types the active filter is showing, and within
    // those only the documents currently visible (respects the text search too).
    const shownKeys = new Set(shown.map(r => `${r.kind}-${r.id}`));
    const range = `${fmtDate(from)} → ${fmtDate(to)}`;

    // Which detailed sheets this filter should produce.
    const wantedKinds: (keyof ExportData)[] =
      filter === "demand"     ? ["demand"] :
      filter === "po"         ? ["po"] :
      filter === "delivered"  ? ["grn"] :
      filter === "inspection" ? ["inspection"] :
      ["demand", "po", "grn", "inspection"];

    const sheets: SheetSpec[] = [];
    for (const kind of wantedKinds) {
      const meta = SHEETS[kind];
      const rowsForSheet = exportData[kind].filter(r => shownKeys.has(r.key)).map(r => r.cells);
      if (rowsForSheet.length === 0) continue;
      sheets.push({
        sheetName: meta.sheetName,
        title: `Supreme Art — ${meta.sheetName}   ${range}`,
        headers: [...meta.headers],
        rows: rowsForSheet,
        colWidths: [...meta.colWidths],
        freezeCols: 2,
      });
    }

    const suffix = filter === "all" ? "all" : SHEETS[wantedKinds[0]].sheetName.toLowerCase().replace(/[^a-z]+/g, "-");
    downloadWorkbookXlsx({
      filename: `procurement-${suffix}_${from}_to_${to}`,
      sheets,
    });
  }

  return (
    <div className="fade-up">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Procurement Report</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
          Demands, purchase orders, goods received and inspections — filter by stage and date.
        </p>
      </div>

      {/* Date range (server) */}
      <form method="GET" className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, fontSize: 13, color: "var(--text2)" }}>
        <span style={{ fontWeight: 600 }}>From</span>
        <input type="date" name="from" defaultValue={from} style={{ width: 150 }} />
        <span>→</span>
        <input type="date" name="to" defaultValue={to} style={{ width: 150 }} />
        <button type="submit" className="btn btn-primary btn-sm">Apply</button>
      </form>

      {/* Stage filter (instant) */}
      <div className="no-print" style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${filter === f.key ? "var(--brand)" : "var(--border)"}`,
              background: filter === f.key ? "var(--brand)" : "var(--bg)",
              color: filter === f.key ? "#fff" : "var(--text)",
            }}
          >{f.label} ({counts[f.key]})</button>
        ))}
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 Number, supplier, person…"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, width: 220, marginLeft: 6 }}
        />
        <div style={{ flex: 1 }} />
        <button onClick={exportXlsx} className="btn btn-sm" disabled={shown.length === 0}>⬇ Export Excel</button>
        <button onClick={() => window.print()} className="btn btn-sm">🖨 Print</button>
      </div>

      <div className="no-print" style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
        Showing <strong>{shown.length}</strong> of {rows.length} document{rows.length === 1 ? "" : "s"} in range.
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Type</th><th>No</th><th>Date</th><th>Ref No</th>
              <th>Party</th><th className="num">Items</th><th>Status</th><th>Created by</th>
              <th style={{ textAlign: "right" }} className="no-print">Open</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                No procurement documents match this filter.
              </td></tr>
            ) : shown.map(r => {
              const k = KIND[r.kind];
              return (
                <tr key={`${r.kind}-${r.id}`}>
                  <td>
                    <span style={{ padding: "2px 10px", borderRadius: 999, background: k.bg, color: k.fg, fontSize: 11, fontWeight: 700 }}>{k.label}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{r.no}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.ref != null ? `#${r.ref}` : "—"}</td>
                  <td>{r.party || "—"}</td>
                  <td className="num">{r.items ?? "—"}</td>
                  <td>
                    <span style={{
                      fontSize: 11.5, fontWeight: 700,
                      color: r.status === "Delivered" ? "#15803D"
                        : r.status === "Inspected" ? "#7C3AED"
                        : r.status === "PO created" ? "#B45309" : "#185FA5",
                    }}>{r.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{r.by || "—"}</td>
                  <td className="no-print" style={{ textAlign: "right" }}>
                    <Link href={`${k.href}/${r.id}`} className="btn btn-sm">View</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="no-print" style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        A demand shows as <strong>PO created</strong> once it has been ordered, and a PO shows as
        <strong> Delivered</strong> once its goods are received against a GRN.
        Numbers run in blocks — demands from 5000, POs from 10000, GRNs from 15000, inspections from 20000.
      </div>
    </div>
  );
}
