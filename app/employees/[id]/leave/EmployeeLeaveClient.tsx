"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePageState } from "@/lib/usePageState";
import Link from "next/link";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { matchesQuery, cmpText } from "@/lib/listTools";

type LeaveSort = "recent" | "startNew" | "startOld" | "days" | "type" | "status";
const SORT_OPTIONS: SortOption<LeaveSort>[] = [
  { value: "recent", label: "Latest requested" },
  { value: "startNew", label: "Start date (newest)" },
  { value: "startOld", label: "Start date (oldest)" },
  { value: "days", label: "Days (most first)" },
  { value: "type", label: "Leave type" },
  { value: "status", label: "Status" },
];

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

export default function EmployeeLeaveClient({ employee, leaveTypes, backHref }: { employee: Emp; leaveTypes: LT[]; backHref: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = usePageState("from", yearAgo);
  const [to, setTo] = usePageState("to", today);
  const [query, setQuery] = usePageState("q", "");
  const [sort, setSort] = usePageState<LeaveSort>("sort", "recent");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);

  const typeById = new Map(leaveTypes.map(t => [t.id, t]));

  // Only the newest request may fill the list (a restored date range starts a second one straight away).
  const fetchSeq = useRef(0);
  const fetchRows = useCallback(async () => {
    const mine = ++fetchSeq.current;
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, employeeId: String(employee.id) });
      const res = await fetch(`/api/leave/requests?${p}`);
      const data = await res.json();
      if (mine === fetchSeq.current) setRows(Array.isArray(data) ? data : []);
    } finally { if (mine === fetchSeq.current) setLoading(false); }
  }, [from, to, employee.id]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Per-type breakdown (approved + pending only — rejected don't count)
  const usageByType = leaveTypes.map(t => {
    const approved = rows.filter(r => r.leaveTypeId === t.id && r.status === "approved").reduce((s, r) => s + r.days, 0);
    const pending  = rows.filter(r => r.leaveTypeId === t.id && r.status === "pending").reduce((s, r) => s + r.days, 0);
    return { type: t, approved, pending, remaining: Math.max(0, t.daysAllowed - approved) };
  });

  // "recent" is the order the server sends; the rest re-order it. The search narrows the list.
  const shown = (() => {
    const cmp: Record<LeaveSort, (a: Req, b: Req) => number> = {
      recent: () => 0,
      startNew: (a, b) => b.startDate.localeCompare(a.startDate),
      startOld: (a, b) => a.startDate.localeCompare(b.startDate),
      days: (a, b) => b.days - a.days || b.startDate.localeCompare(a.startDate),
      type: (a, b) => cmpText(typeById.get(a.leaveTypeId)?.name, typeById.get(b.leaveTypeId)?.name) || b.startDate.localeCompare(a.startDate),
      status: (a, b) => cmpText(a.status, b.status) || b.startDate.localeCompare(a.startDate),
    };
    return rows
      .filter(r => matchesQuery(query, [typeById.get(r.leaveTypeId)?.name, r.status, r.reason, r.decidedBy, r.startDate, r.endDate]))
      .sort(cmp[sort]);
  })();

  const totals = {
    total: shown.length,
    days: shown.filter(r => r.status === "approved").reduce((s, r) => s + r.days, 0),
    pending: shown.filter(r => r.status === "pending").length,
    approved: shown.filter(r => r.status === "approved").length,
    rejected: shown.filter(r => r.status === "rejected").length,
  };

  const exportCSV = () => {
    downloadCSV(`leave-${employee.employeeId}-${from}_to_${to}`,
      ["From", "To", "Days", "Type", "Status", "Reason", "Decided By"],
      shown.map(r => {
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
      <PrintHeader
        title="Leave History"
        subtitle={`${employee.firstName} ${employee.lastName} (${employee.employeeId})`}
        meta={`Period: ${new Date(from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}${query.trim() ? ` · Search: ${query.trim()}` : ""}`}
      />
      {/* One row: the counts first, then search and sort, the date range; Back, Print and Excel stay together at the right. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          <Stat label="Requests" value={totals.total} color="#1a1a1a" bg="#fafaf6" />
          <Stat label="Days Taken" value={totals.days} color="var(--primary)" bg="var(--primary-soft)" />
          <Stat label="Approved" value={totals.approved} color="var(--success)" bg="var(--success-bg)" />
          <Stat label="Pending" value={totals.pending} color="var(--warning)" bg="var(--warning-bg)" />
          <Stat label="Rejected" value={totals.rejected} color="var(--danger)" bg="var(--danger-bg)" />
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox value={query} onChange={setQuery} placeholder="🔍  Search type, status, reason…" width={210} />
          <SortBy options={SORT_OPTIONS} value={sort} onChange={setSort} minWidth={165} />
        </div>
        <div className="no-print" style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={LBL}>From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 138 }} />
          <span style={LBL}>To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 138 }} />
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexShrink: 0 }}>
          <Link href={backHref} className="btn btn-back">← Back to Profile</Link>
          <button onClick={() => window.print()} className="btn btn-print">🖨 Print</button>
          <button onClick={exportCSV} className="btn btn-primary" disabled={!shown.length}>⬇ Excel</button>
        </div>
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

      <div className="card" style={{ padding: 0, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {loading ? <div className="empty">Loading…</div>
          : shown.length === 0 ? <div className="empty">{rows.length === 0 ? "No leave records in this range." : "No leave records match."}</div>
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
              {shown.map(r => {
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

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text2)", letterSpacing: 0.4, textTransform: "uppercase" };

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 9px", borderRadius: 8, background: bg, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10.5, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}
