"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CardsPanel from "./CardsPanel";

// PSO Cards: where the cards are. The ones out with someone sit at the top,
// because they are the ones that need something done — a fuel record entered,
// or the card taken back. The full list is underneath.
//
// Recording fuel says nothing about the card coming back: it stays with whoever
// has it until it is handed in.

type VehicleRow = { id: number; vehicleNo: string; name: string | null; active: boolean };
type Person = { id: number; code: string; name: string };
type Card = {
  id: number; sn: string; vehicleId: number | null; vehicleNo: string | null;
  status: string; notes: string;
  out: { driver: string; since: string | null } | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function PsoCardsClient({
  vehicles, people, readOnly,
}: { vehicles: VehicleRow[]; people: Person[]; readOnly: boolean }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fuelFor, setFuelFor] = useState<number | null>(null);
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/cards", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load the cards");
      setCards(j); setErr("");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const out = cards.filter(c => c.out);

  const handBack = async (c: Card) => {
    if (!confirm(`Take card ${c.sn} back from ${c.out?.driver}?`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/cards/hand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: c.id, action: "return" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not take it back");
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>💳 PSO Cards</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Where every card is. Cards are handed out at the Station terminal on the vehicle&apos;s PIN;
            the fuel drawn on them is recorded here and listed on <Link href="/station/cards-log" style={{ color: "var(--brand)" }}>Cards Logbook</Link>.
          </p>
        </div>
        <Link href="/station/cards-log" className="btn btn-sm">📋 Cards Logbook</Link>
      </div>

      {err && <div className="card" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 14, fontSize: 13 }}>{err}</div>}
      {saved && <div className="card" style={{ borderColor: "#15803D", color: "#15803D", marginBottom: 14, fontSize: 13 }}>{saved}</div>}

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>
        Out with someone {out.length > 0 && <span style={{ color: "var(--text3)", fontWeight: 400 }}>({out.length})</span>}
      </h2>

      {loading ? (
        <div className="card" style={{ color: "var(--text3)", fontSize: 13 }}>Loading…</div>
      ) : out.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "26px 20px", color: "var(--text2)" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Every card is in the drawer</div>
          <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 4 }}>
            Hand one out at the Station terminal — type the vehicle&apos;s PIN and choose &ldquo;Take the fuel card&rdquo;.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {out.map(c => (
            <div key={c.id} className="card" style={{ borderLeft: "4px solid #B45309", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace" }}>{c.sn}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 2 }}>
                    With <strong style={{ color: "var(--text)" }}>{c.out!.driver}</strong>
                    {c.out!.since ? ` since ${c.out!.since}` : ""}
                    {c.vehicleNo ? ` · ${c.vehicleNo}` : ""}
                  </div>
                </div>
                {!readOnly && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-sm btn-primary" disabled={busy}
                      onClick={() => { setFuelFor(fuelFor === c.id ? null : c.id); setSaved(""); setErr(""); }}>
                      {fuelFor === c.id ? "Cancel" : "+ Record fuel"}
                    </button>
                    <button className="btn btn-sm" disabled={busy} onClick={() => handBack(c)}>Take card back</button>
                  </div>
                )}
              </div>

              {fuelFor === c.id && !readOnly && (
                <FuelRecordForm
                  card={c} people={people} vehicles={vehicles}
                  onCancel={() => setFuelFor(null)}
                  onSaved={msg => { setFuelFor(null); setSaved(msg); }}
                  onError={setErr}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <CardsPanel vehicles={vehicles} readOnly={readOnly} onChanged={load} />
    </div>
  );
}

// One fill: what the slip says, and when it came in. The card is unaffected —
// it stays with whoever has it.
function FuelRecordForm({
  card, people, vehicles, onCancel, onSaved, onError,
}: {
  card: Card; people: Person[]; vehicles: VehicleRow[];
  onCancel: () => void; onSaved: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [collectedDate, setCollectedDate] = useState(today());
  const [collectedTime, setCollectedTime] = useState("");
  const [slipNo, setSlipNo] = useState("");
  const [amount, setAmount] = useState("");
  const [driverId, setDriverId] = useState<number | "">("");
  const [vehicleId, setVehicleId] = useState<number | "">(card.vehicleId ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/fleet/card-issues", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          vehicleId: vehicleId || null,
          // Blank means whoever is holding the card, which is the usual case.
          driverId: driverId || null,
          collectedDate, collectedTime,
          slipNo, amount, notes,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save the record");
      onSaved(`Fuel recorded on ${card.sn} — the card stays with ${card.out?.driver}.`);
    } catch (e: any) { onError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Field label="Collection date *"><input type="date" value={collectedDate} onChange={e => setCollectedDate(e.target.value)} /></Field>
        <Field label="Collection time"><input type="time" value={collectedTime} onChange={e => setCollectedTime(e.target.value)} /></Field>

        <Field label="Slip no."><input value={slipNo} onChange={e => setSlipNo(e.target.value)} placeholder="from the bill slip" /></Field>
        <Field label="Fuel (PKR) *"><input type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Drawn by">
          <select value={driverId} onChange={e => setDriverId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">{card.out?.driver} (holding it)</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </Field>
        <Field label="Vehicle">
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">—</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
          </select>
        </Field>
        <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></Field>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || !collectedDate || !Number(amount)}>
          {busy ? "Saving…" : "Save record"}
        </button>
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <span style={{ fontSize: 11.5, color: "var(--text3)" }}>
          The card stays with {card.out?.driver}, so this stays pending until it comes back.
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>{label}{children}</label>;
}
