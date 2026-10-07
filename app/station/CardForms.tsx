"use client";
import { useState } from "react";
import type { Person } from "./VehicleTripForms";

// Handing a fuel card out and taking it back, at the gate, on the vehicle's
// PIN. The vehicle is already known, its own card is already chosen, and the
// date and time are whatever the clock says — so what is left to say is who is
// taking it, and on return what the slip says.

export type DrawerCard = { id: number; sn: string; vehicleNo: string | null; own: boolean };
export type OpenCard = {
  issueId: number; cardId: number; sn: string; takenBy: string;
  collectedDate: string; collectedTime: string;
};
export type Driver = { rowId: number; employeeId: number | null; code: string; name: string };

const field: React.CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)",
};
const labelStyle: React.CSSProperties = {
  display: "block", textAlign: "left", fontSize: 12, fontWeight: 700,
  color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.3, margin: "12px 0 4px",
};

// --- Taking a card out ------------------------------------------------------
export function TakeCardOut({ cards, drivers, people, busy, onCancel, onSubmit }: {
  cards: DrawerCard[];
  drivers: Driver[];
  people: Person[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: { cardId: number; driverId: number | null; driverName: string }) => void;
}) {
  // This vehicle's own card, since that is the one all but always being taken.
  const [cardId, setCardId] = useState<number | "">(() => cards.find(c => c.own)?.id ?? cards[0]?.id ?? "");
  // Drivers mostly take cards, but the CEO and others do too — hence a way out
  // of the vehicle's own short list.
  const [someoneElse, setSomeoneElse] = useState(drivers.length === 0);
  const [driverRow, setDriverRow] = useState<number | "">(() => (drivers.length === 1 ? drivers[0].rowId : ""));
  const [personId, setPersonId] = useState<number | "">("");
  const [typed, setTyped] = useState("");

  const chosen = drivers.find(d => d.rowId === driverRow);
  const person = people.find(p => p.id === personId);
  const ready = cardId !== "" && (someoneElse ? (personId !== "" || typed.trim() !== "") : driverRow !== "");

  const submit = () => {
    if (someoneElse) {
      onSubmit(person
        ? { cardId: Number(cardId), driverId: person.id, driverName: person.name }
        : { cardId: Number(cardId), driverId: null, driverName: typed.trim() });
    } else {
      onSubmit({ cardId: Number(cardId), driverId: chosen?.employeeId ?? null, driverName: chosen?.name ?? "" });
    }
  };

  if (cards.length === 0) {
    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 14, color: "#B45309", fontWeight: 600 }}>No card is free to hand out.</div>
        <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 6 }}>
          Every card is already out, or none has been added yet — the cards live on Station → PSO Cards.
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={onCancel}>← Back</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <span style={labelStyle}>Card</span>
      <select value={cardId} disabled={busy} onChange={e => setCardId(Number(e.target.value))} style={field}>
        {cards.map(c => (
          <option key={c.id} value={c.id}>
            {c.sn}{c.own ? " · this vehicle's" : c.vehicleNo ? ` · ${c.vehicleNo}` : ""}
          </option>
        ))}
      </select>

      <span style={labelStyle}>Taken by</span>
      {!someoneElse ? (
        <>
          {drivers.length === 1 ? (
            <div style={{ ...field, fontWeight: 700, textAlign: "left" }}>
              {drivers[0].code ? `${drivers[0].code} — ${drivers[0].name}` : drivers[0].name}
            </div>
          ) : (
            <select value={driverRow} disabled={busy} onChange={e => setDriverRow(Number(e.target.value))} style={field}>
              <option value="">— choose the driver —</option>
              {drivers.map(d => (
                <option key={d.rowId} value={d.rowId}>{d.code ? `${d.code} — ${d.name}` : d.name}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} disabled={busy}
            onClick={() => setSomeoneElse(true)}>
            Someone else takes it →
          </button>
        </>
      ) : (
        <>
          <select value={personId} disabled={busy} onChange={e => setPersonId(e.target.value ? Number(e.target.value) : "")} style={field}>
            <option value="">— anyone on staff —</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          {personId === "" && (
            <input value={typed} disabled={busy} onChange={e => setTyped(e.target.value)}
              placeholder="or type a name — e.g. Aamir (Purchaser)" style={{ ...field, marginTop: 8 }} />
          )}
          {drivers.length > 0 && (
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} disabled={busy}
              onClick={() => { setSomeoneElse(false); setPersonId(""); setTyped(""); }}>
              ← Back to this vehicle&apos;s drivers
            </button>
          )}
        </>
      )}

      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 12, textAlign: "left" }}>
        The date and time are taken from the clock. The slip&apos;s number, litres and rate go in when the card comes back.
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn" onClick={onCancel} disabled={busy} style={{ flex: "0 0 auto" }}>← Back</button>
        <button onClick={submit} disabled={busy || !ready}
          style={{
            flex: 1, padding: "16px 12px", fontSize: 16, fontWeight: 800, borderRadius: 12,
            border: "none", color: "#fff", background: "#4F46E5",
            cursor: busy ? "default" : "pointer", opacity: busy || !ready ? 0.6 : 1,
          }}>
          Take the card →
        </button>
      </div>
    </div>
  );
}

// --- Taking a card back ------------------------------------------------------
// The slip usually comes back with the card, so the fill can be written down
// here rather than chased up later on the PSO Cards tab. It stays optional: a
// card comes back having been filled several times, or not at all.
// No date or time on it: a fill is recorded against the card's collection,
// which the hand-over already holds — and which the Cards Logbook corrects.
// Asking again here only invited a second, different answer.
export type ReturnFuel = { slipNo: string; amount: string; notes: string };

export function ReturnCard({ card, busy, keepOut = false, onCancel, onConfirm }: {
  card: OpenCard;
  busy: boolean;
  /** Record a fill and leave the card where it is. A driver can fill up two,
   *  three, four times a day on one card before bringing it back, and each
   *  slip is its own record. */
  keepOut?: boolean;
  onCancel: () => void;
  onConfirm: (fuel: ReturnFuel | null) => void;
}) {
  const [slipNo, setSlipNo] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const hasFuel = amount.trim() !== "" && Number(amount) > 0;
  const amountTyped = amount.trim() !== "";
  const amountBad = amountTyped && !(Number(amount) > 0);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="card" style={{ textAlign: "left", padding: "12px 14px", marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Card <span style={{ fontFamily: "monospace" }}>{card.sn}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
          With {card.takenBy} · collected {card.collectedDate}{card.collectedTime ? ` at ${card.collectedTime}` : ""}
        </div>
      </div>

      <span style={labelStyle}>Fuel drawn <span style={{ textTransform: "none", fontWeight: 400, color: "var(--text3)" }}>(from the slip, if there is one)</span></span>

      <input value={slipNo} disabled={busy} onChange={e => setSlipNo(e.target.value)}
        placeholder="Slip no." style={field} />

      <input type="number" inputMode="decimal" step="any" value={amount} disabled={busy}
        onChange={e => setAmount(e.target.value)} placeholder="Fuel (PKR)"
        style={{ ...field, marginTop: 10, fontWeight: 700, borderColor: amountBad ? "#DC2626" : "var(--border)" }} />

      <input value={notes} disabled={busy} onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)" style={{ ...field, marginTop: 10 }} />

      <div style={{ fontSize: 11.5, color: "var(--text3)", textAlign: "left", marginTop: 10, lineHeight: 1.5 }}>
        {hasFuel
          ? keepOut
            ? `Saved as a fuel record — the card stays with ${card.takenBy}. Enter each slip on its own; they are all submitted when the card comes back.`
            : "Saved as a fuel record against this card, and submitted as it comes in."
          : keepOut
            ? "Enter the amount from the slip."
            : "Leave the amount blank if there is no slip — the card still goes back in, and the fuel can be entered later on Station → PSO Cards."}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn" onClick={onCancel} disabled={busy} style={{ flex: "0 0 auto" }}>← Back</button>
        <button
          onClick={() => onConfirm(hasFuel ? { slipNo, amount, notes } : null)}
          disabled={busy || amountBad || (keepOut && !hasFuel)}
          style={{
            flex: 1, padding: "16px 12px", fontSize: 16, fontWeight: 800, borderRadius: 12,
            border: "none", color: "#fff", background: keepOut ? "#B45309" : "#15803D",
            cursor: busy ? "default" : "pointer", opacity: busy || amountBad || (keepOut && !hasFuel) ? 0.6 : 1,
          }}>
          {keepOut ? "⛽ Save fuel record" : "← Card is back in"}
        </button>
      </div>
    </div>
  );
}
