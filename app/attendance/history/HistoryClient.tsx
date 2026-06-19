"use client";
import { useState, useEffect, useCallback } from "react";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string };
type Row = { id: number; employeeId: number; date: string; status: string; checkIn: string | null; checkOut: string | null; notes: string | null };

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  present:    { label: "Present",  color: "var(--success)", bg: "var(--success-bg)" },
  absent:     { label: "Absent",   color: "var(--danger)",  bg: "var(--danger-bg)"  },
  leave:      { label: "Leave",    color: "var(--warning)", bg: "var(--warning-bg)" },
  "half-day": { label: "Half-day", color: "#0C447C",        bg: "var(--info-bg)"    },
  late:       { label: "Late",     color: "#7C1F1F",        bg: "#fdecec"           },
};

export default function HistoryClient({ employees }: { employees: Emp[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (employeeId) p.set("employeeId", employeeId);
      const res = await fetch(`/api/attendance?${p}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [from, to, employeeId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const empById = new Map(employees.map(e => [e.id, e]));

  const sorted = [...rows]
    .filter(r => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const e = empById.get(r.employeeId);
      const fields = [
        e?.firstName, e?.lastName, e?.employeeId,
        `${e?.firstName ?? ""} ${e?.lastName ?? ""}`,
        r.status, r.notes,
      ];
      return fields.some(f => f && String(f).toLowerCase().includes(q));
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totals = {
    present: rows.filter(r => r.status === "present").length,
    absent:  rows.filter(r => r.status === "absent").length,
    leave:   rows.filter(r => r.status === "leave").length,
    halfday: rows.filter(r => r.status === "half-day").length,
    late:    rows.filter(r => r.status === "late").length,
  };

  const exportCSV = () => {
    downloadCSV(`attendance-history-${from}_to_${to}${employeeId ? `-emp${employeeId}` : ""}`,
      ["Date", "Employee ID", "Name", "Status", "Check-in", "Check-out", "Notes"],
      sorted.map(r => {
        const e = empById.get(r.employeeId);
        return [
          r.date, e?.employeeId || "", e ? `${e.firstName} ${e.lastName}` : "",
          STATUS_LABEL[r.status]?.label || r.status,
          r.checkIn || "", r.checkOut || "", r.notes || "",
        ];
      })
    );
  };

  const empMeta = employeeId ? (() => {
    const e = empById.get(parseInt(employeeId));
    return e ? `Employee: ${e.firstName} ${e.lastName} (${e.employeeId})` : undefined;
  })() : undefined;

  return (
    <>
      <PrintHeader
        title="Attendance History"
        subtitle={`${new Date(from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
        meta={empMeta}
      />
      {/* Search bar */}
      <div className="no-print" style={{ marginBottom: 12, position: "relative" }}>
        <input
          type="text"
          placeholder="🔍  Quick search by employee name, ID, status, or note…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", padding: "11px 16px", fontSize: 13 }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", color: "#888", cursor: "pointer",
              fontSize: 14, padding: 4,
            }}
            title="Clear search"
          >✕</button>
        )}
      </div>

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
          <div>
            <label className="form-label">Employee</label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
            </select>
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
          : sorted.length === 0 ? <div className="empty">No records match these filters.</div>
          : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const e = empById.get(r.employeeId);
                const s = STATUS_LABEL[r.status];
                return (
                  <tr key={r.id}>
                    <td>{new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e ? `${e.firstName} ${e.lastName}` : `Employee #${r.employeeId}`}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{e?.employeeId}</div>
                    </td>
                    <td>
                      {s ? <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span> : r.status}
                    </td>
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
