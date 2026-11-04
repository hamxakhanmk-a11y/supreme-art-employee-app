"use client";
import { useMemo, useState } from "react";
import { usePageState } from "@/lib/usePageState";
import { LEAVE_STYLE, formatMins } from "@/lib/station";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { matchesQuery, cmpText } from "@/lib/listTools";

export type EmpTotals = {
  id: number; employeeId: string; firstName: string; lastName: string;
  department: string | null; stationPin: string | null;
  agg: { personal: number; official: number; trips: number; open: number };
};

type TotSort = "personal" | "name" | "empId" | "department" | "trips" | "official" | "total";
const SORT_OPTIONS: SortOption<TotSort>[] = [
  { value: "personal", label: "Personal time (most first)" },
  { value: "name", label: "Employee (A–Z)" },
  { value: "empId", label: "Employee ID" },
  { value: "department", label: "Department" },
  { value: "trips", label: "Trips (most first)" },
  { value: "official", label: "Official time" },
  { value: "total", label: "Total out" },
];

// Station → Who's Out → Report (and Reports → Station): each employee's time outside the factory
// in the range. The rows arrive already in the default order (most personal time first).
export default function PerEmployeeTotals({ summary }: { summary: EmpTotals[] }) {
  const [query, setQuery] = usePageState("totals.q", "");
  const [sort, setSort] = usePageState<TotSort>("totals.sort", "personal");

  const rows = useMemo(() => {
    const found = summary.filter(r => matchesQuery(query, [r.firstName, r.lastName, `${r.firstName} ${r.lastName}`, r.employeeId, r.department]));
    const total = (r: EmpTotals) => r.agg.personal + r.agg.official;
    const cmp: Record<TotSort, (a: EmpTotals, b: EmpTotals) => number> = {
      personal: () => 0,
      name: (a, b) => cmpText(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`),
      empId: (a, b) => cmpText(a.employeeId, b.employeeId),
      department: (a, b) => cmpText(a.department, b.department),
      trips: (a, b) => b.agg.trips - a.agg.trips,
      official: (a, b) => b.agg.official - a.agg.official,
      total: (a, b) => total(b) - total(a),
    };
    return sort === "personal" ? found : [...found].sort(cmp[sort]);
  }, [summary, query, sort]);

  return (
    <div className="no-print" style={{ marginTop: 22 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <strong style={{ fontSize: 15, marginRight: 4 }}>Per-employee totals</strong>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox value={query} onChange={setQuery} placeholder="🔍  Search name, ID, department…" width={230} />
          <SortBy options={SORT_OPTIONS} value={sort} onChange={setSort} minWidth={185} />
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Department</th><th style={{ textAlign: "center" }}>PIN</th>
              <th className="num">Trips</th>
              <th className="num" style={{ color: LEAVE_STYLE.personal.color }}>Personal (deducted)</th>
              <th className="num" style={{ color: LEAVE_STYLE.official.color }}>Official (excused)</th>
              <th className="num">Total out</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 22, color: "var(--text3)", fontSize: 13 }}>No employee matches this search.</td></tr>
            )}
            {rows.map(r => {
              const total = r.agg.personal + r.agg.official;
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.firstName} {r.lastName}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.employeeId}{r.agg.open > 0 && <span style={{ color: "#DC2626", fontWeight: 700 }}> · out now</span>}</div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{r.department || "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--brand)" }}>{r.stationPin || "—"}</td>
                  <td className="num">{r.agg.trips || ""}</td>
                  <td className="num" style={{ color: r.agg.personal ? LEAVE_STYLE.personal.color : "var(--text3)", fontWeight: r.agg.personal ? 700 : 400 }}>{r.agg.personal ? formatMins(r.agg.personal) : "—"}</td>
                  <td className="num" style={{ color: r.agg.official ? LEAVE_STYLE.official.color : "var(--text3)" }}>{r.agg.official ? formatMins(r.agg.official) : "—"}</td>
                  <td className="num-strong">{total ? formatMins(total) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        The <strong>PIN</strong> column is each employee&apos;s Station PIN — share it with them so they can punch in/out.
      </div>
    </div>
  );
}
