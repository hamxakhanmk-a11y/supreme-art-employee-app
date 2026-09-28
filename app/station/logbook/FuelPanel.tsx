"use client";
import { useState } from "react";
import type { LogBookFuel } from "@/lib/fleetServer";
import type { Person } from "../VehicleTripForms";

// P.O.L. for the month, recorded from the page it appears on — the vehicle and
// the month are already chosen here, and the average sits directly above.

const BLANK = { id: 0, date: "", litres: "", rate: "", meterReading: "", drawnById: "" as number | "", vendor: "", notes: "" };

export default function FuelPanel({
  vehicleId, month, fuel, people, readOnly, canDelete, onChanged,
}: {
  vehicleId: number; month: string; fuel: LogBookFuel[]; people: Person[];
  readOnly: boolean; canDelete: boolean; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK, date: `${month}-01` });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const amount = (() => {
    const l = Number(form.litres), r = Number(form.rate);
    return isFinite(l) && isFinite(r) && l > 0 && r > 0 ? Math.round(l * r * 100) / 100 : 0;
  })();

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/fuel", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vehicleId, drawnById: form.drawnById || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setForm({ ...BLANK, date: `${month}-01` });
      setOpen(false);
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (f: LogBookFuel) => {
    if (!confirm(`Delete the ${f.litres} L entry of ${f.date}?`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/fleet/fuel?id=${f.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not delete");
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const edit = (f: LogBookFuel) => {
    setErr("");
    setForm({
      id: f.id, date: f.date, litres: String(f.litres), rate: String(f.rate),
      meterReading: f.meterReading === null ? "" : String(f.meterReading),
      drawnById: "", vendor: f.vendor, notes: f.notes,
    });
    setOpen(true);
  };

  return (
    <div className="no-print" style={{ marginTop: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>⛽ P.O.L. drawn this month</h2>
        {!readOnly && (
          <button className="btn btn-sm" onClick={() => { setOpen(o => !o); setForm({ ...BLANK, date: `${month}-01` }); setErr(""); }}>
            {open ? "Cancel" : "+ Add fuel"}
          </button>
        )}
      </div>

      {err && <div className="card" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 10, fontSize: 13 }}>{err}</div>}

      {open && !readOnly && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Field label="Date *"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Litres *"><input type="number" step="any" min="0" value={form.litres} onChange={e => setForm({ ...form, litres: e.target.value })} placeholder="30.5" /></Field>
            <Field label="Rate / litre"><input type="number" step="any" min="0" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} placeholder="272.50" /></Field>
            <Field label="Meter at the pump"><input type="number" value={form.meterReading} onChange={e => setForm({ ...form, meterReading: e.target.value })} placeholder="optional" /></Field>
            <Field label="Drawn by">
              <select value={form.drawnById} onChange={e => setForm({ ...form, drawnById: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">— not recorded —</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </Field>
            <Field label="Pump / vendor"><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="optional" /></Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={save} disabled={busy || !form.date || !Number(form.litres)}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add entry"}
            </button>
            {amount > 0 && <span style={{ fontSize: 13, color: "var(--text2)" }}>Amount <strong>Rs {amount.toLocaleString("en-PK")}</strong></span>}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th>Date</th><th className="num">Litres</th><th className="num">Rate</th><th className="num">Amount</th>
              <th className="num">Meter</th><th>Drawn by</th><th>Pump</th>
              {!readOnly && <th style={{ width: 110 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {fuel.length === 0 && (
              <tr><td colSpan={readOnly ? 7 : 8} style={{ color: "var(--text3)", padding: 16 }}>
                No fuel recorded this month{readOnly ? "." : " — the km/litre average needs at least one entry."}
              </td></tr>
            )}
            {fuel.map(f => (
              <tr key={f.id}>
                <td style={{ whiteSpace: "nowrap" }}>{f.date}</td>
                <td className="num" style={{ fontWeight: 700 }}>{f.litres}</td>
                <td className="num">{f.rate || "—"}</td>
                <td className="num">{f.amount ? `Rs ${f.amount.toLocaleString("en-PK")}` : "—"}</td>
                <td className="num">{f.meterReading ?? "—"}</td>
                <td>{f.drawnBy}</td>
                <td style={{ color: "var(--text2)" }}>{f.vendor || "—"}</td>
                {!readOnly && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm" disabled={busy} onClick={() => edit(f)}>Edit</button>
                      {canDelete && <button className="btn btn-sm" style={{ color: "#A32D2D" }} disabled={busy} onClick={() => remove(f)}>Delete</button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
      {label}
      {children}
    </label>
  );
}
