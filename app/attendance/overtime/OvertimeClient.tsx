"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCanEdit, ViewOnlyNotice } from "@/components/MeProvider";
import { sortEmployees, SORT_OPTIONS, type SortKey } from "@/lib/attendance";
import { SearchBox, SortBy } from "@/components/ListControls";
import { empMatches } from "@/lib/listTools";

type Emp = {
  id: number; employeeId: string; firstName: string; lastName: string;
  department: string | null; status: string; createdAt: string | Date | null;
};

export default function OvertimeClient({ employees }: { employees: Emp[] }) {
  const canEdit = useCanEdit("attendance");

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("id");

  const activeEmps = useMemo(() => sortEmployees(employees.filter(e => e.status === "active"), "id"), [employees]);

  // What the grid shows. Saving and the day total still use every active employee, so a search never drops an entry.
  const shownEmps = useMemo(() => sortEmployees(activeEmps.filter(e => empMatches(query, e)), sort), [activeEmps, query, sort]);

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
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  const dayTotal = useMemo(
    () => Math.round(activeEmps.reduce((s, e) => s + (Number(entries[e.id]) || 0), 0) * 100) / 100,
    [activeEmps, entries],
  );

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {canEdit && (
          <>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Record overtime for</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
            <button onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? "Saving…" : "Save"}</button>
            {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.includes("✓") ? "#166534" : "#7C1F1F" }}>{msg}</span>}
          </>
        )}
        <div style={{ flex: 1 }} />
        {canEdit && <span style={{ fontSize: 12.5, color: "var(--text2)" }}>Day total: <b>{dayTotal || 0}</b> hrs</span>}
        <Link href="/reports/overtime" className="btn">📊 Overtime Report</Link>
        <Link href="/attendance" className="btn btn-back">← Mark Today</Link>
      </div>

      {!canEdit && <ViewOnlyNotice />}

      {canEdit && (
        <div className="card" style={{ padding: 12 }}>
          <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <SearchBox block value={query} onChange={setQuery} placeholder="🔍  Search by name, ID, department…" />
            <SortBy options={SORT_OPTIONS} value={sort} onChange={setSort} />
          </div>
          {shownEmps.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13, padding: "8px 0" }}>No employee matches “{query}”.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
            {shownEmps.map(e => (
              <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.firstName} {e.lastName} <span style={{ color: "var(--text3)" }}>· {e.employeeId}</span>
                </span>
                <input type="number" min={0} step={0.5} inputMode="decimal" title="Hours, e.g. 2 or 1.5 — blank or 0 is none"
                  value={entries[e.id] ?? ""} onChange={ev => setEntries(p => ({ ...p, [e.id]: ev.target.value }))}
                  style={{ width: 66, textAlign: "right" }} placeholder="0" />
                <span style={{ fontSize: 11, color: "var(--text3)" }}>hrs</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
