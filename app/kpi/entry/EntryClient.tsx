"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDesignation, MONTH_LABELS, type KpiDef } from "@/lib/kpi/catalog";
import {
  monthlyValue, annual, ragFor, scoreFor, effectiveTarget,
  RAG_EMOJI, RAG_COLOR, type Operands,
} from "@/lib/kpi/compute";

type Emp = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string | null;
  designation: string | null;
  kpiTemplate: string | null;
};

// value state key: `${month}:${kpiIdx}:${inputKey}`
const vk = (m: number, k: number, key: string) => `${m}:${k}:${key}`;

function fmt(n: number | null, unit: string): string {
  if (n === null) return "—";
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return unit === "PKR" ? r.toLocaleString() : String(r);
}

// An employee's KPI department = the department of their assigned template.
const deptOf = (e: Emp) => (e.kpiTemplate ? getDesignation(e.kpiTemplate)?.department : null) ?? "Unassigned";

export default function EntryClient({ employees }: { employees: Emp[] }) {
  const now = new Date();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("designation");
  // Arriving via ?designation=CODE from the overview preselects that role's
  // department and its first employee.
  const initialEmp = (initialCode && employees.find(e => e.kpiTemplate === initialCode)) || employees[0];

  const [dept, setDept] = useState<string>(deptOf(initialEmp));
  const [empId, setEmpId] = useState(initialEmp.id);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [vals, setVals] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<number, number>>({}); // kpiIdx -> override
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);

  const departments = Array.from(new Set(employees.map(deptOf))).sort();
  const visible = employees.filter(e => deptOf(e) === dept);
  const emp = employees.find(e => e.id === empId)!;
  const tpl = emp.kpiTemplate ? getDesignation(emp.kpiTemplate) : undefined;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i);

  // Switching department jumps to the first employee in it.
  const changeDept = (d: string) => {
    setDept(d);
    const first = employees.find(e => deptOf(e) === d);
    if (first && deptOf(emp) !== d) setEmpId(first.id);
  };

  // Load the year's saved operands + target overrides whenever the selected
  // employee or year changes. The fetch runs inside an async task (not a
  // synchronous setState in the effect body) and ignores stale responses.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function run() {
      try {
        const res = await fetch(`/api/kpi/values?employeeId=${empId}&year=${year}`, { signal: controller.signal });
        const data = await res.json();
        if (!active) return;
        if (data.error) throw new Error(data.error);
        const v: Record<string, number> = {};
        for (const r of data.values) if (r.value !== null) v[vk(r.month, r.kpiIdx, r.inputKey)] = r.value;
        const t: Record<number, number> = {};
        for (const r of data.targets) if (r.target !== null) t[r.kpiIdx] = r.target;
        setVals(v); setTargets(t); setError(null); setLoading(false);
      } catch (e: unknown) {
        if (active && (e as Error).name !== "AbortError") { setError((e as Error).message); setLoading(false); }
      }
    }
    run();
    return () => { active = false; controller.abort(); };
  }, [empId, year]);

  const opsFor = (m: number, kpi: KpiDef): Operands => {
    const o: Operands = {};
    for (const inp of kpi.inputs) {
      const key = vk(m, kpi.idx, inp.key);
      o[inp.key] = key in vals ? vals[key] : undefined;
    }
    return o;
  };

  // Annual value per KPI across all 12 months (computed from stored operands).
  const annualValue = (kpi: KpiDef): number | null => {
    const monthly = Array.from({ length: 12 }, (_, i) => monthlyValue(kpi.compute, kpi.inputs, opsFor(i + 1, kpi)));
    return annual(monthly, kpi.agg);
  };

  const saveOperand = async (kpi: KpiDef, inputKey: string, raw: string) => {
    const key = vk(month, kpi.idx, inputKey);
    setVals(prev => {
      const next = { ...prev };
      if (raw === "") delete next[key]; else next[key] = Number(raw);
      return next;
    });
    setSaving(s => s + 1); setError(null);
    try {
      const res = await fetch("/api/kpi/values", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: empId, templateCode: emp.kpiTemplate, year, month,
          kpiIdx: kpi.idx, inputKey, value: raw === "" ? null : Number(raw),
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(s => s - 1); }
  };

  const saveTarget = async (kpi: KpiDef, raw: string) => {
    setTargets(prev => {
      const next = { ...prev };
      if (raw === "") delete next[kpi.idx]; else next[kpi.idx] = Number(raw);
      return next;
    });
    setSaving(s => s + 1); setError(null);
    try {
      const res = await fetch("/api/kpi/values", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "target", employeeId: empId, year, kpiIdx: kpi.idx, target: raw === "" ? null : Number(raw) }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(s => s - 1); }
  };

  // Overall score = average of per-KPI annual scores that have data.
  const overall = (() => {
    if (!tpl) return null;
    const scores: number[] = [];
    for (const kpi of tpl.kpis) {
      const s = scoreFor(annualValue(kpi), kpi.target, targets[kpi.idx]);
      if (s !== null) scores.push(s);
    }
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  })();

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>KPI &mdash; Monthly Entry</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Type the raw figures for each KPI; value, 🟢🟡🔴 status and score compute automatically.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/kpi/assign" className="btn">🔗 Assign</Link>
          {overall !== null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>Overall {year}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--brand)" }}>{overall.toFixed(1)}<span style={{ fontSize: 12, color: "var(--text3)" }}>/10</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Selectors */}
      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <select value={dept} onChange={e => changeDept(e.target.value)} style={{ minWidth: 200 }} title="Filter by department">
          {departments.map(d => (
            <option key={d} value={d}>{d} ({employees.filter(e => deptOf(e) === d).length})</option>
          ))}
        </select>
        <select value={empId} onChange={e => setEmpId(Number(e.target.value))} style={{ minWidth: 240 }}>
          {visible.map(e => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.kpiTemplate}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {MONTH_LABELS.map((m, i) => (
            <button key={m} onClick={() => setMonth(i + 1)}
              className="btn btn-sm"
              style={{
                padding: "4px 9px",
                background: month === i + 1 ? "var(--brand)" : "var(--bg)",
                color: month === i + 1 ? "#fff" : "var(--text2)",
                borderColor: month === i + 1 ? "var(--brand)" : "var(--border)",
                fontWeight: month === i + 1 ? 700 : 500,
              }}>
              {m}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>{saving > 0 ? "Saving…" : "Saved"}</span>
      </div>

      {tpl && (
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>
          Template: <strong style={{ color: "var(--text)" }}>{tpl.code} · {tpl.title}</strong> · {tpl.department} · {tpl.kpis.length} KPIs
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 14 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="kpi-entry-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th style={{ minWidth: 200 }}>KPI</th>
              <th style={{ width: 90 }}>Target</th>
              <th style={{ minWidth: 220 }}>{MONTH_LABELS[month - 1]} {year} inputs</th>
              <th style={{ width: 90 }}>{MONTH_LABELS[month - 1]} value</th>
              <th style={{ width: 90 }}>Annual</th>
              <th style={{ width: 70 }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="empty">Loading…</td></tr>
            ) : tpl?.kpis.map(kpi => {
              const mVal = monthlyValue(kpi.compute, kpi.inputs, opsFor(month, kpi));
              const aVal = annualValue(kpi);
              const eff = effectiveTarget(kpi.target, targets[kpi.idx]);
              const mRag = ragFor(mVal, kpi.target, targets[kpi.idx]);
              const aRag = ragFor(aVal, kpi.target, targets[kpi.idx]);
              const aScore = scoreFor(aVal, kpi.target, targets[kpi.idx]);
              return (
                <tr key={kpi.idx}>
                  <td style={{ color: "var(--text3)" }}>{kpi.idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{kpi.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text3)" }}>{kpi.formulaText}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{kpi.target.raw}</div>
                    {kpi.target.qualitative && (
                      <input type="number" placeholder="set #" defaultValue={targets[kpi.idx] ?? ""}
                        onBlur={e => saveTarget(kpi, e.target.value)}
                        title="This target is qualitative — enter a number to enable scoring"
                        style={{ width: 70, padding: "2px 5px", fontSize: 11, marginTop: 3 }} />
                    )}
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>{kpi.unit} · {kpi.agg === "SUM" ? "sum" : "avg"}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {kpi.inputs.map(inp => (
                        <label key={inp.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                          <span style={{ flex: 1, color: "var(--text2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={inp.label}>{inp.label}</span>
                          <input type="number" defaultValue={vals[vk(month, kpi.idx, inp.key)] ?? ""}
                            key={`${empId}-${year}-${month}-${kpi.idx}-${inp.key}`}
                            onBlur={e => saveOperand(kpi, inp.key, e.target.value)}
                            style={{ width: 90, padding: "3px 6px", fontSize: 12 }} />
                        </label>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: "center", color: RAG_COLOR[mRag], fontWeight: 700 }}>
                    {mVal === null ? "—" : <>{fmt(mVal, kpi.unit)}<div style={{ fontSize: 13 }}>{RAG_EMOJI[mRag]}</div></>}
                  </td>
                  <td style={{ textAlign: "center", color: RAG_COLOR[aRag], fontWeight: 700 }}>
                    {aVal === null ? "—" : <>{fmt(aVal, kpi.unit)}<div style={{ fontSize: 13 }}>{RAG_EMOJI[aRag]}</div></>}
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 800, color: eff === null ? "var(--text3)" : "var(--brand)" }}>
                    {aScore === null ? "—" : aScore.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .kpi-entry-table { border-collapse: collapse; width: 100%; font-size: 12px; background: var(--bg); }
        .kpi-entry-table th, .kpi-entry-table td {
          border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top;
        }
        .kpi-entry-table thead th { background: var(--bg2); font-weight: 700; font-size: 11.5px; white-space: nowrap; }
        .kpi-entry-table tbody tr:hover td { background: var(--bg2); }
      `}</style>
    </div>
  );
}
