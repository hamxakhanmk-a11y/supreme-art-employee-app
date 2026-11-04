"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePageState } from "@/lib/usePageState";
import Link from "next/link";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";
import { lateMinutes, formatLate } from "@/lib/attendance";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { matchesQuery, cmpText } from "@/lib/listTools";

type AttSort = "newest" | "oldest" | "status" | "checkIn";
const SORT_OPTIONS: SortOption<AttSort>[] = [
  { value: "newest", label: "Date (newest)" },
  { value: "oldest", label: "Date (oldest)" },
  { value: "status", label: "Status" },
  { value: "checkIn", label: "Check-in (latest)" },
];

type Emp = { id: number; employeeId: string; firstName: string; lastName: string };
type Row = { id: number; date: string; status: string; checkIn: string | null; checkOut: string | null; notes: string | null };

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  present:    { label: "Present",  color: "#15803D", bg: "#e3f5e3" },
  absent:     { label: "Absent",   color: "#DC2626", bg: "#fde2e2" },
  leave:      { label: "Leave",    color: "#D97706", bg: "#fdebd0" },
  "half-day": { label: "Half-day", color: "#1D4ED8", bg: "#dfe8fc" },
  late:       { label: "Late",     color: "#EA580C", bg: "#fde2cf" },
};

export default function EmployeeAttendanceClient({ employee, backHref }: { employee: Emp; backHref: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = usePageState("from", yearAgo);
  const [to, setTo] = usePageState("to", today);
  const [query, setQuery] = usePageState("q", "");
  const [sort, setSort] = usePageState<AttSort>("sort", "newest");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // Only the newest request may fill the list (a restored date range starts a second one straight away).
  const fetchSeq = useRef(0);
  const fetchRows = useCallback(async () => {
    const mine = ++fetchSeq.current;
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, employeeId: String(employee.id) });
      const res = await fetch(`/api/attendance?${p}`);
      const data = await res.json();
      if (mine === fetchSeq.current) setRows(Array.isArray(data) ? data : []);
    } finally { if (mine === fetchSeq.current) setLoading(false); }
  }, [from, to, employee.id]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Newest date first is the default; the sort dropdown re-orders it, the search narrows it.
  const sorted = (() => {
    const byDateDesc = (a: Row, b: Row) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    const cmp: Record<AttSort, (a: Row, b: Row) => number> = {
      newest: byDateDesc,
      oldest: (a, b) => -byDateDesc(a, b),
      status: (a, b) => cmpText(a.status, b.status) || byDateDesc(a, b),
      checkIn: (a, b) => cmpText(b.checkIn, a.checkIn) || byDateDesc(a, b),
    };
    return rows
      .filter(r => matchesQuery(query, [
        r.date, new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
        STATUS_LABEL[r.status]?.label, r.status, r.checkIn, r.checkOut, r.notes,
      ]))
      .sort(cmp[sort]);
  })();

  const totals = {
    present: sorted.filter(r => r.status === "present").length,
    absent:  sorted.filter(r => r.status === "absent").length,
    leave:   sorted.filter(r => r.status === "leave").length,
    halfday: sorted.filter(r => r.status === "half-day").length,
    late:    sorted.filter(r => lateMinutes(r.checkIn) > 0).length,
  };

  const exportCSV = () => {
    downloadCSV(`attendance-${employee.employeeId}-${from}_to_${to}`,
      ["Date", "Status", "Check-in", "Late by", "Check-out", "Notes"],
      sorted.map(r => [
        r.date,
        STATUS_LABEL[r.status]?.label || r.status,
        r.checkIn || "", formatLate(lateMinutes(r.checkIn)), r.checkOut || "", r.notes || "",
      ])
    );
  };

  return (
    <>
      <PrintHeader
        title="Attendance History"
        subtitle={`${employee.firstName} ${employee.lastName} (${employee.employeeId})`}
        meta={`Period: ${new Date(from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}${query.trim() ? ` · Search: ${query.trim()}` : ""}`}
      />
      {/* One row: the counts first, then search and sort, the date range; Back, Print and Excel stay together at the right. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <Stat key={k} label={v.label} value={totals[k === "half-day" ? "halfday" : k as keyof typeof totals] ?? 0} color={v.color} bg={v.bg} />
          ))}
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox value={query} onChange={setQuery} placeholder="🔍  Search date, status, notes…" width={210} />
          <SortBy options={SORT_OPTIONS} value={sort} onChange={setSort} minWidth={150} />
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
          <button onClick={exportCSV} className="btn btn-primary" disabled={!sorted.length}>⬇ Excel</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
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
                const late = lateMinutes(r.checkIn);
                return (
                  <tr key={r.id}>
                    <td>{new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>{s ? <span style={{ display: "inline-block", padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 999, letterSpacing: 0.3, background: s.color, color: "#fff", boxShadow: `0 1px 3px ${s.color}55` }}>{s.label}</span> : r.status}</td>
                    <td>
                      {r.checkIn || "—"}
                      {late > 0 && <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, marginTop: 2 }}>Late {formatLate(late)}</div>}
                    </td>
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

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text2)", letterSpacing: 0.4, textTransform: "uppercase" };

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 9px", borderRadius: 8, background: bg, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10.5, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}
