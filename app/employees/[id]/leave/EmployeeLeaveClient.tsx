"use client";
import { useState, useEffect, useCallback } from "react";
import { downloadCSV } from "@/lib/csv";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string };
type LT = { id: number; name: string; color: string | null; daysAllowed: number };
type Req = {
  id: number; leaveTypeId: number;
  startDate: string; endDate: string; days: number;
  reason: string | null; status: string;
  decidedBy: string | null;
};

const STATUS = {
  pending:  { label: "Pending",  color: "var(--warning)", bg: "var(--warning-bg)" },
  approved: { label: "Approved", color: "var(--success)", bg: "var(--success-bg)" },
  rejected: { label: "Rejected", color: "var(--danger)",  bg: "var(--danger-bg)"  },
};

export default function EmployeeLeaveClient({ employee, leaveTypes }: { employee: Emp; leaveTypes: LT[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);

  const typeById = new Map(leaveTypes.map(t => [t.id, t]));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, employeeId: String(employee.id) });
      const res = await fetch(`/api/leave/requests?${p}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [from, to, employee.id]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Per-type breakdown (approved + pending only — rejected don't count)
  const usageByType = leaveTypes.map(t => {
    const approved = rows.filter(r => r.leaveTypeId === t.id && r.status === "approved").reduce((s, r) => s + r.days, 0);
    const pending  = rows.filter(r => r.leaveTypeId === t.id && r.status === "pending").reduce((s, r) => s + r.days, 0);
    return { type: t, approved, pending, remaining: Math.max(0, t.daysAllowed - approved) };
  });

  const totals = {
    total: rows.length,
    days: rows.filter(r => r.status === "approved").reduce((s, r) => s + r.days, 0),
    pending: rows.filter(r => r.status === "pending").length,
    approved: rows.filter(r => r.status === "approved").length,
    rejected: rows.filter(r => r.status === "rejected").length,
  };

  const exportCSV = () => {
    downloadCSV(`leave-${employee.employeeId}-${from}_to_${to}`,
      ["From", "To", "Days", "Type", "Status", "Reason", "Decided By"],
      rows.map(r => {
        const t = typeById.get(r.leaveTypeId);
        return [
          r.startDate, r.endDate, r.days, t?.name || "",
          STATUS[r.status as keyof typeof STATUS]?.label || r.status,
          r.reason || "", r.decidedBy || "",
        ];
      })
    );
  };

  return (
    <>
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
            <button onClick={exportCSV} className="btn btn-primary" style={{ flex: 1 }} disabled={!rows.length}>⬇ Excel</button>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 16 }}>
        <Stat label="Requests" value={totals.total} color="#1a1a1a" bg="#fafaf6" />
        <Stat label="Days Taken" value={totals.days} color="var(--primary)" bg="var(--primary-soft)" />
        <Stat label="Approved" value={totals.approved} color="var(--success)" bg="var(--success-bg)" />
        <Stat label="Pending" value={totals.pending} color="var(--warning)" bg="var(--warning-bg)" />
        <Stat label="Rejected" value={totals.rejected} color="var(--danger)" bg="var(--danger-bg)" />
      </div>

      {/* Per-type balance */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Leave Balance by Type</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {usageByType.map(({ type, approved, pending, remaining }) => {
            const pct = type.daysAllowed > 0 ? Math.min(100, (approved / type.daysAllowed) * 100) : 0;
            return (
              <div key={type.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "#fafaf6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: type.color || "#1a1a1a" }}>{type.name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{type.daysAllowed} allowed</div>
                </div>
                <div style={{ height: 8, background: "#eee", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: type.color || "var(--primary)" }} />
                </div>
                <div style={{ fontSize: 11, color: "#555", display: "flex", justifyContent: "space-between" }}>
                  <span>Used: <strong>{approved}</strong>{pending > 0 && <span style={{ color: "var(--warning)" }}> · pending {pending}</span>}</span>
                  <span>Left: <strong style={{ color: "var(--success)" }}>{remaining}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div className="empty">Loading…</div>
          : rows.length === 0 ? <div className="empty">No leave records in this range.</div>
          : (
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const t = typeById.get(r.leaveTypeId);
                const s = STATUS[r.status as keyof typeof STATUS];
                return (
                  <tr key={r.id}>
                    <td>{new Date(r.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>{new Date(r.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td><strong>{r.days}</strong></td>
                    <td>{t && <span className="badge" style={{ background: `${t.color || "#888"}22`, color: t.color || "#555" }}>{t.name}</span>}</td>
                    <td>{s && <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>}</td>
                    <td style={{ color: "#666" }}>{r.reason || "—"}</td>
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
