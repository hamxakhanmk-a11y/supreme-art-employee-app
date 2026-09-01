"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCanEdit, ViewOnlyNotice } from "@/components/MeProvider";
import { sortEmployees } from "@/lib/attendance";

type Emp = {
  id: number; employeeId: string; firstName: string; lastName: string;
  department: string | null; status: string; createdAt: string | Date | null;
};
type Rec = { employeeId: number; date: string; hours: number };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Trim a decimal for display: 2 → "2", 2.5 → "2.5", 0 → "".
function fmtHrs(h: number): string {
  if (!h) return "";
  return String(Math.round(h * 100) / 100);
}

export default function OvertimeClient({ year, month, daysInMonth, employees, records }: {
  year: number; month: number; daysInMonth: number; employees: Emp[]; records: Rec[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const canEdit = useCanEdit("attendance");

  // ---- Record section ----
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const activeEmps = useMemo(() => sortEmployees(employees.filter(e => e.status === "active"), "id"), [employees]);

  // Load whatever's already recorded for the chosen date.
  useEffect(() => {
    let cancel = false;
    fetch(`/api/attendance/overtime?date=${date}`)
      .then(r => r.json())
      .then(j => {
        if (cancel) return;
        const map = j.entries || {};
        const next: Record<number, string> = {};
        for (const e of activeEmps) { const h = map[e.id]; next[e.id] = h ? String(h) : ""; }
        setEntries(next);
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [date, activeEmps]);

  async function save() {
    setBusy(true); setMsg("");
    try {
      const payload = activeEmps.map(e => ({ employeeId: e.id, hours: Number(entries[e.id]) || 0 }));
      const res = await fetch("/api/attendance/overtime", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, entries: payload }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setMsg("Saved ✓");
      setTimeout(() => setMsg(""), 2500);
      router.refresh(); // refresh the monthly grid below
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  // ---- Monthly grid ----
  const byKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records) {
      const day = parseInt(r.date.slice(8, 10), 10);
      m.set(`${r.employeeId}-${day}`, (m.get(`${r.employeeId}-${day}`) || 0) + (r.hours || 0));
    }
    return m;
  }, [records]);

  const empIdsWithOt = useMemo(() => new Set(records.filter(r => r.hours > 0).map(r => r.employeeId)), [records]);
  const gridEmps = useMemo(
    () => sortEmployees(employees.filter(e => e.status === "active" || empIdsWithOt.has(e.id)), "id"),
    [employees, empIdsWithOt],
  );

  const rowTotal = (empId: number) => {
    let t = 0;
    for (let d = 1; d <= daysInMonth; d++) t += byKey.get(`${empId}-${d}`) || 0;
    return Math.round(t * 100) / 100;
  };
  const dayTotal = (day: number) => {
    let t = 0;
    for (const e of gridEmps) t += byKey.get(`${e.id}-${day}`) || 0;
    return Math.round(t * 100) / 100;
  };
  const grandTotal = Math.round(gridEmps.reduce((s, e) => s + rowTotal(e.id), 0) * 100) / 100;

  const isSunday = (day: number) => new Date(year, month - 1, day).getDay() === 0;
  const dow = (day: number) => ["S", "M", "T", "W", "T", "F", "S"][new Date(year, month - 1, day).getDay()];
  const changeMonth = (delta: number) => {
    let y = year, m = month + delta;
    if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
    router.push(`${pathname}?year=${y}&month=${m}`);
  };

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Overtime</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Record each employee&apos;s daily overtime hours; the monthly grid is below.</p>
        </div>
        <Link href="/attendance" className="btn">← Mark Today</Link>
      </div>

      {!canEdit && <ViewOnlyNotice />}

      {/* ── Record daily overtime ── */}
      {canEdit && (
        <div className="card no-print" style={{ marginBottom: 22, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Record overtime for</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
            <button onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? "Saving…" : "Save"}</button>
            {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.includes("✓") ? "#166534" : "#7C1F1F" }}>{msg}</span>}
            <span style={{ fontSize: 11.5, color: "var(--text3)" }}>Hours (e.g. 2 or 1.5). Blank / 0 = none.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
            {activeEmps.map(e => (
              <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.firstName} {e.lastName} <span style={{ color: "var(--text3)" }}>· {e.employeeId}</span>
                </span>
                <input type="number" min={0} step={0.5} inputMode="decimal"
                  value={entries[e.id] ?? ""} onChange={ev => setEntries(p => ({ ...p, [e.id]: ev.target.value }))}
                  style={{ width: 66, textAlign: "right" }} placeholder="0" />
                <span style={{ fontSize: 11, color: "var(--text3)" }}>hrs</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly overtime grid ── */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="btn btn-sm" onClick={() => changeMonth(-1)}>← Prev</button>
        <strong style={{ fontSize: 15 }}>{MONTHS[month - 1]} {year}</strong>
        <button className="btn btn-sm" onClick={() => changeMonth(1)}>Next →</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm btn-print" onClick={() => window.print()}>🖨 Print</button>
      </div>

      <div className="card ot-wrap" style={{ padding: 0, overflow: "auto" }}>
        <table className="ot-table">
          <thead>
            <tr className="ot-banner">
              <th colSpan={2 + daysInMonth + 1} style={{ textAlign: "center", fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "#fff", background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)", padding: "10px 8px", textTransform: "uppercase" }}>
                🕒 Monthly Overtime — {MONTHS[month - 1]} {year} (hours)
              </th>
            </tr>
            <tr className="ot-head">
              <th className="fz fz1">Emp ID</th>
              <th className="fz fz2">Full Name</th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                <th key={d} className={`day-h ${isSunday(d) ? "day-sun" : ""}`}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{d}</div>
                  <div style={{ fontSize: 8, opacity: 0.6 }}>{dow(d)}</div>
                </th>
              ))}
              <th className="tot-h">Total</th>
            </tr>
          </thead>
          <tbody>
            {gridEmps.length === 0 && (
              <tr><td colSpan={2 + daysInMonth + 1} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No employees.</td></tr>
            )}
            {gridEmps.map(e => (
              <tr key={e.id}>
                <td className="emp-id fz fz1">{e.employeeId}</td>
                <td className="emp-name fz fz2">{e.firstName} {e.lastName}{e.status !== "active" && <span className="exited-tag">exited</span>}</td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                  const h = byKey.get(`${e.id}-${d}`) || 0;
                  return <td key={d} className={`day-c ${isSunday(d) ? "day-sun-c" : ""}`}>{fmtHrs(h)}</td>;
                })}
                <td className="tot-c">{rowTotal(e.id) || ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="ot-foot">
              <td className="fz fz1" /><td className="fz fz2" style={{ textAlign: "right", fontWeight: 700 }}>Daily total</td>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <td key={d} className="day-c" style={{ fontWeight: 700 }}>{fmtHrs(dayTotal(d))}</td>)}
              <td className="tot-c" style={{ fontWeight: 800 }}>{grandTotal || ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style jsx global>{`
        .ot-wrap { max-width: 100%; max-height: 78vh; }
        .ot-table { border-collapse: collapse; font-size: 11px; font-family: var(--font); background: var(--bg); width: max-content; min-width: 100%; }
        .ot-table th, .ot-table td { border: 1px solid var(--border); padding: 5px 6px; text-align: center; background: var(--bg); white-space: nowrap; }
        .ot-table thead th { background: var(--bg2); color: var(--text); font-weight: 700; font-size: 11px; }
        .ot-table .day-h { min-width: 30px; padding: 4px 2px; }
        .ot-table .day-h.day-sun { background: #e2e8f0; color: var(--brand-dark); }
        .ot-table .tot-h { background: #f3eee4; min-width: 48px; }
        .ot-table .day-c { width: 30px; min-width: 30px; padding: 4px 2px; font-variant-numeric: tabular-nums; }
        .ot-table .day-c.day-sun-c { background: #f1f5f9; }
        .ot-table .tot-c { font-weight: 700; background: #fdf8ee; font-variant-numeric: tabular-nums; }
        .ot-table .emp-id { font-weight: 700; color: var(--brand); text-align: left; padding-left: 10px; }
        .ot-table .emp-name { font-weight: 600; text-align: left; padding-left: 10px; }
        .ot-table .exited-tag { margin-left: 6px; font-size: 8.5px; font-weight: 700; color: #9A3412; background: #ffedd5; border-radius: 999px; padding: 1px 5px; }
        .ot-table .fz { position: sticky; z-index: 3; }
        .ot-table thead th.fz { z-index: 5; }
        .ot-table .fz1 { left: 0; width: 120px; min-width: 120px; max-width: 120px; }
        .ot-table .fz2 { left: 120px; box-shadow: 2px 0 0 var(--border); }
        .ot-table thead tr.ot-head th { position: sticky; top: 0; z-index: 4; }
        .ot-table thead tr.ot-head th.fz { z-index: 6; }
        .ot-table tbody tr:hover td { background: var(--bg2); }

        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          .no-print, header, nav { display: none !important; }
          main { max-width: none !important; width: 100% !important; padding: 0 !important; }
          .ot-wrap { overflow: visible !important; max-height: none !important; border: none !important; box-shadow: none !important; }
          .ot-banner { display: table-row !important; }
          .ot-table { font-size: 9px; width: 100%; }
          .ot-table th, .ot-table td { padding: 3px 2px; }
          .ot-table .fz { position: static; box-shadow: none; }
          .ot-table .fz1, .ot-table .fz2 { width: auto; min-width: 0; max-width: none; }
          .ot-table thead tr.ot-head th { position: static; }
          .ot-table thead { display: table-header-group; }
          .ot-table tbody tr { break-inside: avoid; }
          .ot-table .day-h, .ot-table .day-c { min-width: 0; width: auto; }
          .ot-table .day-sun, .ot-table .day-sun-c, .ot-table .tot-h, .ot-table .tot-c {
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
