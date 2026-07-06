"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { byDepartment, getDesignation } from "@/lib/kpi/catalog";

type Emp = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string | null;
  designation: string | null;
  kpiTemplate: string | null;
};

export default function AssignClient({ employees }: { employees: Emp[] }) {
  const groups = useMemo(() => byDepartment(), []);
  const [rows, setRows] = useState<Emp[]>(employees);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyUnset, setOnlyUnset] = useState(false);

  const assigned = rows.filter(r => r.kpiTemplate).length;

  const filtered = rows.filter(r => {
    if (onlyUnset && r.kpiTemplate) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return `${r.firstName} ${r.lastName} ${r.employeeId} ${r.designation ?? ""} ${r.department ?? ""}`.toLowerCase().includes(q);
  });

  const assign = async (emp: Emp, code: string) => {
    const templateCode = code || null;
    setSavingId(emp.id);
    setError(null);
    setRows(prev => prev.map(r => r.id === emp.id ? { ...r, kpiTemplate: templateCode } : r));
    try {
      const res = await fetch("/api/kpi/assign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: emp.id, templateCode }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
    } catch (e: any) {
      setError(e.message);
      setRows(prev => prev.map(r => r.id === emp.id ? { ...r, kpiTemplate: emp.kpiTemplate } : r)); // revert
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>KPI &mdash; Assign Templates</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Give each employee a KPI template (its formulas match the role). {assigned} of {rows.length} assigned.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/kpi" className="btn">← Overview</Link>
          <Link href="/kpi/entry" className="btn btn-primary">Monthly Entry →</Link>
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder="Search name, ID, role…" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 260 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text2)" }}>
          <input type="checkbox" checked={onlyUnset} onChange={e => setOnlyUnset(e.target.checked)} style={{ width: "auto" }} />
          Only unassigned
        </label>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Current Designation</th>
              <th>Department</th>
              <th style={{ width: 300 }}>KPI Template</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={4} className="empty">No employees match.</td></tr>}
            {filtered.map(emp => {
              const tpl = emp.kpiTemplate ? getDesignation(emp.kpiTemplate) : null;
              return (
                <tr key={emp.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.firstName} {emp.lastName}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{emp.employeeId}</div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{emp.designation || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{emp.department || "—"}</td>
                  <td>
                    <select
                      value={emp.kpiTemplate || ""}
                      disabled={savingId === emp.id}
                      onChange={e => assign(emp, e.target.value)}
                      style={{
                        width: "100%",
                        borderColor: emp.kpiTemplate ? "#15803D" : undefined,
                        color: emp.kpiTemplate ? "var(--text)" : "#999",
                      }}
                    >
                      <option value="">— Not tracked —</option>
                      {groups.map(g => (
                        <optgroup key={g.department} label={g.department}>
                          {g.designations.map(d => (
                            <option key={d.code} value={d.code}>{d.code} · {d.title} ({d.kpis.length})</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {tpl && (
                      <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 3 }}>
                        {tpl.kpis.length} KPIs · {tpl.department}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
