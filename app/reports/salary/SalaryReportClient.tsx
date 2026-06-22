"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { MONTHS } from "@/lib/salary";
import PrintLandscape, { printLandscape } from "@/components/PrintLandscape";

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

const fmt = (n: number) => Number(n || 0).toLocaleString("en-PK");
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SalaryReportClient({ records, employees }: { records: Slip[]; employees: Emp[] }) {
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");

  const years = useMemo(() => Array.from(new Set(records.map(r => r.year))).sort((a, b) => b - a), [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (month && r.month !== month) return false;
    if (year && String(r.year) !== year) return false;
    if (employeeId && String(r.employeeId) !== employeeId) return false;
    return true;
  }), [records, month, year, employeeId]);

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
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Salary Records</h1>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>All generated salary slips. Click any row to view and print.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/salary" className="btn btn-primary">＋ Generate Slips</Link>
          <button className="btn" onClick={exportCSV} disabled={filtered.length === 0}>⬇ Excel (CSV)</button>
          <button className="btn btn-print" onClick={printLandscape} disabled={filtered.length === 0}>🖨 Print</button>
        </div>
      </div>

      <div className="card no-print" style={{ padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 140px 1fr", gap: 12, alignItems: "end" }}>
          <div>
            <label className="form-label">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}>
              <option value="">All</option>
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Year</label>
            <select value={year} onChange={e => setYear(e.target.value)}>
              <option value="">All</option>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Employee</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">All</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text2)", display: "flex", justifyContent: "space-between" }}>
          <span>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
          <span>Total net: <strong style={{ color: "var(--brand)" }}>PKR {fmt(totals.net)}</strong> · Gross: PKR {fmt(totals.gross)} · Deductions: PKR {fmt(totals.deductions)}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
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
