"use client";
import { useState, useEffect, useCallback } from "react";

type EmployeeAttendance = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  photoUrl: string | null;
  status: "present" | "absent" | "leave" | null;
};

const STATUS_CONFIG = {
  present: { label: "Present", color: "var(--success)", bg: "var(--success-bg)" },
  absent:  { label: "Absent",  color: "var(--danger)",  bg: "var(--danger-bg)"  },
  leave:   { label: "Leave",   color: "var(--warning)", bg: "var(--warning-bg)" },
};

export default function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [employees, setEmployees] = useState<EmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance?date=${d}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmployees(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAttendance(date); }, [date, fetchAttendance]);

  const mark = async (emp: EmployeeAttendance, status: "present" | "absent" | "leave") => {
    setSaving(emp.id);
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: emp.id, date, status }),
      });
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status } : e));
    } finally {
      setSaving(null);
    }
  };

  const summary = {
    present: employees.filter(e => e.status === "present").length,
    absent:  employees.filter(e => e.status === "absent").length,
    leave:   employees.filter(e => e.status === "leave").length,
    unmarked: employees.filter(e => e.status === null).length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Attendance</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>{employees.length} employee{employees.length !== 1 ? "s" : ""}</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ width: "auto", fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-strong)" }}
        />
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Present",  count: summary.present,  color: "var(--success)", bg: "var(--success-bg)" },
          { label: "Absent",   count: summary.absent,   color: "var(--danger)",  bg: "var(--danger-bg)"  },
          { label: "On Leave", count: summary.leave,    color: "var(--warning)", bg: "var(--warning-bg)" },
          { label: "Unmarked", count: summary.unmarked, color: "#888",           bg: "#f3f3f3"           },
        ].map(s => (
          <div key={s.label} className="card" style={{ background: s.bg, border: `1px solid ${s.color}22`, textAlign: "center", padding: "1rem" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Attendance table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="empty">Loading...</div>
        ) : employees.length === 0 ? (
          <div className="empty">No employees found. Add employees first.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}>Photo</th>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Mark Attendance</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    {emp.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={emp.photoUrl} alt={emp.firstName} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }} />
                    ) : (
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#999" }}>
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--primary)", fontSize: 12 }}>{emp.employeeId}</td>
                  <td style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</td>
                  <td style={{ color: "#666" }}>{emp.designation || "—"}</td>
                  <td style={{ color: "#666" }}>{emp.department || "—"}</td>
                  <td>
                    {emp.status ? (
                      <span style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: STATUS_CONFIG[emp.status].bg,
                        color: STATUS_CONFIG[emp.status].color,
                      }}>
                        {STATUS_CONFIG[emp.status].label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#aaa" }}>— Unmarked</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {(["present", "absent", "leave"] as const).map(s => (
                        <button
                          key={s}
                          disabled={saving === emp.id}
                          onClick={() => mark(emp, s)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 6,
                            border: `1px solid ${STATUS_CONFIG[s].color}44`,
                            background: emp.status === s ? STATUS_CONFIG[s].bg : "#fff",
                            color: STATUS_CONFIG[s].color,
                            fontWeight: emp.status === s ? 700 : 500,
                            fontSize: 11,
                            cursor: saving === emp.id ? "not-allowed" : "pointer",
                            opacity: saving === emp.id ? 0.6 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          {STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
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
