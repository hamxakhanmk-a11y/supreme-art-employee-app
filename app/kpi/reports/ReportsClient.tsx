"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export type EmpSummary = {
  id: number;
  name: string;
  employeeId: string;
  templateCode: string;
  templateTitle: string;
  department: string;
  kpiCount: number;
  overall: number | null;
  ragCounts: { green: number; amber: number; red: number; na: number };
  hasData: boolean;
};
type Designation = { code: string; title: string; employees: EmpSummary[]; avg: number | null };
type Department = { department: string; designations: Designation[]; avg: number | null; count: number };

function scoreColor(s: number | null): string {
  if (s === null) return "#94a3b8";
  if (s >= 7.5) return "#15803D";
  if (s >= 5) return "#D97706";
  return "#DC2626";
}
function ScorePill({ s, big }: { s: number | null; big?: boolean }) {
  const c = scoreColor(s);
  return (
    <span style={{
      display: "inline-block", minWidth: big ? 54 : 44, textAlign: "center",
      padding: big ? "4px 10px" : "2px 8px", borderRadius: 999,
      fontSize: big ? 14 : 12, fontWeight: 800,
      color: c, background: `${c}1f`,
    }}>
      {s === null ? "—" : s.toFixed(1)}
    </span>
  );
}
function RagBar({ r }: { r: EmpSummary["ragCounts"] }) {
  const cells: [number, string][] = [[r.green, "#15803D"], [r.amber, "#D97706"], [r.red, "#DC2626"], [r.na, "#e2e8f0"]];
  const total = r.green + r.amber + r.red + r.na || 1;
  return (
    <span style={{ display: "inline-flex", height: 8, width: 90, borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
      {cells.map(([n, c], i) => n > 0 && <span key={i} style={{ width: `${(n / total) * 100}%`, background: c }} />)}
    </span>
  );
}

export default function ReportsClient({
  year, years, departments, companyAvg, empty,
}: {
  year: number; years: number[]; departments: Department[];
  companyAvg: number | null; empty: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const setYear = (y: number) => router.push(`${pathname}?year=${y}`);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>KPI Reports &mdash; {year}</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Annual KPI score (0&ndash;10) per employee, rolled up by designation and department.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>Company avg</div>
            <ScorePill s={companyAvg} big />
          </div>
        </div>
      </div>

      {empty || departments.length === 0 ? (
        <div className="card" style={{ borderLeft: "4px solid var(--brand)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Nothing to report for {year} yet</div>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 12px" }}>
            Assign KPI templates to employees and enter their monthly figures — scores will appear here.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/kpi/assign" className="btn">🔗 Assign Templates</Link>
            <Link href="/kpi/entry" className="btn btn-primary">✍️ Monthly Entry</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {departments.map(dep => (
            <div key={dep.department} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)", color: "#fff",
                padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{dep.department}</span>
                <span style={{ display: "inline-flex", gap: 10, alignItems: "center", fontSize: 11, fontWeight: 700 }}>
                  {dep.count} employee{dep.count === 1 ? "" : "s"}
                  <span style={{ opacity: 0.85 }}>Dept avg</span> <ScorePill s={dep.avg} />
                </span>
              </div>
              <table className="kpi-report-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th style={{ width: 110 }}>RAG mix</th>
                    <th style={{ width: 90, textAlign: "center" }}>Score /10</th>
                    <th style={{ width: 70 }} className="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {dep.designations.map(des => (
                    <DesignationRows key={des.code} des={des} year={year} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--text3)", display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span>Score bands: <strong style={{ color: "#15803D" }}>≥7.5 good</strong> · <strong style={{ color: "#D97706" }}>5–7.5 watch</strong> · <strong style={{ color: "#DC2626" }}>&lt;5 low</strong></span>
            <span>RAG mix = 🟢 on-target / 🟡 within 10% / 🔴 off across the role&apos;s KPIs.</span>
          </div>
        </div>
      )}

      <style jsx global>{`
        .kpi-report-table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
        .kpi-report-table th, .kpi-report-table td { border-bottom: 1px solid var(--border); padding: 8px 12px; text-align: left; }
        .kpi-report-table thead th { background: var(--bg2); font-weight: 700; font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.3px; }
        .kpi-desig-row td { background: #faf6ef; font-weight: 700; font-size: 11.5px; }
        .kpi-report-table tbody tr:hover td { background: var(--bg2); }
      `}</style>
    </div>
  );
}

function DesignationRows({ des, year }: { des: Designation; year: number }) {
  return (
    <>
      <tr className="kpi-desig-row">
        <td colSpan={3}>{des.code} · {des.title} <span style={{ color: "var(--text3)", fontWeight: 500 }}>({des.employees.length})</span></td>
        <td style={{ textAlign: "center" }}><ScorePill s={des.avg} /></td>
        <td className="no-print"></td>
      </tr>
      {des.employees.map(emp => (
        <tr key={emp.id}>
          <td>
            <div style={{ fontWeight: 600 }}>{emp.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{emp.employeeId}{!emp.hasData && " · no data"}</div>
          </td>
          <td style={{ fontSize: 11.5, color: "var(--text2)" }}>{emp.templateCode}</td>
          <td><RagBar r={emp.ragCounts} /></td>
          <td style={{ textAlign: "center" }}><ScorePill s={emp.overall} /></td>
          <td className="no-print">
            <Link href={`/kpi/reports/${emp.id}?year=${year}`} style={{ color: "var(--brand)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>View →</Link>
          </td>
        </tr>
      ))}
    </>
  );
}
