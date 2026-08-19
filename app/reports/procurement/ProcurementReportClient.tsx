"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate } from "@/lib/procurement";
import { downloadWorkbookXlsx } from "@/lib/xlsx";

// A GRR that received a PO line — id (to open it), display number, gate pass.
export interface GrrRef { id: number; label: string; gatePass: string }

// One traced line: a PO item, with its demand, PO, GRR(s) and received status.
export interface MasterRow {
  description: string;
  supplier: string;
  demandNo: string;         // "" when the PO was standalone
  demandId: number | null;  // to open the demand (null when typed by hand)
  poNo: string;             // with "u" suffix for unregistered
  poId: number;             // to open the PO
  grns: GrrRef[];           // the GRR(s) that received this line
  status: "received" | "partial" | "none";
  date: string;             // PO date (for sorting / range)
}

const STATUS_META = {
  received: { label: "Received", fg: "#15803D", bg: "#dcf5dc" },
  partial: { label: "Partially received", fg: "#B45309", bg: "#fef3c7" },
  none: { label: "Not received", fg: "#B91C1C", bg: "#fde8e8" },
} as const;

type Filter = "all" | "received" | "partial" | "none";

export default function ProcurementReportClient({ rows, from, to }: { rows: MasterRow[]; from: string; to: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => ({
    all: rows.length,
    received: rows.filter(r => r.status === "received").length,
    partial: rows.filter(r => r.status === "partial").length,
    none: rows.filter(r => r.status === "none").length,
  }), [rows]);

  const shown = useMemo(() => rows.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const grrHay = r.grns.map(g => `${g.label} ${g.gatePass}`).join(" ");
    return `${r.description} ${r.supplier} ${r.demandNo} ${r.poNo} ${grrHay}`.toLowerCase().includes(s);
  }), [rows, filter, q]);

  function exportXlsx() {
    downloadWorkbookXlsx({
      filename: `procurement-master_${from}_to_${to}`,
      sheets: [{
        sheetName: "Master Report",
        title: `Supreme Art — Procurement Master Report   ${fmtDate(from)} → ${fmtDate(to)}`,
        headers: ["Description", "Supplier", "Demand No", "PO No", "GRR No", "Gate Pass No", "Received"],
        rows: shown.map(r => [
          r.description, r.supplier, r.demandNo, r.poNo,
          r.grns.map(g => g.label).join(", "),
          r.grns.map(g => g.gatePass).filter(Boolean).join(", "),
          STATUS_META[r.status].label,
        ]),
        colWidths: [34, 26, 11, 10, 14, 16, 18],
        freezeCols: 1,
      }],
    });
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "received", label: "Received" },
    { key: "partial", label: "Partially received" },
    { key: "none", label: "Not received" },
  ];

  return (
    <div className="fade-up">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Procurement Master Report</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
          Every ordered item traced Demand → PO → GRR, with its delivery status. Click any number to open the document.
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

      {/* Status filter + search */}
      <div className="no-print" style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer",
            border: `1px solid ${filter === f.key ? "var(--brand)" : "var(--border)"}`,
            background: filter === f.key ? "var(--brand)" : "var(--bg)",
            color: filter === f.key ? "#fff" : "var(--text)",
          }}>{f.label} ({counts[f.key]})</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 Description, supplier, demand / PO / GRR / gate pass…"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, width: 280, marginLeft: 6 }} />
        <div style={{ flex: 1 }} />
        <button onClick={exportXlsx} className="btn btn-sm" disabled={shown.length === 0}>⬇ Export Excel</button>
        <button onClick={() => window.print()} className="btn btn-sm">🖨 Print</button>
      </div>

      <div className="no-print" style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
        Showing <strong>{shown.length}</strong> of {rows.length} item{rows.length === 1 ? "" : "s"} in range.
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Description</th><th>Supplier</th>
              <th>Demand #</th><th>PO #</th><th>GRR #</th><th>Gate Pass No</th><th>Received</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                {q.trim() || filter !== "all" ? "No items match this filter." : "No purchase orders in this range."}
              </td></tr>
            ) : shown.map((r, i) => {
              const st = STATUS_META[r.status];
              const gatePasses = r.grns.map(g => g.gatePass).filter(Boolean);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600, maxWidth: 320 }}>{r.description || "—"}</td>
                  <td>{r.supplier || "—"}</td>
                  <td>
                    {r.demandNo
                      ? (r.demandId != null
                        ? <Link href={`/procurement/demand/${r.demandId}`} className="doc-link">#{r.demandNo}</Link>
                        : `#${r.demandNo}`)
                      : "—"}
                  </td>
                  <td><Link href={`/procurement/po/${r.poId}`} className="doc-link" style={{ fontWeight: 700 }}>#{r.poNo}</Link></td>
                  <td>
                    {r.grns.length === 0 ? "—" : r.grns.map((g, j) => (
                      <span key={g.id}>
                        {j > 0 && ", "}
                        <Link href={`/procurement/grn/${g.id}`} className="doc-link">#{g.label}</Link>
                      </span>
                    ))}
                  </td>
                  <td style={{ color: gatePasses.length ? "var(--text)" : "var(--text3)" }}>{gatePasses.length ? gatePasses.join(", ") : "—"}</td>
                  <td>
                    <span style={{ padding: "2px 10px", borderRadius: 999, background: st.bg, color: st.fg, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="no-print" style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        One line per ordered item. <strong>Received</strong> once its full quantity is booked on a GRR,
        <strong> Partially received</strong> when some has arrived, <strong>Not received</strong> when none has.
        Items only demanded (no PO yet) don&apos;t appear here — they have no supplier or PO.
      </div>

      <style jsx>{`
        .doc-link { color: var(--brand); font-weight: 700; text-decoration: none; }
        .doc-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
