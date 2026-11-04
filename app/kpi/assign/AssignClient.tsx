"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { byDepartment, getDesignation } from "@/lib/kpi/catalog";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { empMatches, cmpText } from "@/lib/listTools";
import { usePageState } from "@/lib/usePageState";

type AssignSort = "default" | "nameDesc" | "id" | "department" | "designation" | "unassigned";
const SORT_OPTIONS: SortOption<AssignSort>[] = [
  { value: "default", label: "Employee (A–Z)" },
  { value: "nameDesc", label: "Employee (Z–A)" },
  { value: "id", label: "Employee ID" },
  { value: "department", label: "Department" },
  { value: "designation", label: "Designation" },
  { value: "unassigned", label: "Unassigned first" },
];

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
  // Search, the unset-only toggle and sort are kept for when the user comes back to this screen.
  const [query, setQuery] = usePageState("q", "");
  const [onlyUnset, setOnlyUnset] = usePageState("unset", false);
  const [sort, setSort] = usePageState<AssignSort>("sort", "default");

  const assigned = rows.filter(r => r.kpiTemplate).length;

  const matched = rows.filter(r => {
    if (onlyUnset && r.kpiTemplate) return false;
    return empMatches(query, r);
  });

  // "default" is the order the server sends (by first name); the rest re-order it.
  const filtered = (() => {
    const nameOf = (r: Emp) => `${r.firstName} ${r.lastName}`;
    const cmp: Record<AssignSort, (a: Emp, b: Emp) => number> = {
      default: () => 0,
      nameDesc: (a, b) => cmpText(nameOf(b), nameOf(a)),
      id: (a, b) => cmpText(a.employeeId, b.employeeId),
      department: (a, b) => cmpText(a.department, b.department) || cmpText(nameOf(a), nameOf(b)),
      designation: (a, b) => cmpText(a.designation, b.designation) || cmpText(nameOf(a), nameOf(b)),
      unassigned: (a, b) => Number(!!a.kpiTemplate) - Number(!!b.kpiTemplate),
    };
    return [...matched].sort(cmp[sort]);
  })();

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
      {/* One row: the counts, search and sort, the filter; Back and the primary action are grouped at the right. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <Stat label="Assigned" value={assigned} color="var(--success)" bg="var(--success-bg)" />
          <Stat label="Employees" value={rows.length} color="#1a1a1a" bg="#fafaf6" />
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox value={query} onChange={setQuery} placeholder="🔍  Search name, ID, role…" width={230} />
          <SortBy options={SORT_OPTIONS} value={sort} onChange={setSort} minWidth={165} />
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text2)" }}>
            <input type="checkbox" checked={onlyUnset} onChange={e => setOnlyUnset(e.target.checked)} style={{ width: "auto" }} />
            Only unassigned
          </label>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexShrink: 0 }}>
          <Link href="/kpi" className="btn btn-back">← Overview</Link>
          <Link href="/kpi/entry" className="btn btn-primary">Monthly Entry →</Link>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
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

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 9px", borderRadius: 8, background: bg, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10.5, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}
