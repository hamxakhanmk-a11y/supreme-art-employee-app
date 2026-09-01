"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCanEdit, ViewOnlyNotice } from "@/components/MeProvider";
import { sortEmployees } from "@/lib/attendance";

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
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  const dayTotal = useMemo(
    () => Math.round(activeEmps.reduce((s, e) => s + (Number(entries[e.id]) || 0), 0) * 100) / 100,
    [activeEmps, entries],
  );

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Overtime</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Record each employee&apos;s overtime hours for a day.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/reports/overtime" className="btn">📊 Overtime Report</Link>
          <Link href="/attendance" className="btn">← Mark Today</Link>
        </div>
      </div>

      {!canEdit && <ViewOnlyNotice />}

      {canEdit && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Record overtime for</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
            <button onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? "Saving…" : "Save"}</button>
            {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.includes("✓") ? "#166534" : "#7C1F1F" }}>{msg}</span>}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: "var(--text2)" }}>Day total: <b>{dayTotal || 0}</b> hrs</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 10 }}>Enter hours (e.g. 2 or 1.5). Blank / 0 = none.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
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
    </div>
  );
}
