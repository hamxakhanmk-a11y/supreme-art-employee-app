"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABEL } from "@/lib/fleet";

type Driver = { id: number; employeeId: string; firstName: string; lastName: string };

type OpenTrip = { id: number; outAt: string; destination: string; meterOut: number; driver: string };
type Vehicle = {
  id: number; vehicleNo: string; name: string; type: string;
  defaultDriverId: number | null; active: boolean; notes: string;
  openTrip: OpenTrip | null;
};

const BLANK = { id: 0, vehicleNo: "", name: "", type: "car", defaultDriverId: "" as number | "", notes: "", active: true };

export default function VehiclesClient({ drivers, readOnly }: { drivers: Driver[]; readOnly: boolean }) {
  const [list, setList] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

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

  const save = async () => {
    if (!form.vehicleNo.trim()) { setErr("Vehicle number is required"); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/vehicles", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, defaultDriverId: form.defaultDriverId || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setForm({ ...BLANK });
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const edit = (v: Vehicle) => {
    setErr("");
    setForm({
      id: v.id, vehicleNo: v.vehicleNo, name: v.name || "", type: v.type,
      defaultDriverId: v.defaultDriverId ?? "", notes: v.notes || "", active: v.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            Every vehicle that has a log book. Retiring one stops it being offered at the gate and keeps its journeys readable.
          </p>
        </div>
        <Link href="/station" className="btn btn-sm">🏭 Terminal</Link>
      </div>

      {err && (
        <div className="card" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 14, fontSize: 13 }}>{err}</div>
      )}

      {!readOnly && (
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
                {drivers.map(d => <option key={d.id} value={d.id}>{d.employeeId} — {d.firstName} {d.lastName}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", gridColumn: "1 / -1" }}>
              Notes
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add vehicle"}
            </button>
            {form.id > 0 && <button className="btn" onClick={() => { setForm({ ...BLANK }); setErr(""); }}>Cancel</button>}
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
              <th>Vehicle No.</th><th>Make / model</th><th>Type</th><th>Usual driver</th>
              <th>Status</th>{!readOnly && <th style={{ width: 150 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={readOnly ? 5 : 6} style={{ color: "var(--text3)", padding: 18 }}>Loading…</td></tr>}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={readOnly ? 5 : 6} style={{ color: "var(--text3)", padding: 18 }}>
                No vehicles yet{readOnly ? "." : " — add the first one above."}
              </td></tr>
            )}
            {shown.map(v => (
              <tr key={v.id} style={{ opacity: v.active ? 1 : 0.55 }}>
                <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{v.vehicleNo}</td>
                <td>{v.name || "—"}</td>
                <td style={{ fontSize: 12, color: "var(--text2)" }}>{VEHICLE_TYPE_LABEL[v.type] || v.type}</td>
                <td style={{ fontSize: 12 }}>{driverName(v.defaultDriverId)}</td>
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
