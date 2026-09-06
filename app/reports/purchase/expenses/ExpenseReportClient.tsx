"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { fmtMoney, fmtDate } from "@/lib/procurement";
import { PR_CATEGORIES } from "@/lib/purchase";

export interface ExpenseRow {
  prId: number;
  prNo: number | null;
  date: string;            // ISO yyyy-mm-dd, "" if never set
  department: string;
  category: string;
  description: string;
  quantity: number | null;
  uom: string;
  value: number | null;
}

type ViewMode = "lines" | "byCategory";

function moneyOrDash(n: number | null): string {
  return n == null ? "—" : fmtMoney(n, false);
}
function qtyLabel(qty: number | null, uom: string): string {
  if (qty == null) return "—";
  const n = Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
  return uom ? `${n} ${uom}` : n;
}

export default function ExpenseReportClient({ rows }: { rows: ExpenseRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [view, setView] = useState<ViewMode>("lines");

  // Category dropdown shows the canonical list (matching the Purchase
  // register's own picker) plus anything else that happens to be on record
  // — e.g. a legacy row typed something outside that list.
  const categories = useMemo(() => {
    const set = new Set<string>(PR_CATEGORIES);
    for (const r of rows) if (r.category) set.add(r.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (category && r.category !== category) return false;
    if (fromDate || toDate) {
      const d = r.date ? r.date.slice(0, 10) : "";
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
    }
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return `${r.description} ${r.category} ${r.department}`.toLowerCase().includes(s);
  }).sort((a, b) => (b.date || "").localeCompare(a.date || "")), [rows, q, category, fromDate, toDate]);

  const total = useMemo(
    () => filtered.reduce((s, r) => s + (r.value ?? 0), 0),
    [filtered],
  );
  const valuedCount = useMemo(() => filtered.filter(r => r.value != null).length, [filtered]);

  // One row per category, total value + line count, within the current date
  // range and search — but ignoring the category dropdown itself, since
  // picking one category there would otherwise collapse this to one row.
  const byCategory = useMemo(() => {
    const base = rows.filter(r => {
      if (fromDate || toDate) {
        const d = r.date ? r.date.slice(0, 10) : "";
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
      }
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return `${r.description} ${r.category} ${r.department}`.toLowerCase().includes(s);
    });
    const map = new Map<string, { count: number; total: number }>();
    for (const r of base) {
      const key = r.category || "(Uncategorised)";
      const g = map.get(key) || { count: 0, total: 0 };
      g.count += 1;
      g.total += r.value ?? 0;
      map.set(key, g);
    }
    return [...map.entries()]
      .map(([category, g]) => ({ category, ...g }))
      .sort((a, b) => b.total - a.total);
  }, [rows, q, fromDate, toDate]);

  const byCategoryGrand = useMemo(
    () => byCategory.reduce((s, g) => ({ count: s.count + g.count, total: s.total + g.total }), { count: 0, total: 0 }),
    [byCategory],
  );

  function exportXlsx() {
    if (view === "lines") {
      downloadWorkbookXlsx({
        filename: "expense-report",
        sheets: [{
          sheetName: "Expenses", title: "Expense Report — every line item",
          headers: ["Date", "Category", "Description", "Quantity", "Value"],
          rows: [
            ...filtered.map(r => [
              r.date ? fmtDate(r.date) : "—", r.category || "—", r.description || "—",
              qtyLabel(r.quantity, r.uom), moneyOrDash(r.value),
            ]),
            ["", "", "", "Total", fmtMoney(total, false)],
          ],
        }],
      });
    } else {
      downloadWorkbookXlsx({
        filename: "expense-report-by-category",
        sheets: [{
          sheetName: "By category", title: "Expense Report — by category",
          headers: ["Category", "Line Items", "Total Value"],
          rows: [
            ...byCategory.map(g => [g.category, g.count, fmtMoney(g.total, false)]),
            ["Total", byCategoryGrand.count, fmtMoney(byCategoryGrand.total, false)],
          ],
        }],
      });
    }
  }

  const openPr = (prId: number) => router.push(`/purchase?open=${prId}`);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Expense Report</h1>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
            Every expense line raised through Purchase Requisitions, with its category and value. Read-only — click a row to open its requisition.
          </p>
        </div>
        <Link href="/purchase" className="btn btn-sm">← PR Register</Link>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div className="tabs">
          <button className={`tab ${view === "lines" ? "active" : ""}`} onClick={() => setView("lines")}>Every expense</button>
          <button className={`tab ${view === "byCategory" ? "active" : ""}`} onClick={() => setView("byCategory")}>By category</button>
        </div>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search description, category, department…"
          style={{ maxWidth: 260 }}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} title="From date" style={{ width: 145 }} />
        <span style={{ color: "var(--text3)" }}>–</span>
        <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} title="To date" style={{ width: 145 }} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={exportXlsx}>⬇ Export Excel</button>
      </div>

      {view === "lines" && valuedCount < filtered.length && (
        <div style={{ marginBottom: 10, fontSize: 12.5, color: "var(--text2)" }}>
          {filtered.length - valuedCount} line{filtered.length - valuedCount === 1 ? "" : "s"} not yet valued
        </div>
      )}

      <div className="rpt-table-wrap">
        {view === "lines" ? (
          <table className="rpt-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ width: 130 }}>Quantity</th>
                <th className="num" style={{ width: 130 }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="empty">No matching expenses.</td></tr>
              )}
              {filtered.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => openPr(r.prId)}
                  className="rpt-row-clickable"
                  title="Tap to open this requisition"
                >
                  <td>{r.date ? fmtDate(r.date) : "—"}</td>
                  <td>{r.category || "—"}</td>
                  <td>{r.description || "—"}</td>
                  <td>{qtyLabel(r.quantity, r.uom)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{moneyOrDash(r.value)}</td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="rpt-total-row">
                  <td colSpan={4}>Total — {filtered.length} line{filtered.length === 1 ? "" : "s"}</td>
                  <td className="num">{fmtMoney(total, false)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr><th>Category</th><th className="num" style={{ width: 110 }}>Line Items</th><th className="num" style={{ width: 150 }}>Total Value</th></tr>
            </thead>
            <tbody>
              {byCategory.length === 0 && (
                <tr><td colSpan={3} className="empty">No matching expenses.</td></tr>
              )}
              {byCategory.map((g, i) => (
                <tr key={i}>
                  <td>{g.category}</td>
                  <td className="num">{g.count}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(g.total, false)}</td>
                </tr>
              ))}
            </tbody>
            {byCategory.length > 0 && (
              <tfoot>
                <tr className="rpt-total-row">
                  <td>Total</td>
                  <td className="num">{byCategoryGrand.count}</td>
                  <td className="num">{fmtMoney(byCategoryGrand.total, false)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
