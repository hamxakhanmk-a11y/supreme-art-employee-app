"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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

// The browser's own date — the terminal sits at the gate in Karachi, so local
// is right. (toISOString would be UTC, and yesterday until 5am.)
const localToday = () => new Date().toLocaleDateString("en-CA");

// "HH:MM" on the Karachi clock, from a stored timestamp.
function karachiHM(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" });
}
function karachiDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

export default function VehicleTerminal({
  people, onDone,
}: {
  people: Person[];
  onDone: (msg: string, color: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"pick" | "trip" | "card" | "fuel">("pick");
  // Bumped after each fill so the form comes back empty for the next slip.
  const [fuelForm, setFuelForm] = useState(0);
  // The fill typed on the return form, once saved. If the return itself is then
  // refused (a time before the card went out, say), pressing it again must not
  // save the same slip a second time.
  const fuelSaved = useRef<string | null>(null);

  // When it happened. Left alone it is now; set for an entry written up after
  // the fact — yesterday's trip, a card handed back last night.
  const [entryDate, setEntryDate] = useState(localToday());
  const [entryTime, setEntryTime] = useState("");
  const backdated = entryDate !== localToday();
  // An earlier day has no "now" to fall back on, so it needs its time.
  const whenMissing = backdated && !entryTime;
  const when = () => ({
    date: backdated ? entryDate : undefined,
    at: entryTime || undefined,
  });

  const reset = useCallback(() => {
    setPin(""); setData(null); setError(null); setAction("pick");
    fuelSaved.current = null;
    // Back to now for the next vehicle: a date left set from the last entry
    // is the easiest way to file today's trip under yesterday.
    setEntryDate(localToday()); setEntryTime("");
  }, []);

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
        body: JSON.stringify({ ...body, vehicleId: data.vehicle.id, ...when() }),
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
        body: JSON.stringify({ ...body, ...when() }),
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
          ...when(),
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

  const postFuel = async (card: OpenCard, fuel: ReturnFuel) => {
    if (!data) return;
    const fr = await fetch("/api/fleet/card-issues", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: card.cardId, vehicleId: data.vehicle.id,
        // Collection date and time come from the hand-over, on the server.
        slipNo: fuel.slipNo, amount: fuel.amount, notes: fuel.notes,
      }),
    });
    const fj = await fr.json();
    if (!fr.ok) throw new Error(fj.error || "Could not save the fuel record");
  };

  // A fill on a card that stays out. No limit: the same driver can fill up on
  // the same card several times in a day, and every slip is its own record.
  // Stays on this vehicle with an empty form, ready for the next slip.
  const recordFuel = async (fuel: ReturnFuel | null) => {
    if (!data?.openCard || !fuel) return;
    setBusy(true); setError(null);
    try {
      await postFuel(data.openCard, fuel);
      onDone(`Rs ${fuel.amount} on card ${data.openCard.sn} · card still with ${data.openCard.takenBy}`, "#B45309");
      setFuelForm(n => n + 1);
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
      const key = fuel ? JSON.stringify(fuel) : null;
      if (fuel && fuelSaved.current !== key) {
        await postFuel(data.openCard, fuel);
        fuelSaved.current = key;
      }
      const res = await fetch("/api/fleet/cards/hand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: data.openCard.cardId, action: "return", ...when() }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error((j.error || "Could not take the card back")
          + (fuelSaved.current ? " (The fuel record is saved — fix the time and press again.)" : ""));
      }
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

      {/* When it happened — applies to whichever action follows. */}
      <div className="card" style={{
        marginTop: 12, padding: "10px 12px", textAlign: "left",
        borderLeft: `4px solid ${backdated || entryTime ? "#B45309" : "var(--border)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.3 }}>When</span>
          <input type="date" value={entryDate} max={localToday()} disabled={busy}
            onChange={e => setEntryDate(e.target.value || localToday())}
            style={{ width: 150, padding: "7px 9px", fontSize: 14 }} />
          <input type="time" value={entryTime} disabled={busy}
            onChange={e => setEntryTime(e.target.value)}
            style={{ width: 120, padding: "7px 9px", fontSize: 14, borderColor: whenMissing ? "#DC2626" : undefined }} />
          {(backdated || entryTime) && (
            <button type="button" className="btn btn-sm" disabled={busy}
              onClick={() => { setEntryDate(localToday()); setEntryTime(""); }}>Use now</button>
          )}
        </div>
        <div style={{ fontSize: 11.5, marginTop: 5, color: whenMissing ? "#DC2626" : backdated || entryTime ? "#B45309" : "var(--text3)", fontWeight: backdated ? 600 : 400 }}>
          {whenMissing
            ? "Give the time too — for an earlier day it can't be taken from the clock."
            : backdated || entryTime
              ? `Recording for ${new Date(entryDate + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}${entryTime ? ` at ${entryTime}` : ""}, not now.`
              : "Blank means right now. Set it for an entry made after the fact."}
        </div>
      </div>

      {action === "pick" ? (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {data.openTrip ? (
            <ActionButton color="#15803D" onClick={() => setAction("trip")} disabled={whenMissing}
              title="← Bring the vehicle back"
              // Karachi time, and the day when it is not today — the slice of
              // the raw timestamp this used to show was UTC, five hours early.
              hint={`Out since ${karachiDate(data.openTrip.outAt) !== localToday() ? `${karachiDate(data.openTrip.outAt)} ` : ""}${karachiHM(data.openTrip.outAt)} · left on ${data.openTrip.meterOut} km`} />
          ) : (
            // Always offered: a typed name is enough to take a vehicle out, so
            // an empty drivers list is no reason to stop anyone.
            <ActionButton color="#DC2626" onClick={() => setAction("trip")} disabled={whenMissing}
              title="Take the vehicle out →" hint="Log book entry" />
          )}

          {data.openCard ? (
            <>
              {/* The fill has its own date and time on the form, so the When
                  box above doesn't hold it up. */}
              <ActionButton color="#B45309" onClick={() => setAction("fuel")}
                title="⛽ Record fuel — card stays out"
                hint={`${data.openCard.sn} · with ${data.openCard.takenBy} · one slip at a time, as many as there are`} />
              <ActionButton color="#15803D" onClick={() => setAction("card")} disabled={whenMissing}
                title="← Take the fuel card back"
                hint={`${data.openCard.sn} · with ${data.openCard.takenBy} since ${data.openCard.collectedDate}`} />
            </>
          ) : (
            <ActionButton color="#4F46E5" onClick={() => setAction("card")} disabled={whenMissing}
              title="Take the fuel card →"
              hint={data.cards.find(c => c.own)?.sn ?? (data.cards.length ? "no card of its own — pick one" : "none free")} />
          )}
        </div>
      ) : action === "fuel" && data.openCard ? (
        <ReturnCard key={fuelForm} keepOut card={data.openCard} busy={busy}
          onCancel={() => setAction("pick")} onConfirm={recordFuel} />
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

function ActionButton({ title, hint, color, onClick, disabled }: {
  title: string; hint: string; color: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      border: `1px solid ${color}`, background: color, color: "#fff", boxShadow: `0 2px 8px ${color}55`,
    }}>
      <div style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>{hint}</div>
    </button>
  );
}
