"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { downloadCSV } from "@/lib/csv";

type Row = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  photoUrl: string | null;
  status: "present" | "absent" | "leave" | "half-day" | "late" | null;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
};

const STATUS = {
  present:    { label: "Present",  color: "var(--success)", bg: "var(--success-bg)" },
  absent:     { label: "Absent",   color: "var(--danger)",  bg: "var(--danger-bg)"  },
  leave:      { label: "Leave",    color: "var(--warning)", bg: "var(--warning-bg)" },
  "half-day": { label: "Half-day", color: "#0C447C",        bg: "var(--info-bg)"    },
  late:       { label: "Late",     color: "#7C1F1F",        bg: "#fdecec"           },
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
    setSavingId(emp.id);
    try {
      const merged = { ...emp, ...patch };
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: emp.id, date,
          status: merged.status || "present",
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
            <button onClick={closeDay} className="btn btn-primary" disabled={!rows.length}>🔒 Close Day</button>
          ) : (
            <button onClick={reopenDay} className="btn btn-danger-soft">🔓 Reopen Day</button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 18 }}>
        <StatChip label="Present"  count={summary.present}  color="var(--success)" bg="var(--success-bg)" />
        <StatChip label="Absent"   count={summary.absent}   color="var(--danger)"  bg="var(--danger-bg)"  />
        <StatChip label="Leave"    count={summary.leave}    color="var(--warning)" bg="var(--warning-bg)" />
        <StatChip label="Half-day" count={summary.halfday}  color="#0C447C"        bg="var(--info-bg)"    />
        <StatChip label="Late"     count={summary.late}     color="#7C1F1F"        bg="#fdecec"           />
        <StatChip label="Unmarked" count={summary.unmarked} color="#888"           bg="#f3f3f3"           />
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
                      <img src={r.photoUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }} />
                    ) : (
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary), var(--primary-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
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
                      {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map(s => (
                        <button
                          key={s}
                          disabled={closed || savingId === r.id}
                          onClick={() => mark(r, s)}
                          style={{
                            padding: "4px 9px", borderRadius: 6, fontSize: 11, fontWeight: r.status === s ? 700 : 500,
                            background: r.status === s ? STATUS[s].bg : "#fff",
                            color: STATUS[s].color,
                            border: `1px solid ${r.status === s ? STATUS[s].color : "var(--border)"}`,
                            cursor: closed ? "not-allowed" : "pointer",
                            opacity: closed ? 0.6 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          {STATUS[s].label}
                        </button>
                      ))}
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
                    <Link href={`/employees/${r.id}/attendance`} title="View history"
                      style={{ color: "var(--primary)", textDecoration: "none", fontSize: 14 }}>📋</Link>
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
