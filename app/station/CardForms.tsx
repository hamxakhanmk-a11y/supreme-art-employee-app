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

// --- Bringing a card back ---------------------------------------------------
export function SubmitCard({ card, busy, onCancel, onSubmit }: {
  card: OpenCard;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: { id: number; submittedDate: string; submittedTime: string; slipNo: string; litres: string; rate: string; amount: string }) => void;
}) {
  const [slipNo, setSlipNo] = useState("");
  const [litres, setLitres] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [touchedAmount, setTouchedAmount] = useState(false);

  // Litres × rate is what the slip adds up to. Left editable, because slips
  // round and the printed total is the one that counts.
  const recalc = (l: string, r: string) => {
    if (touchedAmount) return;
    const L = parseFloat(l), R = parseFloat(r);
    if (isFinite(L) && isFinite(R) && L > 0 && R > 0) setAmount(String(Math.round(L * R * 100) / 100));
  };

  const now = new Date();
  const ready = amount.trim() !== "" && Number(amount) > 0;

  return (
    <div style={{ marginTop: 8 }}>
      <div className="card" style={{ textAlign: "left", padding: "12px 14px", marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Card <span style={{ fontFamily: "monospace" }}>{card.sn}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
          With {card.takenBy} since {card.collectedDate}{card.collectedTime ? ` ${card.collectedTime}` : ""}
        </div>
      </div>

      <span style={labelStyle}>Slip no.</span>
      <input value={slipNo} disabled={busy} onChange={e => setSlipNo(e.target.value)} placeholder="the number on the bill slip" style={field} />

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Litres</span>
          <input type="number" inputMode="decimal" step="any" value={litres} disabled={busy}
            onChange={e => { setLitres(e.target.value); recalc(e.target.value, rate); }} placeholder="0.0" style={field} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Rate</span>
          <input type="number" inputMode="decimal" step="any" value={rate} disabled={busy}
            onChange={e => { setRate(e.target.value); recalc(litres, e.target.value); }} placeholder="per litre" style={field} />
        </div>
      </div>

      <span style={labelStyle}>Amount (PKR) *</span>
      <input type="number" inputMode="decimal" step="any" value={amount} disabled={busy}
        onChange={e => { setAmount(e.target.value); setTouchedAmount(true); }} placeholder="0" style={{ ...field, fontWeight: 700 }} />
      {!litres && (
        <div style={{ textAlign: "left", fontSize: 11.5, color: "#B45309", marginTop: 6 }}>
          Without litres the log book&apos;s P.O.L. column stays blank and this fuel has no km/litre average.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn" onClick={onCancel} disabled={busy} style={{ flex: "0 0 auto" }}>← Back</button>
        <button
          onClick={() => onSubmit({
            id: card.issueId,
            submittedDate: now.toISOString().slice(0, 10),
            submittedTime: now.toTimeString().slice(0, 5),
            slipNo, litres, rate, amount,
          })}
          disabled={busy || !ready}
          style={{
            flex: 1, padding: "16px 12px", fontSize: 16, fontWeight: 800, borderRadius: 12,
            border: "none", color: "#fff", background: "#15803D",
            cursor: busy ? "default" : "pointer", opacity: busy || !ready ? 0.6 : 1,
          }}>
          ← Submit the card
        </button>
      </div>
    </div>
  );
}
