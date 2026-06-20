"use client";
import { useState, useEffect, useCallback } from "react";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string };
type Row = { id: number; date: string; status: string; checkIn: string | null; checkOut: string | null; notes: string | null };

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  present:    { label: "Present",  color: "#15803D", bg: "#e3f5e3" },
  absent:     { label: "Absent",   color: "#DC2626", bg: "#fde2e2" },
  leave:      { label: "Leave",    color: "#D97706", bg: "#fdebd0" },
  "half-day": { label: "Half-day", color: "#1D4ED8", bg: "#dfe8fc" },
  late:       { label: "Late",     color: "#EA580C", bg: "#fde2cf" },
};

export default function EmployeeAttendanceClient({ employee }: { employee: Emp }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, employeeId: String(employee.id) });
      const res = await fetch(`/api/attendance?${p}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [from, to, employee.id]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));

  const totals = {
    present: rows.filter(r => r.status === "present").length,
    absent:  rows.filter(r => r.status === "absent").length,
    leave:   rows.filter(r => r.status === "leave").length,
    halfday: rows.filter(r => r.status === "half-day").length,
    late:    rows.filter(r => r.status === "late").length,
  };

  const exportCSV = () => {
    downloadCSV(`attendance-${employee.employeeId}-${from}_to_${to}`,
      ["Date", "Status", "Check-in", "Check-out", "Notes"],
      sorted.map(r => [
        r.date,
        STATUS_LABEL[r.status]?.label || r.status,
        r.checkIn || "", r.checkOut || "", r.notes || "",
      ])
    );
  };

  return (
    <>
      <PrintHeader
        title="Attendance History"
        subtitle={`${employee.firstName} ${employee.lastName} (${employee.employeeId})`}
        meta={`Period: ${new Date(from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
      />
      {/* Filters */}
      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, alignItems: "end" }}>
          <div>
            <label className="form-label">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => window.print()} className="btn btn-print" style={{ flex: 1 }}>🖨 Print</button>
            <button onClick={exportCSV} className="btn btn-primary" style={{ flex: 1 }} disabled={!sorted.length}>⬇ Excel</button>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 16 }}>
        {Object.entries(STATUS_LABEL).map(([k, v]) => {
          const count = totals[k === "half-day" ? "halfday" : k as keyof typeof totals] ?? 0;
          return (
            <div key={k} className="card" style={{ background: v.bg, borderColor: `${v.color}33`, textAlign: "center", padding: "0.9rem 0.5rem" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: v.color }}>{count}</div>
              <div style={{ fontSize: 11, color: v.color, fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{v.label}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div className="empty">Loading…</div>
          : sorted.length === 0 ? <div className="empty">No attendance records in this range.</div>
          : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const s = STATUS_LABEL[r.status];
                return (
                  <tr key={r.id}>
                    <td>{new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>{s ? <span style={{ display: "inline-block", padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 999, letterSpacing: 0.3, background: s.color, color: "#fff", boxShadow: `0 1px 3px ${s.color}55` }}>{s.label}</span> : r.status}</td>
                    <td>{r.checkIn || "—"}</td>
                    <td>{r.checkOut || "—"}</td>
                    <td style={{ color: "#666" }}>{r.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
