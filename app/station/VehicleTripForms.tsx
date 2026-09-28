"use client";
import { useRef, useState } from "react";

// The vehicle half of the Station terminal: taking one out, and bringing it
// back. Kept in its own file so StationClient stays about the PIN and the
// on-foot punch it has always been about.

export type Person = { id: number; code: string; name: string; department: string };

// A name chosen for a trip: either off the drivers list (rowId) or typed.
export type Picked = { rowId: number | null; name: string };
export type OpenTrip = {
  id: number; vehicleId: number; vehicleNo: string; vehicleName: string;
  outAt: string; destination: string; purpose: string; meterOut: number; officers: string[]; driver?: string;
};
export type Officer = { employeeId: number | null; name: string };

const field: React.CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)",
};
const labelStyle: React.CSSProperties = {
  display: "block", textAlign: "left", fontSize: 12, fontWeight: 700,
  color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.3, margin: "12px 0 4px",
};

// --- Who is taking it -------------------------------------------------------
// One field, not two. Whoever is taking the vehicle is either on the drivers
// list or is somebody whose name gets typed — and asking for a driver and then
// again for who is going meant naming the same person twice.
//
// The first name is the one that drives; anyone added after rides along.
function PeoplePicker({ drivers, value, onChange, disabled }: {
  drivers: { rowId: number; employeeId: number | null; code: string; name: string }[];
  value: Picked[];
  onChange: (v: Picked[]) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  const add = (p: Picked) => {
    if (value.some(v => v.name.toLowerCase() === p.name.toLowerCase())) return;
    onChange([...value, p]);
  };
  const addTyped = () => {
    const name = text.trim();
    if (!name) return;
    add({ rowId: null, name });
    setText("");
  };

  return (
    <div>
      <span style={labelStyle}>Driver / who&apos;s going</span>

      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((p, i) => (
            <span key={p.name} style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700,
              background: i === 0 ? "var(--brand)" : "var(--bg2)",
              color: i === 0 ? "#fff" : "var(--text2)",
              border: `1px solid ${i === 0 ? "var(--brand)" : "var(--border)"}`,
              borderRadius: 999, padding: "6px 7px 6px 12px",
            }}>
              {p.name}
              {i === 0 && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>driving</span>}
              <button type="button" disabled={disabled} onClick={() => onChange(value.filter(v => v.name !== p.name))}
                style={{
                  border: "none", background: "transparent", cursor: "pointer", fontSize: 15, lineHeight: 1,
                  padding: "0 3px", color: i === 0 ? "#fff" : "#A32D2D",
                }}
                title="Remove">×</button>
            </span>
          ))}
        </div>
      )}

      {drivers.length > 0 && (
        <select
          value=""
          disabled={disabled}
          onChange={e => {
            const d = drivers.find(x => String(x.rowId) === e.target.value);
            if (d) add({ rowId: d.rowId, name: d.code ? `${d.code} — ${d.name}` : d.name });
          }}
          style={{ ...field, marginBottom: 8 }}>
          <option value="">— choose a driver —</option>
          {drivers.filter(d => !value.some(v => v.rowId === d.rowId)).map(d => (
            <option key={d.rowId} value={d.rowId}>{d.code ? `${d.code} — ${d.name}` : d.name}</option>
          ))}
        </select>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text} disabled={disabled}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }}
          placeholder="or type a name"
          style={{ ...field, flex: 1 }}
        />
        <button type="button" className="btn" onClick={addTyped} disabled={disabled || !text.trim()}>Add</button>
      </div>
    </div>
  );
}

// --- Taking a vehicle out ---------------------------------------------------
// The vehicle is already known — its PIN is how we got here.
export function TakeVehicleOut({ drivers, defaultDriverId, lastMeter, busy, onCancel, onSubmit }: {
  drivers: { rowId: number; employeeId: number | null; code: string; name: string }[];
  defaultDriverId: number | null;
  lastMeter: number | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: {
    driverRowId: number | null; driverName: string; meterOut: number;
    destination: string; purpose: string; officers: Officer[];
  }) => void;
}) {
  // The usual driver, when the list has them — one fewer thing to pick.
  const [people, setPeople] = useState<Picked[]>(() => {
    const d = drivers.find(x => x.employeeId !== null && x.employeeId === defaultDriverId);
    return d ? [{ rowId: d.rowId, name: d.code ? `${d.code} — ${d.name}` : d.name }] : [];
  });
  const [meter, setMeter] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");

  const typed = meter.trim() === "" ? null : Math.round(Number(meter));
  // Warned about here, and refused by the server either way.
  const backwards = typed !== null && lastMeter !== null && isFinite(typed) && typed < lastMeter;
  const ready = people.length > 0 && typed !== null && isFinite(typed) && !backwards;

  return (
    <div style={{ marginTop: 8 }}>
      <PeoplePicker drivers={drivers} value={people} onChange={setPeople} disabled={busy} />

      <span style={labelStyle}>Meter reading now</span>
      <input
        type="number" inputMode="numeric" value={meter} disabled={busy}
        onChange={e => setMeter(e.target.value)} placeholder={lastMeter !== null ? `last seen on ${lastMeter} km` : "km on the dial"}
        style={{ ...field, borderColor: backwards ? "#DC2626" : "var(--border)" }}
      />
      {backwards && (
        <div style={{ textAlign: "left", fontSize: 12, color: "#DC2626", marginTop: 4, fontWeight: 600 }}>
          This vehicle was last on {lastMeter} km. A meter can&apos;t go backwards — check the reading.
        </div>
      )}

      <span style={labelStyle}>Going to</span>
      <input value={destination} disabled={busy} onChange={e => setDestination(e.target.value)}
        placeholder="e.g. Stanley, Warehouse, Customer office" style={field} />

      <span style={labelStyle}>Purpose <span style={{ textTransform: "none", fontWeight: 400, color: "var(--text3)" }}>(optional)</span></span>
      <input value={purpose} disabled={busy} onChange={e => setPurpose(e.target.value)}
        placeholder="e.g. Delivery, pick-up, bank work" style={field} />

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="btn" onClick={onCancel} disabled={busy} style={{ flex: "0 0 auto" }}>← Back</button>
        <button
          onClick={() => onSubmit({
            // The first name drives; the rest ride along.
            driverRowId: people[0]?.rowId ?? null,
            driverName: people[0]?.name ?? "",
            meterOut: typed ?? NaN,
            destination, purpose,
            officers: people.slice(1).map(p => ({ employeeId: null, name: p.name })),
          })}
          disabled={busy || !ready}
          style={{
            flex: 1, padding: "16px 12px", fontSize: 16, fontWeight: 800, borderRadius: 12,
            border: "none", color: "#fff", background: "#DC2626",
            cursor: busy ? "default" : "pointer", opacity: busy || !ready ? 0.6 : 1,
          }}>
          Take out →
        </button>
      </div>
    </div>
  );
}

// --- Bringing it back -------------------------------------------------------
export function BringVehicleBack({ trip, busy, onSubmit }: {
  trip: OpenTrip; busy: boolean; onSubmit: (body: { tripId: number; meterIn: number; remarks: string }) => void;
}) {
  const [meter, setMeter] = useState("");
  const [remarks, setRemarks] = useState("");
  const typed = meter.trim() === "" ? null : Math.round(Number(meter));
  const short = typed !== null && isFinite(typed) && typed < trip.meterOut;
  const km = typed !== null && isFinite(typed) && !short ? typed - trip.meterOut : null;

  return (
    <div style={{ marginTop: 8 }}>
      <div className="card" style={{ textAlign: "left", padding: "12px 14px", marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Out in <span style={{ fontFamily: "monospace" }}>{trip.vehicleNo}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
          {trip.driver ? `${trip.driver} · ` : ""}left on {trip.meterOut} km{trip.destination ? ` · ${trip.destination}` : ""}
          {trip.officers.length > 0 && ` · with ${trip.officers.join(", ")}`}
        </div>
      </div>

      <span style={labelStyle}>Meter reading now</span>
      <input
        type="number" inputMode="numeric" value={meter} disabled={busy}
        onChange={e => setMeter(e.target.value)} placeholder={`more than ${trip.meterOut}`}
        style={{ ...field, borderColor: short ? "#DC2626" : "var(--border)" }}
      />
      {short && (
        <div style={{ textAlign: "left", fontSize: 12, color: "#DC2626", marginTop: 4, fontWeight: 600 }}>
          It went out on {trip.meterOut} km, so it can&apos;t come back on less.
        </div>
      )}
      {km !== null && (
        <div style={{ textAlign: "left", fontSize: 13, color: "#15803D", marginTop: 6, fontWeight: 700 }}>
          {km} km covered
        </div>
      )}

      <span style={labelStyle}>Remarks <span style={{ textTransform: "none", fontWeight: 400, color: "var(--text3)" }}>(optional)</span></span>
      <input value={remarks} disabled={busy} onChange={e => setRemarks(e.target.value)} placeholder="Anything worth noting" style={field} />

      <button
        onClick={() => onSubmit({ tripId: trip.id, meterIn: typed ?? NaN, remarks })}
        disabled={busy || typed === null || !isFinite(typed) || short}
        style={{
          width: "100%", marginTop: 18, padding: "16px 12px", fontSize: 16, fontWeight: 800, borderRadius: 12,
          border: "none", color: "#fff", background: "#15803D",
          cursor: busy ? "default" : "pointer", opacity: busy || typed === null || short ? 0.6 : 1,
        }}>
        ← Bring it back
      </button>
    </div>
  );
}
