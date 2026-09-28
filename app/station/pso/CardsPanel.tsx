"use client";
import { useCallback, useEffect, useState } from "react";

// The cards themselves, above the register they appear in: what the terminal
// hands out, and where a card is moved to another vehicle, blocked, or written
// off. Lives on the PSO Cards tab rather than a tab of its own.

type VehicleRow = { id: number; vehicleNo: string; name: string | null; active: boolean };
type Card = {
  id: number; sn: string; vehicleId: number | null; vehicleNo: string | null;
  status: string; notes: string;
  out: { driver: string; since: string } | null;
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  in_use:  { label: "In use",  color: "#15803D", bg: "#dcf5dc" },
  spare:   { label: "Spare",   color: "#185FA5", bg: "#e0f2fe" },
  blocked: { label: "Blocked", color: "#92400E", bg: "#FEF3C7" },
  lost:    { label: "Lost",    color: "#A32D2D", bg: "#fde2e2" },
};

const BLANK = { id: 0, sn: "", vehicleId: "" as number | "", status: "in_use", notes: "" };

export default function CardsPanel({ vehicles, readOnly, onChanged }: { vehicles: VehicleRow[]; readOnly: boolean; onChanged?: () => void }) {
  const [list, setList] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ ...BLANK });
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/cards", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load cards");
      setList(j); setErr("");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ ...BLANK }); setErr(""); setFormOpen(true); };
  const closeForm = () => { setForm({ ...BLANK }); setErr(""); setFormOpen(false); };

  const save = async () => {
    if (!form.sn.trim()) { setErr("Card SN is required"); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/cards", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vehicleId: form.vehicleId || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      closeForm();
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const edit = (c: Card) => {
    setErr(""); setFormOpen(true);
    setForm({ id: c.id, sn: c.sn, vehicleId: c.vehicleId ?? "", status: c.status, notes: c.notes || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (c: Card) => {
    if (!confirm(`Delete card ${c.sn}? Only a card with no entries behind it can go.`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/fleet/cards?id=${c.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not delete");
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="no-print" style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>💳 The cards</h2>
          <div style={{ color: "#888", marginTop: 2, fontSize: 12 }}>
            Which vehicle each belongs to, and whether it&apos;s in use, blocked or lost. Cards are handed out at the Station terminal.
          </div>
        </div>
        {!readOnly && !formOpen && <button className="btn btn-sm btn-primary" onClick={openAdd}>+ Add card</button>}
      </div>

      {err && <div className="card" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 14, fontSize: 13 }}>{err}</div>}

      {!readOnly && formOpen && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>{form.id ? `Edit card ${form.sn}` : "Add a card"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Card SN *
              <input value={form.sn} onChange={e => setForm({ ...form, sn: e.target.value })} placeholder="e.g. 2840018173" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Vehicle
              <select value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">— not assigned —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.vehicleNo}{v.active ? "" : " (retired)"}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", gridColumn: "1 / -1" }}>
              Notes
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. moved from JA-9370 on 11-Aug" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add card"}
            </button>
            <button className="btn" onClick={closeForm}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Card SN</th><th>Vehicle</th><th>Status</th><th>Where it is</th><th>Notes</th>
              {!readOnly && <th style={{ width: 140 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={readOnly ? 5 : 6} style={{ color: "var(--text3)", padding: 18 }}>Loading…</td></tr>}
            {!loading && list.length === 0 && (
              <tr><td colSpan={readOnly ? 5 : 6} style={{ color: "var(--text3)", padding: 18 }}>
                No cards yet{readOnly ? "." : " — use “+ Add card” above."}
              </td></tr>
            )}
            {list.map(c => {
              const st = STATUS[c.status] ?? { label: c.status, color: "var(--text2)", bg: "var(--bg2)" };
              return (
                <tr key={c.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.sn}</td>
                  <td>{c.vehicleNo || <span style={{ color: "var(--text3)" }}>not assigned</span>}</td>
                  <td>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700 }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.out
                      ? <span style={{ color: "#B45309", fontWeight: 600 }}>With {c.out.driver} since {c.out.since}</span>
                      : <span style={{ color: "var(--text3)" }}>In the drawer</span>}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{c.notes || "—"}</td>
                  {!readOnly && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" disabled={busy} onClick={() => edit(c)}>Edit</button>
                        <button className="btn btn-sm" style={{ color: "#A32D2D" }} disabled={busy} onClick={() => remove(c)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
