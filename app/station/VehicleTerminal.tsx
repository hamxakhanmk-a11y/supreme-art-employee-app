"use client";
import { useCallback, useEffect, useState } from "react";
import PinPad from "./PinPad";
import { TakeVehicleOut, BringVehicleBack, type Person, type OpenTrip, type Officer } from "./VehicleTripForms";
import { TakeCardOut, ReturnCard, type DrawerCard, type OpenCard, type ReturnFuel } from "./CardForms";

// The vehicle half of the gate terminal. The vehicle identifies itself with
// its own PIN and the driver is then chosen from those allowed to drive it —
// so a trip is attributed without the driver carrying a second PIN, and the
// list to choose from is three names rather than the whole payroll.


export type Driver = { rowId: number; employeeId: number | null; code: string; name: string };
type Found = {
  vehicle: { id: number; vehicleNo: string; name: string | null; type: string; defaultDriverId: number | null };
  drivers: Driver[];
  openTrip: OpenTrip | null;
  lastMeter: number | null;
  openCard: OpenCard | null;
  cards: DrawerCard[];
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
  const [action, setAction] = useState<"pick" | "trip" | "card">("pick");

  const reset = useCallback(() => { setPin(""); setData(null); setError(null); setAction("pick"); }, []);

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

  const takeOut = async (body: { driverRowId: number | null; driverName: string; meterOut: number; destination: string; purpose: string; officers: Officer[] }) => {
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

  const takeCard = async (body: { cardId: number; driverId: number | null; driverName: string }) => {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/fleet/cards/hand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: body.cardId, action: "take",
          holderId: body.driverId, holderName: body.driverName,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not hand out the card");
      const sn = data.cards.find(c => c.id === body.cardId)?.sn ?? "";
      onDone(`Card ${sn} to ${body.driverName}`, "#4F46E5");
      reset();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // Taking the card back is custody and nothing else: the fuel drawn on it is
  // recorded on the PSO Cards tab, and a card can come back having been
  // filled several times or not at all.
  const returnCard = async (fuel: ReturnFuel | null) => {
    if (!data?.openCard) return;
    setBusy(true); setError(null);
    try {
      // The record goes in first, while the card is still out, so it is
      // pending — then handing the card back submits it along with any
      // other fills drawn on it.
      if (fuel) {
        const fr = await fetch("/api/fleet/card-issues", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId: data.openCard.cardId, vehicleId: data.vehicle.id,
            collectedDate: fuel.collectedDate, collectedTime: fuel.collectedTime,
            slipNo: fuel.slipNo, amount: fuel.amount, notes: fuel.notes,
          }),
        });
        const fj = await fr.json();
        if (!fr.ok) throw new Error(fj.error || "Could not save the fuel record");
      }
      const res = await fetch("/api/fleet/cards/hand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: data.openCard.cardId, action: "return" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not take the card back");
      onDone(`Card ${data.openCard.sn} back in${fuel ? ` · Rs ${fuel.amount} recorded` : ""}`, "#15803D");
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
          pin={pin} busy={busy} active prompt="Enter the vehicle PIN"
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

      {action === "pick" ? (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {data.openTrip ? (
            <ActionButton color="#15803D" onClick={() => setAction("trip")}
              title="← Bring the vehicle back"
              hint={`Out since ${data.openTrip.outAt.slice(11, 16)} · left on ${data.openTrip.meterOut} km`} />
          ) : data.drivers.length === 0 ? (
            <div style={{ textAlign: "left", fontSize: 13, color: "#B45309", fontWeight: 600 }}>
              No drivers are set for {v.vehicleNo} — add them under Station → Vehicles before it can go out.
            </div>
          ) : (
            <ActionButton color="#DC2626" onClick={() => setAction("trip")}
              title="Take the vehicle out →" hint="Log book entry" />
          )}

          {data.openCard ? (
            <ActionButton color="#15803D" onClick={() => setAction("card")}
              title="← Take the fuel card back"
              hint={`${data.openCard.sn} · with ${data.openCard.takenBy} since ${data.openCard.collectedDate}`} />
          ) : (
            <ActionButton color="#4F46E5" onClick={() => setAction("card")}
              title="Take the fuel card →"
              hint={data.cards.find(c => c.own)?.sn ?? (data.cards.length ? "no card of its own — pick one" : "none free")} />
          )}
        </div>
      ) : action === "card" ? (
        data.openCard
          ? <ReturnCard card={data.openCard} busy={busy} onCancel={() => setAction("pick")} onConfirm={returnCard} />
          : <TakeCardOut cards={data.cards} drivers={data.drivers} people={people} busy={busy}
              onCancel={() => setAction("pick")} onSubmit={takeCard} />
      ) : data.openTrip ? (
        <BringVehicleBack trip={data.openTrip} busy={busy} onSubmit={bringBack} />
      ) : (
        <TakeVehicleOut
          drivers={data.drivers} defaultDriverId={v.defaultDriverId} lastMeter={data.lastMeter}
          busy={busy} onCancel={() => setAction("pick")} onSubmit={takeOut}
        />
      )}

      <button onClick={reset} className="btn" style={{ marginTop: 16 }}>← Different vehicle</button>
    </div>
  );
}

function ActionButton({ title, hint, color, onClick }: { title: string; hint: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12, cursor: "pointer",
      border: `1px solid ${color}`, background: color, color: "#fff", boxShadow: `0 2px 8px ${color}55`,
    }}>
      <div style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>{hint}</div>
    </button>
  );
}
