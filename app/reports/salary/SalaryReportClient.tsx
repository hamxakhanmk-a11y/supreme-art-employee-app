"use client";
import { useMemo } from "react";
import { usePageState } from "@/lib/usePageState";
import Link from "next/link";
import { MONTHS } from "@/lib/salary";
import PrintLandscape, { printLandscape } from "@/components/PrintLandscape";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { cmpText, matchesQuery } from "@/lib/listTools";

type Slip = {
  id: number;
  employeeId: number;
  employeeCode: string | null;
  employeeName: string | null;
  designation: string | null;
  department: string | null;
  month: string;
  monthNum: number | null;
  year: number;
  basicSalary: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  createdAt: string;
};

type Emp = { id: number; employeeId: string; firstName: string; lastName: string; department: string | null };

type SalSort = "latest" | "oldest" | "name" | "dept" | "net" | "gross";
const SAL_SORT_OPTIONS: SortOption<SalSort>[] = [
  { value: "latest", label: "Latest period" },
  { value: "oldest", label: "Oldest period" },
  { value: "name", label: "Employee name" },
  { value: "dept", label: "Department" },
  { value: "net", label: "Net pay (highest first)" },
  { value: "gross", label: "Gross (highest first)" },
];
const byPeriod = (a: Slip, b: Slip) => (a.year - b.year) || ((a.monthNum ?? 0) - (b.monthNum ?? 0));
const SAL_SORTS: Record<SalSort, ((a: Slip, b: Slip) => number) | null> = {
  latest: null,
  oldest: (a, b) => byPeriod(a, b) || cmpText(a.employeeName, b.employeeName),
  name: (a, b) => cmpText(a.employeeName, b.employeeName) || byPeriod(b, a),
  dept: (a, b) => cmpText(a.department, b.department) || cmpText(a.employeeName, b.employeeName) || byPeriod(b, a),
  net: (a, b) => (b.netPay || 0) - (a.netPay || 0) || byPeriod(b, a),
  gross: (a, b) => (b.grossEarnings || 0) - (a.grossEarnings || 0) || byPeriod(b, a),
};

const fmt = (n: number) => Number(n || 0).toLocaleString("en-PK");

function SalStat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 10px", borderRadius: 8, background: "#fafaf6", border: "1px solid var(--border)" }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: strong ? "var(--brand)" : "var(--text)" }}>{value}</span>
      <span style={{ fontSize: 10.5, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SalaryReportClient({ records, employees }: { records: Slip[]; employees: Emp[] }) {
  const [month, setMonth] = usePageState<string>("month", "");
  const [year, setYear] = usePageState<string>("year", "");
  const [q, setQ] = usePageState<string>("q", "");
  const [sort, setSort] = usePageState<SalSort>("sort", "latest");

  const years = useMemo(() => Array.from(new Set(records.map(r => r.year))).sort((a, b) => b - a), [records]);

  // "latest" keeps the order the server sent (year, month, then name), so the default view is unchanged.
  const filtered = useMemo(() => {
    const out = records.filter(r => {
      if (month && r.month !== month) return false;
      if (year && String(r.year) !== year) return false;
      if (!matchesQuery(q, [r.employeeName, r.employeeCode, r.department, r.designation])) return false;
      return true;
    });
    const cmp = SAL_SORTS[sort];
    return cmp ? out.sort(cmp) : out;
  }, [records, month, year, q, sort]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    gross: acc.gross + Number(r.grossEarnings || 0),
    deductions: acc.deductions + Number(r.totalDeductions || 0),
    net: acc.net + Number(r.netPay || 0),
  }), { gross: 0, deductions: 0, net: 0 }), [filtered]);

  const exportCSV = () => {
    const headers = ["Month", "Year", "Employee ID", "Employee", "Designation", "Department", "Basic", "Gross", "Deductions", "Net Pay", "Generated"];
    const rows = filtered.map(r => [
      r.month, r.year, r.employeeCode || "", r.employeeName || "",
      r.designation || "", r.department || "",
      r.basicSalary, r.grossEarnings, r.totalDeductions, r.netPay,
      fmtDate(r.createdAt),
    ]);
    const csv = [headers, ...rows].map(line => line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `salary-records-${month || "all"}-${year || "all"}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="fade-up">
      <PrintLandscape />
      {/* One row: the totals (also printed), search and sort, the month/year filters, then the actions at the right. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
          <SalStat label="Records" value={String(filtered.length)} />
          <SalStat label="Net PKR" value={fmt(totals.net)} strong />
          <SalStat label="Gross PKR" value={fmt(totals.gross)} />
          <SalStat label="Deductions PKR" value={fmt(totals.deductions)} />
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox width={250} value={q} onChange={setQ} placeholder="🔍  Search employee, ID, department…" />
          <SortBy options={SAL_SORT_OPTIONS} value={sort} onChange={setSort} minWidth={170} />
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: 140 }} title="Month">
            <option value="">All months</option>
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(e.target.value)} style={{ width: 120 }} title="Year">
            <option value="">All years</option>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          <button className="btn btn-print" onClick={printLandscape} disabled={filtered.length === 0}>🖨 Print</button>
          <button className="btn" onClick={exportCSV} disabled={filtered.length === 0}>⬇ Excel (CSV)</button>
          <Link href="/salary" className="btn btn-primary">＋ Generate Slips</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Employee</th>
                <th>Designation</th>
                <th>Department</th>
                <th style={{ textAlign: "right" }}>Basic</th>
                <th style={{ textAlign: "right" }}>Gross</th>
                <th style={{ textAlign: "right" }}>Deductions</th>
                <th style={{ textAlign: "right", color: "var(--brand)" }}>Net Pay</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10}><div className="empty" style={{ padding: "1.5rem" }}>No salary records found.</div></td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.month} {r.year}</td>
                  <td><div style={{ fontWeight: 600 }}>{r.employeeName}</div><div style={{ fontSize: 11, color: "var(--text2)" }}>{r.employeeCode}</div></td>
                  <td>{r.designation || "—"}</td>
                  <td>{r.department || "—"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.basicSalary)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.grossEarnings)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.totalDeductions)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.netPay)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</td>
                  <td><Link href={`/salary/${r.id}`} className="btn btn-sm">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
