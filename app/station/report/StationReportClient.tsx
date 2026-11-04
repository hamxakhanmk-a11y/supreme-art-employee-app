"use client";
import { useMemo, useState } from "react";
import { usePageState } from "@/lib/usePageState";
import { useRouter } from "next/navigation";
import { useCanEdit } from "@/components/MeProvider";
import { LEAVE_STYLE, hhmm, formatMins, type LeaveType } from "@/lib/station";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import Link from "next/link";
import StatChip from "../StatChip";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { matchesQuery, cmpText } from "@/lib/listTools";

// ISO timestamp → "HH:MM" (24h) wall-clock in Karachi, for the time inputs.
function toKarachiHM(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi",
  });
}

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

type TripSort = "latest" | "oldest" | "name" | "empId" | "longest" | "type" | "open";
const TRIP_SORT_OPTIONS: SortOption<TripSort>[] = [
  { value: "latest", label: "Latest check-out" },
  { value: "oldest", label: "Oldest check-out" },
  { value: "name", label: "Employee (A–Z)" },
  { value: "empId", label: "Employee ID" },
  { value: "longest", label: "Duration (longest)" },
  { value: "type", label: "Type" },
  { value: "open", label: "Still out first" },
];

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function StationReportClient({
  trips, from, to, tab, terminalLink = false,
}: {
  trips: Trip[]; from: string; to: string;
  /** Standalone page (Reports → Station): the way back to the terminal sits with Print and Excel. */
  terminalLink?: boolean;
  /** Kept in the address when the dates are applied, so the page stays on this view. */
  tab?: string;
}) {
  const router = useRouter();
  const canEditStation = useCanEdit("station");
  const canDeleteStation = useCanEdit("station.delete");
  const [empFilter, setEmpFilter] = usePageState("trips.employee", "");
  const [typeFilter, setTypeFilter] = usePageState<"all" | LeaveType>("trips.type", "all");
  const [sort, setSort] = usePageState<TripSort>("trips.sort", "latest");

  // Inline edit of one trip's times / type / reason.
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [eDate, setEDate] = useState("");
  const [eOut, setEOut] = useState("");
  const [eIn, setEIn] = useState("");
  const [eType, setEType] = useState<LeaveType>("personal");
  const [eReason, setEReason] = useState("");

  function startEdit(t: Trip) {
    setErr("");
    setEditId(t.id);
    setEDate(t.date);
    setEOut(toKarachiHM(t.outAt));
    setEIn(toKarachiHM(t.inAt));
    setEType((t.type as LeaveType) === "official" ? "official" : "personal");
    setEReason(t.reason || "");
  }
  async function saveEdit() {
    if (!eDate || !eOut) { setErr("Date and check-out time are required."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/station/trips/${editId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: eDate, outTime: eOut, inTime: eIn, type: eType, reason: eReason }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setEditId(null); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function del(t: Trip) {
    if (!confirm(`Delete this trip for ${t.name} on ${fmtDate(t.date)}?`)) return;
    const res = await fetch(`/api/station/trips/${t.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else { const j = await res.json().catch(() => ({})); alert(j.error || "Delete failed"); }
  }
  const showActions = canEditStation || canDeleteStation;

  const rows = useMemo(() => {
    const found = trips.filter(t => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      return matchesQuery(empFilter, [t.name, t.empCode, `${t.name} ${t.empCode}`, t.department, t.reason]);
    });
    // "latest" is the order the server sends (latest check-out first); the rest re-order a copy.
    const cmp: Record<TripSort, (a: Trip, b: Trip) => number> = {
      latest: () => 0,
      oldest: (a, b) => a.outAt.localeCompare(b.outAt),
      name: (a, b) => cmpText(a.name, b.name) || b.outAt.localeCompare(a.outAt),
      empId: (a, b) => cmpText(a.empCode, b.empCode) || b.outAt.localeCompare(a.outAt),
      longest: (a, b) => (b.minutes ?? 0) - (a.minutes ?? 0),
      type: (a, b) => cmpText(a.type, b.type) || b.outAt.localeCompare(a.outAt),
      open: (a, b) => Number(b.inAt === null) - Number(a.inAt === null),
    };
    return sort === "latest" ? found : [...found].sort(cmp[sort]);
  }, [trips, empFilter, typeFilter, sort]);

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
      {/* One block of controls (each group wraps as a whole): the counts first, then search and sort, the
          range, the type, and at the right the way to the terminal, Print and Excel together. */}
      <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <StatChip label="Trips" value={rows.length} />
          <StatChip label="Personal" value={formatMins(totPersonal)} color={LEAVE_STYLE.personal.color} bg={LEAVE_STYLE.personal.bg} />
          <StatChip label="Official" value={formatMins(totOfficial)} color={LEAVE_STYLE.official.color} bg={LEAVE_STYLE.official.bg} />
          {openCount > 0 && <StatChip label="Still out" value={openCount} color="var(--danger)" bg="var(--danger-bg)" />}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox value={empFilter} onChange={setEmpFilter} placeholder="🔍  Search name, ID, reason…" width={210} />
          <SortBy options={TRIP_SORT_OPTIONS} value={sort} onChange={setSort} minWidth={165} />
        </div>
        <form method="GET" style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, fontSize: 13, color: "var(--text2)" }}>
          {tab && <input type="hidden" name="tab" value={tab} />}
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>From</span>
          <input type="date" name="from" defaultValue={from} style={{ width: 138 }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>To</span>
          <input type="date" name="to" defaultValue={to} style={{ width: 138 }} />
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
        </form>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as "all" | LeaveType)} title="Type" style={{ width: 140 }}>
            <option value="all">All types</option>
            <option value="personal">Personal only</option>
            <option value="official">Official only</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexShrink: 0 }}>
          {terminalLink && <Link href="/station" className="btn">🏭 Terminal</Link>}
          <button onClick={() => window.print()} className="btn btn-print">🖨 Print</button>
          <button onClick={exportXlsx} className="btn btn-primary" disabled={rows.length === 0}>⬇ Excel</button>
        </div>
      </div>

      {err && <div className="no-print" style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 8 }}>{err}</div>}

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
              {showActions && <th className="no-print" style={{ textAlign: "right" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={showActions ? 9 : 8} style={{ textAlign: "center", padding: 24, color: "var(--text3)", fontSize: 13 }}>
                No hourly leaves in this range.
              </td></tr>
            ) : rows.map(r => {
              const st = LEAVE_STYLE[r.type as LeaveType];
              const editing = editId === r.id;
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.empCode}</div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{r.department || "—"}</td>
                  {editing ? (
                    <>
                      <td style={{ textAlign: "center" }}><input type="date" value={eDate} onChange={e => setEDate(e.target.value)} style={{ width: 140 }} /></td>
                      <td style={{ textAlign: "center" }}><input type="time" value={eOut} onChange={e => setEOut(e.target.value)} style={{ width: 110 }} /></td>
                      <td style={{ textAlign: "center" }}><input type="time" value={eIn} onChange={e => setEIn(e.target.value)} style={{ width: 110 }} /></td>
                      <td className="num" style={{ color: "var(--text3)", fontSize: 11 }}>auto</td>
                      <td style={{ textAlign: "center" }}>
                        <select value={eType} onChange={e => setEType(e.target.value as LeaveType)}>
                          <option value="personal">Personal</option>
                          <option value="official">Official</option>
                        </select>
                      </td>
                      <td><input value={eReason} onChange={e => setEReason(e.target.value)} placeholder="Reason" style={{ width: "100%", minWidth: 140 }} /></td>
                      {showActions && (
                        <td className="no-print" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={saveEdit} disabled={busy} className="btn btn-primary btn-sm" style={{ marginRight: 6 }}>{busy ? "…" : "Save"}</button>
                          <button onClick={() => setEditId(null)} className="btn btn-sm">Cancel</button>
                        </td>
                      )}
                    </>
                  ) : (
                    <>
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
                      {showActions && (
                        <td className="no-print" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {canEditStation && <button onClick={() => startEdit(r)} className="btn btn-sm" style={{ marginRight: 6 }}>Edit</button>}
                          {canDeleteStation && <button onClick={() => del(r)} className="btn btn-sm btn-restricted">Delete</button>}
                        </td>
                      )}
                    </>
                  )}
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
