"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate } from "@/lib/procurement";
import { downloadRegisterXlsx } from "@/lib/xlsx";

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

export default function ProcurementReportClient({ rows, from, to }: { rows: DocRow[]; from: string; to: string }) {
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
    downloadRegisterXlsx({
      filename: `procurement-report_${from}_to_${to}`,
      sheetName: "Procurement",
      title: `Supreme Art — Procurement Report   ${fmtDate(from)} → ${fmtDate(to)}`,
      headers: ["Type", "No", "Date", "Ref No", "Party", "Items", "Status", "Created by"],
      rows: shown.map(r => [
        KIND[r.kind].label, r.no, fmtDate(r.date), r.ref ?? "", r.party, r.items ?? "", r.status, r.by,
      ]),
      freezeCols: 2,
      colWidths: [12, 10, 13, 12, 26, 8, 16, 18],
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
