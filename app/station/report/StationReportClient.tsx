"use client";
import { useMemo, useState } from "react";
import { LEAVE_STYLE, hhmm, formatMins, type LeaveType } from "@/lib/station";
import { downloadRegisterXlsx } from "@/lib/xlsx";

export interface Trip {
  id: number;
  employeeId: number;
  empCode: string;
  name: string;
  department: string | null;
  date: string;
  outAt: string;
  inAt: string | null;
  type: string;
  reason: string | null;
  minutes: number | null;
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function StationReportClient({
  trips, from, to,
}: { trips: Trip[]; from: string; to: string }) {
  const [empFilter, setEmpFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | LeaveType>("all");

  const rows = useMemo(() => trips.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (empFilter && !`${t.name} ${t.empCode}`.toLowerCase().includes(empFilter.toLowerCase())) return false;
    return true;
  }), [trips, empFilter, typeFilter]);

  const totPersonal = rows.filter(r => r.type === "personal").reduce((s, r) => s + (r.minutes ?? 0), 0);
  const totOfficial = rows.filter(r => r.type === "official").reduce((s, r) => s + (r.minutes ?? 0), 0);
  const openCount = rows.filter(r => r.inAt === null).length;

  function exportXlsx() {
    downloadRegisterXlsx({
      filename: `station-hourly-leaves_${from}_to_${to}`,
      sheetName: "Hourly Leaves",
      title: `Supreme Art — Hourly Leaves (Station)   ${fmtDate(from)} → ${fmtDate(to)}`,
      headers: ["Emp ID", "Employee", "Department", "Date", "Check Out", "Check In", "Duration", "Type", "Reason"],
      rows: rows.map(r => [
        r.empCode,
        r.name,
        r.department || "",
        fmtDate(r.date),
        hhmm(r.outAt),
        r.inAt ? hhmm(r.inAt) : "still out",
        r.minutes != null ? formatMins(r.minutes) : "",
        LEAVE_STYLE[r.type as LeaveType]?.label ?? r.type,
        r.reason || "",
      ]),
      freezeCols: 2,
      colWidths: [10, 22, 16, 12, 11, 11, 11, 11, 38],
    });
  }

  return (
    <>
      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: "var(--text2)" }}>
          <span style={{ fontWeight: 600 }}>From</span>
          <input type="date" name="from" defaultValue={from} style={{ width: 150 }} />
          <span>→</span>
          <input type="date" name="to" defaultValue={to} style={{ width: 150 }} />
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
        </form>

        <input
          value={empFilter}
          onChange={e => setEmpFilter(e.target.value)}
          placeholder="🔍 Employee name or ID"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, width: 210 }}
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as "all" | LeaveType)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
          <option value="all">All types</option>
          <option value="personal">Personal only</option>
          <option value="official">Official only</option>
        </select>

        <div style={{ flex: 1 }} />
        <button onClick={exportXlsx} className="btn btn-sm" disabled={rows.length === 0}>⬇ Export Excel</button>
        <button onClick={() => window.print()} className="btn btn-sm">🖨 Print</button>
      </div>

      <div className="no-print" style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
        <strong>{rows.length}</strong> trip{rows.length === 1 ? "" : "s"} ·
        {" "}Personal <strong style={{ color: LEAVE_STYLE.personal.color }}>{formatMins(totPersonal)}</strong> (deducted) ·
        {" "}Official <strong style={{ color: LEAVE_STYLE.official.color }}>{formatMins(totOfficial)}</strong> (excused)
        {openCount > 0 && <> · <strong style={{ color: "#DC2626" }}>{openCount} still out</strong></>}
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th style={{ textAlign: "center" }}>Date</th>
              <th style={{ textAlign: "center" }}>Check Out</th>
              <th style={{ textAlign: "center" }}>Check In</th>
              <th className="num">Duration</th>
              <th style={{ textAlign: "center" }}>Type</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                No hourly leaves in this range.
              </td></tr>
            ) : rows.map(r => {
              const st = LEAVE_STYLE[r.type as LeaveType];
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.empCode}</div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{r.department || "—"}</td>
                  <td style={{ textAlign: "center", fontSize: 12.5 }}>{fmtDate(r.date)}</td>
                  <td style={{ textAlign: "center", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{hhmm(r.outAt)}</td>
                  <td style={{ textAlign: "center", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {r.inAt ? hhmm(r.inAt) : <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 12 }}>still out</span>}
                  </td>
                  <td className="num-strong">{r.minutes != null ? formatMins(r.minutes) : "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      color: st?.color, background: st?.bg,
                    }}>{st?.label ?? r.type}</span>
                  </td>
                  <td style={{ fontSize: 12.5, color: r.reason ? "var(--text)" : "var(--text3)", maxWidth: 280 }}>
                    {r.reason || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        Only <strong style={{ color: LEAVE_STYLE.personal.color }}>Personal</strong> time is subtracted from worked hours in the attendance register.
        The reason is captured at the terminal when the employee punches out.
      </div>
    </>
  );
}
