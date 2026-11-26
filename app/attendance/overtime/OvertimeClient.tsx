"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCanEdit, ViewOnlyNotice } from "@/components/MeProvider";
import { sortEmployees, SHIFT_END } from "@/lib/attendance";
import { OVERTIME_STEP_MINUTES, overtimeHours } from "@/lib/deviceAttendance";
import type { DeviceDayRow } from "@/app/api/attendance/device-day/route";

function hm(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

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

  // Overtime from the fingerprint device: minutes inside after the shift end,
  // by employee. Optional; the page works without it.
  const [device, setDevice] = useState<{ date: string; minutes: Map<number, number>; night: Set<number> } | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch(`/api/attendance/device-day?date=${date}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((j: { rows: DeviceDayRow[] } | null) => {
        if (cancel || !j) return;
        const minutes = new Map<number, number>();
        const night = new Set<number>();
        for (const r of j.rows) {
          if (r.employeeId === null) continue;
          minutes.set(r.employeeId, r.overtimeMinutes);
          if (r.nightShift) night.add(r.employeeId);
        }
        setDevice({ date, minutes, night });
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [date]);
  const deviceMin = (id: number) => (device?.date === date ? device.minutes.get(id) : undefined);
  const deviceNight = (id: number) => device?.date === date && device.night.has(id);
  const deviceFillable = activeEmps.filter(e => overtimeHours(deviceMin(e.id) ?? 0) > 0);

  function fillFromDevice() {
    setEntries(p => {
      const next = { ...p };
      for (const e of deviceFillable) next[e.id] = String(overtimeHours(deviceMin(e.id) ?? 0));
      return next;
    });
    setMsg(`Filled ${deviceFillable.length} from the device. Check, then Save.`);
  }

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
          <Link href="/attendance" className="btn btn-back">← Mark Today</Link>
        </div>
      </div>

      {!canEdit && <ViewOnlyNotice />}

      {canEdit && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Record overtime for</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
            <button onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? "Saving…" : "Save"}</button>
            {deviceFillable.length > 0 && (
              <button onClick={fillFromDevice} className="btn btn-sm"
                title={`Time inside after ${SHIFT_END} from the fingerprint device, rounded down to ${OVERTIME_STEP_MINUTES} minutes`}>
                ☝ Fill from device ({deviceFillable.length})
              </button>
            )}
            {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.includes("✓") ? "#166534" : "#7C1F1F" }}>{msg}</span>}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: "var(--text2)" }}>Day total: <b>{dayTotal || 0}</b> hrs</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 10 }}>
            Enter hours (e.g. 2 or 1.5). Blank / 0 = none. &quot;Device&quot; is time inside after {SHIFT_END} from the fingerprint
            device (all of it on Sunday), not counting time out on a break. Fill from device rounds it down to the half hour.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
            {activeEmps.map(e => (
              <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.firstName} {e.lastName} <span style={{ color: "var(--text3)" }}>· {e.employeeId}</span>
                  {(deviceMin(e.id) ?? 0) > 0 && (
                    <span style={{ display: "block", fontSize: 11, color: "var(--brand)" }}>Device {hm(deviceMin(e.id)!)}</span>
                  )}
                  {deviceNight(e.id) && (
                    <span style={{ display: "block", fontSize: 11, color: "#B45309" }}>Night shift: enter by hand</span>
                  )}
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
