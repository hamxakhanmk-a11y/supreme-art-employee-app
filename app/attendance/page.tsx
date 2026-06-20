"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";

type Row = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  photoUrl: string | null;
  status: "present" | "absent" | "leave" | "half-day" | "late" | "holiday" | "week-off" | null;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
};

const STATUS = {
  present:    { label: "Present",   color: "#15803D", bg: "#e3f5e3" },
  absent:     { label: "Absent",    color: "#DC2626", bg: "#fde2e2" },
  leave:      { label: "Leave",     color: "#D97706", bg: "#fdebd0" },
  "half-day": { label: "Half-day",  color: "#1D4ED8", bg: "#dfe8fc" },
  late:       { label: "Late",      color: "#EA580C", bg: "#fde2cf" },
  holiday:    { label: "Holiday",   color: "#0E7490", bg: "#cffafe" },
  "week-off": { label: "Week Off",  color: "#475569", bg: "#e2e8f0" },
} as const;

export default function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance?date=${d}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRows(data.rows);
      setClosed(data.closed);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(date); }, [date, fetchData]);

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const persist = async (emp: Row, patch: Partial<Row>) => {
    if (closed) return;
    const merged = { ...emp, ...patch };
    // Don't auto-mark anyone. Only save once the admin has explicitly
    // picked a status pill — typing a check-in time or note before
    // choosing a status does nothing.
    if (!merged.status) return;
    setSavingId(emp.id);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: emp.id, date,
          status: merged.status,
          checkIn: merged.checkIn || null,
          checkOut: merged.checkOut || null,
          notes: merged.notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const mark = (emp: Row, status: Row["status"]) => {
    updateRow(emp.id, { status });
    persist(emp, { status });
  };

  const closeDay = async () => {
    if (!confirm(`Close attendance for ${date}? After closing, no changes can be made unless you reopen the day.`)) return;
    const res = await fetch("/api/attendance/close", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (res.ok) setClosed(true);
    else { const j = await res.json().catch(() => ({})); setError(j.error || "Failed to close"); }
  };

  const reopenDay = async () => {
    if (!confirm(`Reopen attendance for ${date}? Edits will be allowed again.`)) return;
    const res = await fetch(`/api/attendance/close?date=${date}`, { method: "DELETE" });
    if (res.ok) setClosed(false);
  };

  const exportCSV = () => {
    downloadCSV(`attendance-${date}`,
      ["Employee ID", "Name", "Designation", "Department", "Status", "Check-in", "Check-out", "Notes"],
      rows.map(r => [
        r.employeeId, `${r.firstName} ${r.lastName}`, r.designation || "", r.department || "",
        r.status ? STATUS[r.status].label : "Unmarked",
        r.checkIn || "", r.checkOut || "", r.notes || "",
      ])
    );
  };

  const summary = {
    present: rows.filter(r => r.status === "present").length,
    absent:  rows.filter(r => r.status === "absent").length,
    leave:   rows.filter(r => r.status === "leave").length,
    halfday: rows.filter(r => r.status === "half-day").length,
    late:    rows.filter(r => r.status === "late").length,
    unmarked:rows.filter(r => r.status === null).length,
  };

  return (
    <div className="fade-up">
      <PrintHeader title="Daily Attendance" subtitle={new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} meta={closed ? "Status: CLOSED" : "Status: Open for marking"} />
      {/* Header */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Mark Attendance</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {rows.length} employee{rows.length !== 1 ? "s" : ""} • {date}
            {closed && <span style={{ marginLeft: 10, color: "var(--danger)", fontWeight: 700 }}>🔒 Closed</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "auto" }} />
          <button onClick={() => window.print()} className="btn btn-print">🖨 Print</button>
          <button onClick={exportCSV} className="btn" disabled={!rows.length}>⬇ Excel (CSV)</button>
          {!closed ? (
            <button onClick={closeDay} disabled={!rows.length}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: "1px solid #B45309",
                background: "#F59E0B", color: "#1f1300",
                fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                boxShadow: "0 2px 6px rgba(245,158,11,0.35)",
                cursor: rows.length ? "pointer" : "not-allowed",
                opacity: rows.length ? 1 : 0.6,
              }}>
              🔒 Close Day
            </button>
          ) : (
            <button onClick={reopenDay}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: "1px solid #991B1B",
                background: "#DC2626", color: "#fff",
                fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                boxShadow: "0 2px 6px rgba(220,38,38,0.35)",
                cursor: "pointer",
              }}>
              🔓 Day Closed — Reopen
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 18 }}>
        <StatChip label="Present"  count={summary.present}  color="#15803D" bg="#e3f5e3" />
        <StatChip label="Absent"   count={summary.absent}   color="#DC2626" bg="#fde2e2" />
        <StatChip label="Leave"    count={summary.leave}    color="#D97706" bg="#fdebd0" />
        <StatChip label="Half-day" count={summary.halfday}  color="#1D4ED8" bg="#dfe8fc" />
        <StatChip label="Late"     count={summary.late}     color="#EA580C" bg="#fde2cf" />
        <StatChip label="Unmarked" count={summary.unmarked} color="#888"    bg="#f3f3f3" />
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No employees found. Add employees first.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}></th>
                <th>Employee</th>
                <th>Status</th>
                <th style={{ width: 110 }}>Check-in</th>
                <th style={{ width: 110 }}>Check-out</th>
                <th>Notes</th>
                <th style={{ width: 50, textAlign: "center" }} className="no-print">·</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    {r.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photoUrl} alt="" className="avatar" style={{ width: 52, height: 52 }} />
                    ) : (
                      <div className="avatar" style={{ width: 52, height: 52, background: "linear-gradient(135deg, var(--brand), var(--brand-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
                        {r.firstName[0]}{r.lastName[0]}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.firstName} {r.lastName}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{r.employeeId} · {r.designation || "—"}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map(s => {
                        const active = r.status === s;
                        return (
                          <button
                            key={s}
                            disabled={closed || savingId === r.id}
                            onClick={() => mark(r, s)}
                            style={{
                              padding: "5px 11px", borderRadius: 6, fontSize: 11.5,
                              fontWeight: 700, letterSpacing: 0.3,
                              background: active ? STATUS[s].color : "#fff",
                              color: active ? "#fff" : STATUS[s].color,
                              border: `1.5px solid ${STATUS[s].color}`,
                              boxShadow: active ? `0 2px 6px ${STATUS[s].color}55` : "none",
                              cursor: closed ? "not-allowed" : "pointer",
                              opacity: closed ? 0.6 : 1,
                              transition: "all 0.15s",
                            }}
                          >
                            {STATUS[s].label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <input type="time" value={r.checkIn ?? ""} disabled={closed}
                      onChange={e => updateRow(r.id, { checkIn: e.target.value })}
                      onBlur={() => persist(r, {})}
                      style={{ padding: "5px 8px", fontSize: 12 }} />
                  </td>
                  <td>
                    <input type="time" value={r.checkOut ?? ""} disabled={closed}
                      onChange={e => updateRow(r.id, { checkOut: e.target.value })}
                      onBlur={() => persist(r, {})}
                      style={{ padding: "5px 8px", fontSize: 12 }} />
                  </td>
                  <td>
                    <input type="text" value={r.notes ?? ""} disabled={closed}
                      placeholder="Add note…"
                      onChange={e => updateRow(r.id, { notes: e.target.value })}
                      onBlur={() => persist(r, {})}
                      style={{ padding: "5px 8px", fontSize: 12 }} />
                  </td>
                  <td className="no-print" style={{ textAlign: "center" }}>
                    <Link href={`/employees/${r.id}/attendance`}
                      style={{ color: "var(--brand)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                      History
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className="card" style={{ background: bg, borderColor: `${color}33`, textAlign: "center", padding: "0.9rem 0.5rem" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}
