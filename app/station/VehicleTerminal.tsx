"use client";
import { useCallback, useEffect, useState } from "react";
import PinPad from "./PinPad";
import { TakeVehicleOut, BringVehicleBack, type Person, type OpenTrip, type Officer } from "./VehicleTripForms";

// The vehicle half of the gate terminal. The vehicle identifies itself with
// its own PIN and the driver is then chosen from those allowed to drive it —
// so a trip is attributed without the driver carrying a second PIN, and the
// list to choose from is three names rather than the whole payroll.

const PIN_LEN = 3;

export type Driver = { rowId: number; employeeId: number | null; code: string; name: string };
type Found = {
  vehicle: { id: number; vehicleNo: string; name: string | null; type: string; defaultDriverId: number | null };
  drivers: Driver[];
  openTrip: OpenTrip | null;
  lastMeter: number | null;
};

export default function VehicleTerminal({
  people, time, onDone,
}: {
  people: Person[];
  /** Optional manual "HH:MM" shared with the rest of the terminal. */
  time: string;
  onDone: (msg: string, color: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => { setPin(""); setData(null); setError(null); }, []);

  const lookup = useCallback(async (p: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/fleet/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: p }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Lookup failed");
      setData(j);
    } catch (e: any) { setError(e.message); setPin(""); }
    finally { setBusy(false); }
  }, []);

  const takeOut = async (body: { driverRowId: number; meterOut: number; destination: string; purpose: string; officers: Officer[] }) => {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/fleet/trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, vehicleId: data.vehicle.id, at: time || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not record the trip");
      onDone(`${data.vehicle.vehicleNo} out · ${body.meterOut} km`, "#DC2626");
      reset();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const bringBack = async (body: { tripId: number; meterIn: number; remarks: string }) => {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/fleet/trips", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, at: time || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not close the trip");
      onDone(`${data.vehicle.vehicleNo} back in · ${j.trip.kmCovered} km covered`, "#15803D");
      reset();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // A PIN typed against the wrong mode is the likeliest mistake here, so the
  // message says which kind of PIN this pad wants.
  useEffect(() => { setError(null); }, [pin]);

  if (!data) {
    return (
      <>
        {error && (
          <div style={{ margin: "10px 0", padding: "10px 14px", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "#DC2626", background: "#fde2e2" }}>
            {error}
          </div>
        )}
        <PinPad
          pin={pin} length={PIN_LEN} busy={busy} active prompt={`Enter the ${PIN_LEN}-digit vehicle PIN`}
          onChange={setPin} onSubmit={lookup}
        />
      </>
    );
  }

  const v = data.vehicle;
  return (
    <div>
      {error && (
        <div style={{ margin: "10px 0", padding: "10px 14px", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "#DC2626", background: "#fde2e2" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
        <div style={{ fontSize: 30, lineHeight: 1 }}>🚐</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{v.vehicleNo}</div>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            {v.name || "—"}
            {data.lastMeter !== null && ` · last seen on ${data.lastMeter} km`}
          </div>
        </div>
      </div>

      {data.openTrip ? (
        <BringVehicleBack trip={data.openTrip} busy={busy} onSubmit={bringBack} />
      ) : data.drivers.length === 0 ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, color: "#B45309", fontWeight: 600 }}>
            No drivers are set for {v.vehicleNo}.
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 6 }}>
            Add them under Station → Vehicles, and this vehicle can go out.
          </div>
        </div>
      ) : (
        <TakeVehicleOut
          drivers={data.drivers} defaultDriverId={v.defaultDriverId} lastMeter={data.lastMeter}
          people={people} busy={busy} onCancel={reset} onSubmit={takeOut}
        />
      )}

      <button onClick={reset} className="btn" style={{ marginTop: 16 }}>← Different vehicle</button>
    </div>
  );
}
