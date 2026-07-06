import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { employees, kpiValues, kpiTargets } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { getDesignation, MONTH_LABELS } from "@/lib/kpi/catalog";
import { computeEmployeeYear } from "@/lib/kpi/report";
import { RAG_EMOJI, RAG_COLOR } from "@/lib/kpi/compute";
import TrackerYearNav from "./TrackerYearNav";

export const dynamic = "force-dynamic";

function fmt(n: number | null, unit: string): string {
  if (n === null) return "";
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return unit === "PKR" ? r.toLocaleString() : String(r);
}
function scoreColor(s: number | null): string {
  if (s === null) return "#94a3b8";
  if (s >= 7.5) return "#15803D";
  if (s >= 5) return "#D97706";
  return "#DC2626";
}

export default async function EmployeeTrackerPage({
  params, searchParams,
}: { params: Promise<{ employeeId: string }>; searchParams: Promise<{ year?: string }> }) {
  const { employeeId } = await params;
  const sp = await searchParams;
  const id = parseInt(employeeId);
  const now = new Date();
  const year = parseInt(sp.year || String(now.getFullYear()));

  const [emp] = await db.select().from(employees).where(eq(employees.id, id));
  if (!emp || !emp.kpiTemplate) notFound();
  const tpl = getDesignation(emp.kpiTemplate);
  if (!tpl) notFound();

  const [values, targets] = await Promise.all([
    db.select({ month: kpiValues.month, kpiIdx: kpiValues.kpiIdx, inputKey: kpiValues.inputKey, value: kpiValues.value })
      .from(kpiValues).where(and(eq(kpiValues.employeeId, id), eq(kpiValues.year, year))),
    db.select({ kpiIdx: kpiTargets.kpiIdx, target: kpiTargets.target })
      .from(kpiTargets).where(and(eq(kpiTargets.employeeId, id), eq(kpiTargets.year, year))),
  ]);

  const res = computeEmployeeYear(emp.kpiTemplate, values, targets)!;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 14, flexWrap: "wrap" }}>
        <div>
          <Link href={`/kpi/reports?year=${year}`} style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>← All reports</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 0" }}>{emp.firstName} {emp.lastName}</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {emp.employeeId} · {tpl.code} · {tpl.title} · {tpl.department} · {tpl.kpis.length} KPIs
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <TrackerYearNav year={year} years={years} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>Overall {year}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(res.overall) }}>
              {res.overall === null ? "—" : res.overall.toFixed(1)}<span style={{ fontSize: 12, color: "var(--text3)" }}>/10</span>
            </div>
          </div>
          <Link href={`/kpi/entry?designation=${tpl.code}`} className="btn no-print">✍️ Edit</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="kpi-tracker-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 180 }}>KPI</th>
              <th>Target</th>
              {MONTH_LABELS.map(m => <th key={m}>{m}</th>)}
              <th style={{ background: "#f3eee4" }}>Annual</th>
              <th style={{ background: "#f3eee4" }}>RAG</th>
              <th style={{ background: "#f3eee4" }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {res.kpis.map(k => (
              <tr key={k.idx}>
                <td style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{k.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{k.unit}</div>
                </td>
                <td style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{k.targetRaw}</td>
                {k.monthly.map((mv, i) => (
                  <td key={i} style={{ color: mv === null ? "var(--text3)" : "var(--text)" }}>{fmt(mv, k.unit)}</td>
                ))}
                <td style={{ background: "#fdf8ee", fontWeight: 700 }}>{fmt(k.annual, k.unit)}</td>
                <td style={{ background: "#fdf8ee", color: RAG_COLOR[k.rag], fontSize: 14 }}>{RAG_EMOJI[k.rag]}</td>
                <td style={{ background: "#fdf8ee", fontWeight: 800, color: scoreColor(k.score) }}>{k.score === null ? "—" : k.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .kpi-tracker-table { border-collapse: collapse; width: 100%; font-size: 11.5px; }
        .kpi-tracker-table th, .kpi-tracker-table td { border: 1px solid var(--border); padding: 5px 7px; text-align: center; white-space: nowrap; }
        .kpi-tracker-table thead th { background: var(--bg2); font-weight: 700; font-size: 10.5px; }
        .kpi-tracker-table tbody tr:hover td { background: var(--bg2); }
      `}</style>
    </div>
  );
}
