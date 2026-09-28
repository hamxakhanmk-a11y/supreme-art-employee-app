"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DriverPoolPanel from "./DriverPoolPanel";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABEL } from "@/lib/fleet";

type Driver = { id: number; employeeId: string; firstName: string; lastName: string };

type OpenTrip = { id: number; outAt: string; destination: string; meterOut: number; driver: string };

// Either an employee, or a plain name for a driver who isn't on the payroll.
type DriverEntry = { employeeId: number | null; name: string };

// A vehicle PIN is four digits; an employee's is three. They live in separate
// spaces, but the extra digit means neither is ever typed at the wrong pad.
const PIN_LEN = 4;
const PIN_MSG = `The vehicle PIN must be ${PIN_LEN} digits`;
const onlyDigits = (s: string) => s.replace(/[^0-9]/g, "").slice(0, PIN_LEN);
const isPin = (s: string) => new RegExp(`^[0-9]{${PIN_LEN}}$`).test(s.trim());
type Vehicle = {
  id: number; vehicleNo: string; pin: string | null; name: string; type: string;
  defaultDriverId: number | null; drivers: DriverEntry[]; active: boolean; notes: string;
  openTrip: OpenTrip | null;
};

const BLANK = {
  id: 0, vehicleNo: "", pin: "", name: "", type: "car",
  defaultDriverId: "" as number | "", drivers: [] as DriverEntry[], notes: "", active: true,
};

export default function VehiclesClient({ drivers, readOnly }: { drivers: Driver[]; readOnly: boolean }) {
  const [list, setList] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false);
  const [manual, setManual] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);

  const openAdd = () => { setForm({ ...BLANK }); setManual(""); setErr(""); setFormOpen(true); };
  const closeForm = () => { setForm({ ...BLANK }); setManual(""); setErr(""); setFormOpen(false); };

  const driverName = (id: number | null) => {
    const d = drivers.find(x => x.id === id);
    return d ? `${d.employeeId} — ${d.firstName} ${d.lastName}` : "—";
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/vehicles", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load vehicles");
      setList(j);
      setErr("");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const hasEmployee = (id: number) => form.drivers.some(d => d.employeeId === id);

  const toggleDriver = (id: number) => {
    setForm(f => {
      const has = f.drivers.some(d => d.employeeId === id);
      const drivers = has ? f.drivers.filter(d => d.employeeId !== id) : [...f.drivers, { employeeId: id, name: "" }];
      // Dropping the usual driver from the list clears them, rather than
      // leaving the gate preselecting someone who may not drive it.
      const defaultDriverId = has && f.defaultDriverId === id ? "" as number | "" : f.defaultDriverId;
      return { ...f, drivers, defaultDriverId };
    });
  };

  // Someone who isn't on the payroll — a hired driver, a contractor's man.
  const addManualDriver = () => {
    const name = manual.trim();
    if (!name) return;
    if (form.drivers.some(d => !d.employeeId && d.name.toLowerCase() === name.toLowerCase())) { setManual(""); return; }
    setForm(f => ({ ...f, drivers: [...f.drivers, { employeeId: null, name }] }));
    setManual("");
  };

  const removeManualDriver = (name: string) =>
    setForm(f => ({ ...f, drivers: f.drivers.filter(d => d.employeeId !== null || d.name !== name) }));

  const save = async () => {
    if (!form.vehicleNo.trim()) { setErr("Vehicle number is required"); return; }
    if (form.pin.trim() && !isPin(form.pin)) { setErr(PIN_MSG); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/vehicles", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, defaultDriverId: form.defaultDriverId || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      closeForm();
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const edit = (v: Vehicle) => {
    setErr("");
    setFormOpen(true);
    setForm({
      id: v.id, vehicleNo: v.vehicleNo, pin: v.pin || "", name: v.name || "", type: v.type,
      defaultDriverId: v.defaultDriverId ?? "", drivers: v.drivers ?? [],
      notes: v.notes || "", active: v.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Set straight from the list: PINs are handed out a row at a time, and
  // opening the whole form for four digits is three clicks too many.
  const savePin = async (v: Vehicle, pin: string) => {
    if (pin && !isPin(pin)) { setErr(PIN_MSG); return false; }
    if ((v.pin || "") === pin) return true;   // nothing typed, nothing to save
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/vehicles", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, pin }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save the PIN");
      await load();
      return true;
    } catch (e: any) { setErr(e.message); return false; }
    finally { setBusy(false); }
  };

  const setActive = async (v: Vehicle, active: boolean) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/vehicles", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, active }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const shown = list.filter(v => showRetired || v.active);
  const retiredCount = list.filter(v => !v.active).length;

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🚐 Vehicles</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Every vehicle that has a log book. A vehicle needs a PIN, and a driver from the pool or its own, before it can go out at the gate. Retiring one keeps its journeys readable.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!readOnly && !poolOpen && (
            <button className="btn btn-sm" onClick={() => { setPoolOpen(true); setErr(""); }}>🧍 Drivers</button>
          )}
          {!readOnly && !formOpen && (
            <button className="btn btn-sm btn-primary" onClick={openAdd}>+ Add vehicle</button>
          )}
          <Link href="/station" className="btn btn-sm">🏭 Terminal</Link>
        </div>
      </div>

      {err && (
        <div className="card" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 14, fontSize: 13 }}>{err}</div>
      )}

      {!readOnly && poolOpen && (
        <DriverPoolPanel
          staff={drivers}
          onClose={() => setPoolOpen(false)}
          onSaved={() => { setPoolOpen(false); load(); }}
        />
      )}

      {!readOnly && formOpen && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>
            {form.id ? `Edit ${form.vehicleNo}` : "Add a vehicle"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Vehicle No. *
              <input value={form.vehicleNo} onChange={e => setForm({ ...form, vehicleNo: e.target.value })} placeholder="e.g. APR-1234" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Vehicle PIN
              <input value={form.pin} inputMode="numeric" maxLength={PIN_LEN}
                onChange={e => setForm({ ...form, pin: onlyDigits(e.target.value) })}
                placeholder={`${PIN_LEN} digits`} />
              <span style={{ display: "block", fontWeight: 400, fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
                Typed at the gate to take this vehicle out
              </span>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Make / model
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Suzuki Bolan" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Type
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{VEHICLE_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Usual driver
              <select value={form.defaultDriverId} onChange={e => setForm({ ...form, defaultDriverId: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">— none —</option>
                {drivers.filter(d => hasEmployee(d.id)).map(d => (
                  <option key={d.id} value={d.id}>{d.employeeId} — {d.firstName} {d.lastName}</option>
                ))}
              </select>
              <span style={{ display: "block", fontWeight: 400, fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
                Preselected at the gate. Chosen from the drivers below.
              </span>
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Drivers just for this vehicle</span>
              <span style={{ display: "block", fontWeight: 400, fontSize: 11, color: "var(--text3)", margin: "2px 0 6px" }}>
                Extra drivers for this vehicle only — everyone in <strong>Drivers</strong> above is already offered on every vehicle.
              </span>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 168, overflowY: "auto",
                border: "1px solid var(--border)", borderRadius: 8, padding: 8,
              }}>
                {drivers.map(d => {
                  const on = hasEmployee(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => toggleDriver(d.id)}
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

              {form.drivers.filter(d => !d.employeeId).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {form.drivers.filter(d => !d.employeeId).map(d => (
                    <span key={d.name} style={{
                      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700,
                      background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
                      borderRadius: 999, padding: "5px 6px 5px 11px",
                    }}>
                      {d.name}
                      <button type="button" onClick={() => removeManualDriver(d.name)}
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
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addManualDriver(); } }}
                  placeholder="Someone not on the staff list — e.g. Rashid (hired driver)"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn" onClick={addManualDriver} disabled={!manual.trim()}>+ Add</button>
              </div>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", gridColumn: "1 / -1" }}>
              Notes
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add vehicle"}
            </button>
            <button className="btn" onClick={closeForm}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>On the list</h2>
        {retiredCount > 0 && (
          <button className="btn btn-sm" onClick={() => setShowRetired(s => !s)}>
            {showRetired ? "Hide retired" : `Show retired (${retiredCount})`}
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Vehicle No.</th><th style={{ textAlign: "center" }}>PIN</th><th>Make / model</th>
              <th>Own drivers</th><th>Status</th>{!readOnly && <th style={{ width: 150 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={readOnly ? 5 : 6} style={{ color: "var(--text3)", padding: 18 }}>Loading…</td></tr>}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={readOnly ? 5 : 6} style={{ color: "var(--text3)", padding: 18 }}>
                No vehicles yet{readOnly ? "." : " — use “+ Add vehicle” above."}
              </td></tr>
            )}
            {shown.map(v => (
              <tr key={v.id} style={{ opacity: v.active ? 1 : 0.55 }}>
                <td style={{ fontWeight: 700, fontFamily: "monospace" }}>
                  {v.vehicleNo}
                  <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)", fontFamily: "var(--font)" }}>{VEHICLE_TYPE_LABEL[v.type] || v.type}</div>
                </td>
                <td style={{ textAlign: "center" }}>
                  {readOnly ? (
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: v.pin ? "var(--brand)" : "var(--text3)" }}>
                      {v.pin || "not set"}
                    </span>
                  ) : (
                    <PinCell vehicle={v} busy={busy} onSave={savePin} />
                  )}
                </td>
                <td>{v.name || "—"}</td>
                <td style={{ fontSize: 12 }}>
                  {(v.drivers?.length ?? 0) === 0
                    ? <span style={{ color: "var(--text3)" }}>pool only</span>
                    : <>{v.drivers.length} · <span style={{ color: "var(--text3)" }}>{driverName(v.defaultDriverId)}</span></>}
                </td>
                <td style={{ fontSize: 12 }}>
                  {!v.active ? <span style={{ color: "var(--text3)" }}>Retired</span>
                    : v.openTrip
                      ? <span style={{ color: "#DC2626", fontWeight: 700 }}>Out — {v.openTrip.driver}</span>
                      : <span style={{ color: "#15803D", fontWeight: 600 }}>In</span>}
                </td>
                {!readOnly && (
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-sm" onClick={() => edit(v)}>Edit</button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => setActive(v, !v.active)}>
                        {v.active ? "Retire" : "Restore"}
                      </button>
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

// The PIN column, editable where it stands. Saves when you leave the box or
// press Enter; Escape puts back what was there. Kept local so typing doesn't
// re-render the whole table on every keystroke.
function PinCell({ vehicle, busy, onSave }: {
  vehicle: { id: number; pin: string | null };
  busy: boolean;
  onSave: (v: any, pin: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(vehicle.pin || "");
  const [dirty, setDirty] = useState(false);

  // A save elsewhere (or a reload) wins over an untouched box.
  useEffect(() => { if (!dirty) setValue(vehicle.pin || ""); }, [vehicle.pin, dirty]);

  const commit = async () => {
    if (!dirty) return;
    const ok = await onSave(vehicle, value);
    setDirty(false);
    if (!ok) setValue(vehicle.pin || "");
  };

  const stale = !dirty && !!value && !isPin(value);

  return (
    <input
      value={value}
      inputMode="numeric"
      maxLength={PIN_LEN}
      disabled={busy}
      placeholder="—"
      onChange={e => { setValue(onlyDigits(e.target.value)); setDirty(true); }}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        else if (e.key === "Escape") { setValue(vehicle.pin || ""); setDirty(false); }
      }}
      title={stale
        ? `The gate now asks for ${PIN_LEN} digits — this one can no longer be typed in`
        : `${PIN_LEN}-digit PIN typed at the gate`}
      style={{
        width: 70, textAlign: "center", padding: "6px 4px",
        fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: 1,
        color: stale ? "#B45309" : value ? "var(--brand)" : "var(--text3)",
        // A PIN left over from when three digits were enough can never be
        // entered: the pad submits on the fourth. Flagged rather than padded,
        // since inventing a digit would hand out a PIN nobody was told about.
        borderColor: stale ? "#B45309" : undefined,
      }}
    />
  );
}
