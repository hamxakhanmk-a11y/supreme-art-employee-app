"use client";
import { useRef, useState } from "react";

// The vehicle half of the Station terminal: taking one out, and bringing it
// back. Kept in its own file so StationClient stays about the PIN and the
// on-foot punch it has always been about.

export type Person = { id: number; code: string; name: string; department: string };
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

// --- Who's travelling -------------------------------------------------------
// Employees suggested as you type, but anything typed is kept: a customer's man
// or a visitor rides along often enough that a closed list would be wrong.
function OfficerPicker({ people, value, onChange, disabled }: {
  people: Person[]; value: Officer[]; onChange: (o: Officer[]) => void; disabled: boolean;
}) {
  const [text, setText] = useState("");
  const listId = useRef(`officers-${Math.random().toString(36).slice(2)}`).current;
  const label = (p: Person) => `${p.code} — ${p.name}`;

  const add = () => {
    const typed = text.trim();
    if (!typed) return;
    const match = people.find(p => label(p).toLowerCase() === typed.toLowerCase() || p.name.toLowerCase() === typed.toLowerCase());
    const entry: Officer = match ? { employeeId: match.id, name: label(match) } : { employeeId: null, name: typed };
    if (!value.some(v => v.name.toLowerCase() === entry.name.toLowerCase())) onChange([...value, entry]);
    setText("");
  };

  return (
    <div>
      <span style={labelStyle}>Who&apos;s going <span style={{ textTransform: "none", fontWeight: 400, color: "var(--text3)" }}>(optional)</span></span>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map(o => (
            <span key={o.name} style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
              background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 6px 5px 11px",
            }}>
              {o.name}
              <button type="button" disabled={disabled} onClick={() => onChange(value.filter(v => v.name !== o.name))}
                style={{ border: "none", background: "transparent", color: "#A32D2D", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 3px" }}
                title="Remove">×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          list={listId} value={text} disabled={disabled}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Search a name, or type anyone"
          style={{ ...field, flex: 1 }}
        />
        <button type="button" className="btn" onClick={add} disabled={disabled || !text.trim()}>Add</button>
      </div>
      <datalist id={listId}>
        {people.map(p => <option key={p.id} value={label(p)}>{p.department}</option>)}
      </datalist>
    </div>
  );
}

// A manually-added driver has no staff code, so the dash would dangle.
function driverLabel(d: { code: string; name: string }) {
  return d.code ? `${d.code} — ${d.name}` : d.name;
}

// --- Taking a vehicle out ---------------------------------------------------
// The vehicle is already known — its PIN is how we got here — so this asks who
// is driving it, from the people set on that vehicle and nobody else.
export function TakeVehicleOut({ drivers, defaultDriverId, lastMeter, people, busy, onCancel, onSubmit }: {
  drivers: { rowId: number; employeeId: number | null; code: string; name: string }[];
  defaultDriverId: number | null;
  lastMeter: number | null;
  people: Person[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: { driverRowId: number; meterOut: number; destination: string; purpose: string; officers: Officer[] }) => void;
}) {
  // The usual driver, when they're on the list; otherwise the only name there,
  // and failing that nothing preselected.
  const [driverRowId, setDriverRowId] = useState<number | "">(() =>
    drivers.find(d => d.employeeId !== null && d.employeeId === defaultDriverId)?.rowId
    ?? (drivers.length === 1 ? drivers[0].rowId : "")
  );
  const [meter, setMeter] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [officers, setOfficers] = useState<Officer[]>([]);

  const typed = meter.trim() === "" ? null : Math.round(Number(meter));
  // Warned about here, and refused by the server either way.
  const backwards = typed !== null && lastMeter !== null && isFinite(typed) && typed < lastMeter;
  const ready = driverRowId !== "" && typed !== null && isFinite(typed) && !backwards;

  return (
    <div style={{ marginTop: 8 }}>
      <span style={labelStyle}>Driver</span>
      {drivers.length === 1 ? (
        <div style={{ ...field, fontWeight: 700, textAlign: "left" }}>{driverLabel(drivers[0])}</div>
      ) : (
        <select value={driverRowId} disabled={busy} onChange={e => setDriverRowId(Number(e.target.value))} style={field}>
          <option value="">— choose the driver —</option>
          {drivers.map(d => <option key={d.rowId} value={d.rowId}>{driverLabel(d)}</option>)}
        </select>
      )}

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

      <OfficerPicker people={people} value={officers} onChange={setOfficers} disabled={busy} />

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="btn" onClick={onCancel} disabled={busy} style={{ flex: "0 0 auto" }}>← Back</button>
        <button
          onClick={() => onSubmit({ driverRowId: Number(driverRowId), meterOut: typed ?? NaN, destination, purpose, officers })}
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
