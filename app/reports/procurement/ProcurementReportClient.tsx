"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate, type InspectionResult } from "@/lib/procurement";
import QcBadge, { qcText } from "@/components/procurement/QcBadge";
import { downloadWorkbookXlsx } from "@/lib/xlsx";

import PrintLandscape from "@/components/PrintLandscape";

// A GRR that received a PO line — id (to open it), display number, gate pass.
export interface GrrRef { id: number; label: string; gatePass: string; invNo: string; dcNo: string; qc: InspectionResult }

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
  const [supplierFilter, setSupplierFilter] = useState("");
  const [q, setQ] = useState("");

  const counts = useMemo(() => ({
    all: rows.length,
    received: rows.filter(r => r.status === "received").length,
    partial: rows.filter(r => r.status === "partial").length,
    none: rows.filter(r => r.status === "none").length,
  }), [rows]);

  const suppliers = useMemo(
    () => [...new Set(rows.map(r => r.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const shown = useMemo(() => rows.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (supplierFilter && r.supplier !== supplierFilter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const grrHay = r.grns.map(g => `${g.label} ${g.gatePass} ${g.invNo} ${g.dcNo} ${qcText(g.qc)}`).join(" ");
    return `${r.description} ${r.supplier} ${r.demandNo} ${r.poNo} ${grrHay}`.toLowerCase().includes(s);
  }), [rows, filter, supplierFilter, q]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const meta = { code: "PUR/QR/008", issue: "01", date: from === to ? fmtDate(from) : fmtDate(from) + " to " + fmtDate(to) };
  const company = { name: "SUPREME ART PRIVATE LIMITED" };
  async function exportXlsx() {
    setExporting(true); setExportError("");
    try {
    await downloadWorkbookXlsx({
      filename: `procurement-master_${from}_to_${to}`,
      sheets: [{
        sheetName: "Master Report",
        title: "PROCUREMENT MASTER REPORT",
        letterhead: { ...meta, company, logoUrl: "/logo-urdu.png" },
        headers: ["Description", "Supplier", "Date", "Demand No", "PO No", "GRR No", "Gate Pass No", "Invoice No", "DC No", "QC", "Received"],
        rows: shown.map(r => [
          r.description, r.supplier, fmtDate(r.date), r.demandNo, r.poNo,
          r.grns.map(g => g.label).join(", "),
          r.grns.map(g => g.gatePass).filter(Boolean).join(", "),
          r.grns.map(g => g.invNo).filter(Boolean).join(", "),
          r.grns.map(g => g.dcNo).filter(Boolean).join(", "),
          r.grns.map(g => qcText(g.qc)).join(", "),
          STATUS_META[r.status].label,
        ]),
        colWidths: [34, 26, 12, 11, 10, 14, 16, 16, 18],
        freezeCols: 1,
      }],
    });
    } catch (error) { setExportError(error instanceof Error ? error.message : "Export failed. Please try again."); }
    finally { setExporting(false); }
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "received", label: "Received" },
    { key: "partial", label: "Partially received" },
    { key: "none", label: "Not received" },
  ];

  return (
    <div className="fade-up procurement-master">
      <PrintLandscape />
      <div className="master-letterhead">
        <div className="master-company">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="master-logo"><img src="/logo-urdu.png" alt="Supreme Art" width={135} height={66} /><div>{company.name}</div></div>
          <div className="master-heading"><h2>PROCUREMENT MASTER REPORT</h2><div className="master-control"><span>{meta.code}</span><span>Date: {meta.date}</span><span>Issue Status: {meta.issue}</span></div></div>
        </div>
      </div>
      {/* Row 1: search and supplier. Row 2: the received-status pills, the date range
          (a GET form, laid out inline), and Excel / Print at the right end. */}
      <div className="no-print toolbar-row">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 Item, supplier, PO / GRR…" title="Description, supplier, demand / PO / GRR / gate pass / invoice / DC / QC"
          style={{ borderRadius: 8, border: "1px solid var(--border)", width: 240 }} />
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
          style={{ borderRadius: 8, border: "1px solid var(--border)", maxWidth: 220 }}>
          <option value="">All suppliers ({suppliers.length})</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="no-print toolbar-row">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "3px 10px", fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: "pointer",
            border: `1px solid ${filter === f.key ? "var(--brand)" : "var(--border)"}`,
            background: filter === f.key ? "var(--brand)" : "var(--bg)",
            color: filter === f.key ? "#fff" : "var(--text)",
          }}>{f.label} ({counts[f.key]})</button>
        ))}
        <form method="GET" style={{ display: "contents" }}>
          <label className="head-filter">From <input type="date" name="from" defaultValue={from} style={{ width: 138 }} /></label>
          <label className="head-filter">To <input type="date" name="to" defaultValue={to} style={{ width: 138 }} /></label>
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
        </form>
        <div style={{ flex: 1 }} />
        <button onClick={exportXlsx} className="btn btn-sm" disabled={shown.length === 0 || exporting}>{exporting ? "Exporting…" : "⬇ Excel"}</button>
        <button onClick={() => window.print()} className="btn btn-sm btn-print">🖨 Print</button>
      </div>

      {exportError && <p className="no-print" role="alert">{exportError}</p>}
      <div className="card master-table" style={{ WebkitOverflowScrolling: "touch" }}>
        <table>
          <thead>
            <tr>
              <th>Description</th><th>Supplier</th><th>Date</th>
              <th>Demand #</th><th>PO #</th><th>GRR #</th><th>Gate Pass No</th><th>Invoice No</th><th>DC No</th><th>QC</th><th>Received</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                {q.trim() || filter !== "all" ? "No items match this filter." : "No purchase orders in this range."}
              </td></tr>
            ) : shown.map((r, i) => {
              const st = STATUS_META[r.status];
              const gatePasses = r.grns.map(g => g.gatePass).filter(Boolean);
              const invNos = r.grns.map(g => g.invNo).filter(Boolean);
              const dcNos = r.grns.map(g => g.dcNo).filter(Boolean);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600, maxWidth: 320 }}>{r.description || "—"}</td>
                  <td>{r.supplier || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                  <td>
                    {r.demandNo
                      ? (r.demandId != null
                        ? <Link href={`/procurement/demand/${r.demandId}?ref=report`} className="doc-link">#{r.demandNo}</Link>
                        : `#${r.demandNo}`)
                      : "—"}
                  </td>
                  <td><Link href={`/procurement/po/${r.poId}?ref=report`} className="doc-link" style={{ fontWeight: 700 }}>#{r.poNo}</Link></td>
                  <td>
                    {r.grns.length === 0 ? "—" : r.grns.map((g, j) => (
                      <span key={g.id}>
                        {j > 0 && ", "}
                        <Link href={`/procurement/grn/${g.id}?ref=report`} className="doc-link">#{g.label}</Link>
                      </span>
                    ))}
                  </td>
                  <td style={{ color: gatePasses.length ? "var(--text)" : "var(--text3)" }}>{gatePasses.length ? gatePasses.join(", ") : "—"}</td>
                  <td style={{ color: invNos.length ? "var(--text)" : "var(--text3)" }}>{invNos.length ? invNos.join(", ") : "—"}</td>
                  <td style={{ color: dcNos.length ? "var(--text)" : "var(--text3)" }}>{dcNos.length ? dcNos.join(", ") : "—"}</td>
                  <td>
                    {/* One badge per GRR that received this line. */}
                    {r.grns.length === 0 ? <span style={{ color: "var(--text3)" }}>—</span>
                      : <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>{r.grns.map(g => <QcBadge key={g.id} result={g.qc} />)}</span>}
                  </td>
                  <td>
                    <span style={{ padding: "2px 10px", borderRadius: 999, background: st.bg, color: st.fg, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .master-letterhead { display: none; }
        .master-table { padding: 0; overflow: auto; width: fit-content; max-width: 100%; }
        .master-table table { width: auto; }
        .master-table th, .master-table td { padding: 7px 10px; }
        .master-table thead th { background: #f3eee4; color: #111; }
        @media print {
          .master-letterhead { display: block; font-family: "Times New Roman", serif; color: #000; break-inside: avoid; }
          .master-control { display: grid; grid-template-columns: 1fr 2fr 1fr; }
          .master-control span { padding: 2px; font-size: 10.5pt; line-height: 1.1; }
          .master-control span:last-child { border-right: 0; }
          .master-company { background: #f3eee4 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; display: flex; align-items: center; gap: 24px; border: 1px solid #000; padding: 5px 10px; font-size: 11pt; line-height: 1.5; }
          .master-company img { object-fit: contain; flex-shrink: 0; }
          .master-logo img { display: block; margin: 0 auto 4px; }
          .master-logo { width: 210px; flex-shrink: 0; text-align: center; color: #a32d2d; font-family: Arial, sans-serif; font-size: 9pt; font-weight: 700; }
          .master-heading { flex: 1; text-align: center; }
          .master-letterhead h2 { color: #a32d2d; text-align: center; font-size: 17pt; margin: 6px 0 7px; }
          .master-letterhead p { font-size: 9pt; margin-bottom: 12px; }
          .master-table { overflow: visible !important; width: 100% !important; max-width: none !important; border-radius: 0; border: none !important; box-shadow: none !important; }
          .master-table table { table-layout: fixed; width: 100% !important; }
          .master-table thead { display: table-header-group; }
          .master-table tr { break-inside: avoid; }
          .master-table th, .master-table td { white-space: normal !important; }
          .master-table th { border: 1px solid #777; background: #f3eee4 !important; color: #111 !important; font-size: 10pt !important; line-height: 1.1; padding: 2px 4px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .master-table tbody tr, .master-table tbody tr:hover {
            position: static !important; z-index: auto !important;
            border: none !important; outline: none !important; box-shadow: none !important;
          }
          .master-table tbody td {
            border: none !important; outline: none !important; box-shadow: none !important;
          }
          .master-table th { letter-spacing: 0; }
          .master-table th:first-child { width: 17%; }
          .master-table th:nth-child(4) { width: 8%; }
          .master-table th:nth-child(2) { width: 14%; }
          .master-table th:nth-child(3) { width: 8%; }
          .master-table th:nth-child(11) { width: 11%; }
          .master-table td span { white-space: normal !important; }
        }
        .doc-link { color: var(--brand); font-weight: 700; text-decoration: none; }
        .doc-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
