"use client";
import { useCallback, useEffect, useState } from "react";

// The drivers pool: who may drive anything. Set once here rather than repeated
// on every vehicle, because most yards work that way — whoever is free takes
// whatever is free. A vehicle can still name extra drivers of its own.

type Driver = { id: number; employeeId: string; firstName: string; lastName: string };
type Entry = { employeeId: number | null; name: string };

export default function DriverPoolPanel({
  staff, onClose, onSaved,
}: {
  staff: Driver[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/drivers", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load the drivers");
      setEntries(j.map((d: any) => ({ employeeId: d.employeeId, name: d.name })));
      setErr("");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const has = (id: number) => entries.some(e => e.employeeId === id);
  const toggle = (id: number) =>
    setEntries(list => has(id) ? list.filter(e => e.employeeId !== id) : [...list, { employeeId: id, name: "" }]);

  const addManual = () => {
    const name = manual.trim();
    if (!name) return;
    if (!entries.some(e => !e.employeeId && e.name.toLowerCase() === name.toLowerCase())) {
      setEntries(list => [...list, { employeeId: null, name }]);
    }
    setManual("");
  };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/drivers", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drivers: entries }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const manualOnes = entries.filter(e => !e.employeeId);

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid var(--brand)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>🧍 Drivers</h2>
      <p style={{ fontSize: 12, color: "var(--text3)", margin: "0 0 12px" }}>
        These names are offered at the gate for <strong>every</strong> vehicle. Set them once here; a vehicle only needs
        its own list for someone who drives that one and nothing else.
      </p>

      {err && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {loading ? (
        <div style={{ color: "var(--text3)", fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto",
            border: "1px solid var(--border)", borderRadius: 8, padding: 8,
          }}>
            {staff.map(d => {
              const on = has(d.id);
              return (
                <button key={d.id} type="button" onClick={() => toggle(d.id)}
                  style={{
                    border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`, borderRadius: 999,
                    padding: "5px 12px", fontSize: 12.5, cursor: "pointer",
                    background: on ? "var(--brand)" : "var(--bg)", color: on ? "#fff" : "var(--text2)",
                    fontWeight: on ? 700 : 500,
                  }}>
                  {on ? "✓ " : ""}{d.employeeId} — {d.firstName} {d.lastName}
                </button>
              );
            })}
          </div>

          {manualOnes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {manualOnes.map(e => (
                <span key={e.name} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700,
                  background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
                  borderRadius: 999, padding: "5px 6px 5px 11px",
                }}>
                  {e.name}
                  <button type="button" onClick={() => setEntries(l => l.filter(x => x.employeeId !== null || x.name !== e.name))}
                    style={{ border: "none", background: "transparent", color: "#A32D2D", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 3px" }}
                    title="Remove">×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={manual}
              onChange={e => setManual(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }}
              placeholder="Someone not on the staff list — e.g. Rashid (hired driver)"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn" onClick={addManual} disabled={!manual.trim()}>+ Add</button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save drivers"}
            </button>
            <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              {entries.length} {entries.length === 1 ? "driver" : "drivers"} — on every vehicle
            </span>
          </div>
        </>
      )}
    </div>
  );
}
