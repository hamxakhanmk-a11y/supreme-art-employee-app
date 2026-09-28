"use client";
import { useCallback, useEffect, useState } from "react";
import type { Person } from "./PsoClient";

// Handing a card to a driver. The card list is loaded here rather than passed
// down, so it reflects what's actually in the drawer at the moment of issuing
// — a card taken out a minute ago should not still be offered.

type Card = {
  id: number; sn: string; vehicleNo: string | null; status: string;
  out: { driver: string; since: string } | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function IssueCardForm({
  people, onCancel, onSaved, onError,
}: {
  people: Person[];
  onCancel: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [cardId, setCardId] = useState<number | "">("");
  const [driverId, setDriverId] = useState<number | "">("");
  const [driverName, setDriverName] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet/cards", { cache: "no-store" });
      if (res.ok) setCards(await res.json());
    } catch { /* the select simply stays empty */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // In the drawer, and not written off.
  const available = cards.filter(c => !c.out && c.status !== "blocked" && c.status !== "lost");
  const picked = available.find(c => c.id === cardId);
  const ready = cardId !== "" && date && (driverId !== "" || driverName.trim());

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/fleet/card-issues", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId, driverId: driverId || null, driverName: driverId ? "" : driverName.trim(),
          collectedDate: date, collectedTime: time, notes,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not issue the card");
      onSaved();
    } catch (e: any) { onError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card no-print" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Issue a card</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
          Card *
          <select value={cardId} onChange={e => setCardId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— choose a card —</option>
            {available.map(c => (
              <option key={c.id} value={c.id}>{c.sn}{c.vehicleNo ? ` · ${c.vehicleNo}` : ""}</option>
            ))}
          </select>
          {available.length === 0 && (
            <span style={{ display: "block", fontWeight: 400, fontSize: 11, color: "#B45309", marginTop: 3 }}>
              {cards.length === 0 ? "No cards yet — add them under Card Maintenance." : "Every card is already out."}
            </span>
          )}
          {picked?.vehicleNo && (
            <span style={{ display: "block", fontWeight: 400, fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
              Recorded against {picked.vehicleNo}
            </span>
          )}
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
          Driver
          <select value={driverId} onChange={e => setDriverId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">— someone else —</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </label>

        {driverId === "" && (
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
            Name *
            <input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="e.g. Aamir (Purchaser)" />
          </label>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
          Collection date *
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
          Collection time
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", gridColumn: "1 / -1" }}>
          Notes
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 9370 card to (884) BMG" />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || !ready}>{busy ? "Saving…" : "Issue card"}</button>
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        The rupees and litres are filled in when the card comes back — press Submit on its row.
      </div>
    </div>
  );
}
