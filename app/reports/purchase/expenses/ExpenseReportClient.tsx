"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { fmtMoney, fmtDate } from "@/lib/procurement";
import { PR_CATEGORIES } from "@/lib/purchase";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { cmpText } from "@/lib/listTools";

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
  received: boolean;       // Admin's "Mark Received" on the PR register
  receivedDate: string;    // the day it was marked, "" if none
  rejected: boolean;       // HOD "Not Approved" or HR "Rejected"
}

type ViewMode = "lines" | "byCategory";

type ExpSort = "newest" | "oldest" | "valueDesc" | "valueAsc" | "category" | "description";
const EXP_SORT_OPTIONS: SortOption<ExpSort>[] = [
  { value: "newest", label: "Latest date" },
  { value: "oldest", label: "Oldest date" },
  { value: "valueDesc", label: "Value (highest first)" },
  { value: "valueAsc", label: "Value (lowest first)" },
  { value: "category", label: "Category" },
  { value: "description", label: "Description" },
];
const expNewest = (a: ExpenseRow, b: ExpenseRow) => (b.date || "").localeCompare(a.date || "");
const EXP_SORTS: Record<ExpSort, (a: ExpenseRow, b: ExpenseRow) => number> = {
  newest: expNewest,
  oldest: (a, b) => (a.date || "").localeCompare(b.date || ""),
  valueDesc: (a, b) => (b.value ?? 0) - (a.value ?? 0) || expNewest(a, b),
  valueAsc: (a, b) => (a.value ?? 0) - (b.value ?? 0) || expNewest(a, b),
  category: (a, b) => cmpText(a.category, b.category) || expNewest(a, b),
  description: (a, b) => cmpText(a.description, b.description) || expNewest(a, b),
};

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
  const [sort, setSort] = useState<ExpSort>("newest");
  // Received only: the requisitions Admin has marked received, dated (and filtered, sorted) by the day they
  // were marked — the dashboard's Received expense counts them the same way.
  const [receivedOnly, setReceivedOnly] = useState(false);
  // Rejected requisitions are left out of the totals; this lists only them instead.
  const [showRejected, setShowRejected] = useState(false);
  const rejectedCount = useMemo(() => rows.filter(r => r.rejected).length, [rows]);
  const base = useMemo(() => {
    const kept = rows.filter(r => r.rejected === showRejected);
    return receivedOnly ? kept.filter(r => r.received).map(r => ({ ...r, date: r.receivedDate })) : kept;
  }, [rows, receivedOnly, showRejected]);

  // Category dropdown shows the canonical list (matching the Purchase
  // register's own picker) plus anything else that happens to be on record
  // — e.g. a legacy row typed something outside that list.
  const categories = useMemo(() => {
    const set = new Set<string>(PR_CATEGORIES);
    for (const r of rows) if (r.category) set.add(r.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => base.filter(r => {
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
  }).sort(EXP_SORTS[sort]), [base, q, category, fromDate, toDate, sort]);

  const total = useMemo(
    () => filtered.reduce((s, r) => s + (r.value ?? 0), 0),
    [filtered],
  );
  const valuedCount = useMemo(() => filtered.filter(r => r.value != null).length, [filtered]);

  // One row per category, total value + line count, within the current date
  // range and search — but ignoring the category dropdown itself, since
  // picking one category there would otherwise collapse this to one row.
  const byCategory = useMemo(() => {
    const inView = base.filter(r => {
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
    for (const r of inView) {
      const key = r.category || "(Uncategorised)";
      const g = map.get(key) || { count: 0, total: 0 };
      g.count += 1;
      g.total += r.value ?? 0;
      map.set(key, g);
    }
    return [...map.entries()]
      .map(([category, g]) => ({ category, ...g }))
      .sort((a, b) => b.total - a.total);
  }, [base, q, fromDate, toDate]);

  const byCategoryGrand = useMemo(
    () => byCategory.reduce((s, g) => ({ count: s.count + g.count, total: s.total + g.total }), { count: 0, total: 0 }),
    [byCategory],
  );

  function exportXlsx() {
    if (view === "lines") {
      downloadWorkbookXlsx({
        filename: "expense-report",
        sheets: [{
          sheetName: "Expenses", title: `Expense Report — ${showRejected ? "rejected requisitions" : "every line item"}${receivedOnly ? ", received only" : ""}`,
          headers: [receivedOnly ? "Received" : "Date", "Category", "Description", "Quantity", "Value"],
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
          sheetName: "By category", title: `Expense Report — by category${showRejected ? ", rejected requisitions" : ""}${receivedOnly ? ", received only" : ""}`,
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
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div className="tabs">
          <button className={`tab ${view === "lines" ? "active" : ""}`} onClick={() => setView("lines")}>Every expense</button>
          <button className={`tab ${view === "byCategory" ? "active" : ""}`} onClick={() => setView("byCategory")}>By category</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox width={260} value={q} onChange={setQ} placeholder="🔍  Search description, category, department…" />
          {view === "lines" && <SortBy options={EXP_SORT_OPTIONS} value={sort} onChange={setSort} minWidth={170} />}
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={() => setReceivedOnly(v => !v)} aria-pressed={receivedOnly}
          title="Only requisitions marked received, dated by the day they were marked"
          style={{
            padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer", flexShrink: 0,
            border: `1px solid ${receivedOnly ? "#15803D" : "var(--border)"}`,
            background: receivedOnly ? "#15803D" : "var(--bg)", color: receivedOnly ? "#fff" : "var(--text)",
          }}>{receivedOnly ? "✓ " : ""}Received only</button>
        <button type="button" onClick={() => setShowRejected(v => !v)} aria-pressed={showRejected}
          title={showRejected ? "Back to the expenses (rejected requisitions left out)" : "List the requisitions the HOD did not approve or HR rejected — they are not in the totals"}
          style={{
            padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer", flexShrink: 0,
            border: `1px solid ${showRejected ? "#B91C1C" : "var(--border)"}`,
            background: showRejected ? "#B91C1C" : "var(--bg)", color: showRejected ? "#fff" : "var(--text)",
          }}>{showRejected ? "✓ " : ""}Rejected ({rejectedCount})</button>
        <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} title={receivedOnly ? "Received from" : "From date"} style={{ width: 145 }} />
        <span style={{ color: "var(--text3)" }}>–</span>
        <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} title="To date" style={{ width: 145 }} />
        {view === "lines" && valuedCount < filtered.length && (
          <span style={{ fontSize: 12, color: "var(--text2)" }}>{filtered.length - valuedCount} not yet valued</span>
        )}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          <button className="btn btn-sm" onClick={exportXlsx}>⬇ Export Excel</button>
          <Link href="/purchase" className="btn btn-back btn-sm">← PR Register</Link>
        </div>
      </div>

      <div className="rpt-table-wrap">
        {view === "lines" ? (
          <table className="rpt-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>{receivedOnly ? "Received" : "Date"}</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ width: 130 }}>Quantity</th>
                <th className="num" style={{ width: 130 }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="empty">{showRejected ? "No rejected requisitions here." : "No matching expenses."}</td></tr>
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
                  <td colSpan={4}>{showRejected ? "Rejected — not in the expense" : "Total"} — {filtered.length} line{filtered.length === 1 ? "" : "s"}</td>
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
