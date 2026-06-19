"use client";
import { useState, useEffect, useCallback } from "react";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string };
type LT = { id: number; name: string; color: string | null };
type Req = {
  id: number; employeeId: number; leaveTypeId: number;
  startDate: string; endDate: string; days: number;
  reason: string | null; status: string;
  decidedBy: string | null; decisionNote: string | null;
};

const STATUS = {
  pending:  { label: "Pending",  color: "var(--warning)", bg: "var(--warning-bg)" },
  approved: { label: "Approved", color: "var(--success)", bg: "var(--success-bg)" },
  rejected: { label: "Rejected", color: "var(--danger)",  bg: "var(--danger-bg)"  },
};

export default function LeaveHistoryClient({ employees, leaveTypes }: { employees: Emp[]; leaveTypes: LT[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (employeeId) p.set("employeeId", employeeId);
      if (status) p.set("status", status);
      const res = await fetch(`/api/leave/requests?${p}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [from, to, employeeId, status]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const empById = new Map(employees.map(e => [e.id, e]));
  const typeById = new Map(leaveTypes.map(t => [t.id, t]));

  const filtered = rows.filter(r => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const e = empById.get(r.employeeId);
    const t = typeById.get(r.leaveTypeId);
    return [
      e?.firstName, e?.lastName, e?.employeeId, `${e?.firstName} ${e?.lastName}`,
      t?.name, r.status, r.reason,
    ].some(f => f && String(f).toLowerCase().includes(q));
  });

  const totals = {
    total: filtered.length,
    days: filtered.reduce((sum, r) => sum + r.days, 0),
    approved: filtered.filter(r => r.status === "approved").length,
    pending: filtered.filter(r => r.status === "pending").length,
    rejected: filtered.filter(r => r.status === "rejected").length,
  };

  const exportCSV = () => {
    downloadCSV(`leave-history-${from}_to_${to}`,
      ["From", "To", "Days", "Employee ID", "Employee", "Type", "Status", "Reason", "Decided By", "Decision Note"],
      filtered.map(r => {
        const e = empById.get(r.employeeId);
        const t = typeById.get(r.leaveTypeId);
        return [
          r.startDate, r.endDate, r.days,
          e?.employeeId || "", e ? `${e.firstName} ${e.lastName}` : "",
          t?.name || "", STATUS[r.status as keyof typeof STATUS]?.label || r.status,
          r.reason || "", r.decidedBy || "", r.decisionNote || "",
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
        title="Leave History"
        subtitle={`${new Date(from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
        meta={empMeta}
      />
      <div className="no-print" style={{ marginBottom: 12, position: "relative" }}>
        <input type="text" placeholder="🔍  Search by employee, leave type, status, reason…"
          value={query} onChange={e => setQuery(e.target.value)}
          style={{ width: "100%", padding: "11px 16px", fontSize: 13 }} />
        {query && (
          <button onClick={() => setQuery("")} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: 4,
          }}>✕</button>
        )}
      </div>

      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, alignItems: "end" }}>
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
          <div>
            <label className="form-label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => window.print()} className="btn btn-print" style={{ flex: 1 }}>🖨 Print</button>
            <button onClick={exportCSV} className="btn btn-primary" style={{ flex: 1 }} disabled={!filtered.length}>⬇ Excel</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 16 }}>
        <Stat label="Total" value={totals.total} color="#1a1a1a" bg="#fafaf6" />
        <Stat label="Days" value={totals.days} color="var(--primary)" bg="var(--primary-soft)" />
        <Stat label="Approved" value={totals.approved} color="var(--success)" bg="var(--success-bg)" />
        <Stat label="Pending" value={totals.pending} color="var(--warning)" bg="var(--warning-bg)" />
        <Stat label="Rejected" value={totals.rejected} color="var(--danger)" bg="var(--danger-bg)" />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div className="empty">Loading…</div>
          : filtered.length === 0 ? <div className="empty">No leave records match.</div>
          : (
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const e = empById.get(r.employeeId);
                const t = typeById.get(r.leaveTypeId);
                const s = STATUS[r.status as keyof typeof STATUS];
                return (
                  <tr key={r.id}>
                    <td>{new Date(r.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>{new Date(r.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td><strong>{r.days}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{e ? `${e.firstName} ${e.lastName}` : `#${r.employeeId}`}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{e?.employeeId}</div>
                    </td>
                    <td>
                      {t && <span className="badge" style={{ background: `${t.color || "#888"}22`, color: t.color || "#555" }}>{t.name}</span>}
                    </td>
                    <td>{s && <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>}</td>
                    <td style={{ color: "#666", maxWidth: 250 }}>{r.reason || "—"}</td>
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

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="card" style={{ background: bg, borderColor: `${color}33`, textAlign: "center", padding: "0.9rem 0.5rem" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}
