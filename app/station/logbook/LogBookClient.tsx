"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PrintLandscape from "@/components/PrintLandscape";
import PrintHeader from "@/components/PrintHeader";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import type { LogBookTrip, LogBookFuel } from "@/lib/fleetServer";
import type { Person } from "../VehicleTripForms";
import FuelPanel from "./FuelPanel";

type VehicleRow = { id: number; vehicleNo: string; name: string | null; active: boolean };
type Totals = { km: number; litres: number; cost: number; average: number | null; openTrips: number };

// "2026-09-01" → "01/09/26", the way the book writes it.
function bookDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}
// ISO → "10:10" on the Karachi clock, matching the times written in the book.
function hm(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" });
}
// Officers other than the driver — the same person named twice in one cell
// reads like a mistake rather than a fact.
function ridingWith(t: { driver: string; officers: string[] }) {
  const d = t.driver.trim().toLowerCase();
  return t.officers.filter(o => {
    const name = o.trim().toLowerCase();
    // Officers picked from the staff list carry their code ("SAPL-65 — Fazal
    // Rabi"), while the driver is stored as a bare name, so compare on the
    // part after the dash as well.
    const bare = name.includes("—") ? name.split("—").slice(1).join("—").trim() : name;
    return name !== d && bare !== d;
  });
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function LogBookClient({
  vehicles, people, vehicleId, month, trips, fuel, totals, readOnly, canDelete,
}: {
  vehicles: VehicleRow[]; people: Person[]; vehicleId: number; month: string;
  trips: LogBookTrip[]; fuel: LogBookFuel[]; totals: Totals; readOnly: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const vehicle = vehicles.find(v => v.id === vehicleId);

  const go = (patch: { vehicle?: number; month?: string }) => {
    const p = new URLSearchParams({ vehicle: String(patch.vehicle ?? vehicleId), month: patch.month ?? month });
    router.push(`/station/logbook?${p.toString()}`);
  };

  // Litres drawn on a given day, printed in the book's P.O.L. column.
  const polOn = (date: string) => {
    const l = fuel.filter(f => f.date === date).reduce((s, f) => s + f.litres, 0);
    return l > 0 ? `${Math.round(l * 100) / 100} L` : "";
  };
  // Fuel drawn on days with no journey still belongs on the page — the book has
  // those rows too, written between the trips.
  const fuelOnlyDays = Array.from(new Set(
    fuel.map(f => f.date).filter(d => !trips.some(t => t.date === d))
  )).sort();

  const startEdit = (t: LogBookTrip) => {
    setErr("");
    setEditId(t.id);
    setDraft({
      date: t.date, outTime: hm(t.outAt), inTime: hm(t.inAt),
      meterOut: String(t.meterOut), meterIn: t.meterIn === null ? "" : String(t.meterIn),
      destination: t.destination, purpose: t.purpose, remarks: t.remarks,
      officers: t.officers.join(", "),
    });
  };

  const saveEdit = async (id: number) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/fleet/trips/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          // Typed back as plain names: matching them to employees again would
          // guess at who was meant, and the printed page only ever shows names.
          officers: draft.officers.split(",").map(s => s.trim()).filter(Boolean).map(name => ({ name })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setEditId(null);
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (t: LogBookTrip) => {
    if (!confirm(`Delete the trip of ${bookDate(t.date)} — ${t.destination || "no destination"}? This can't be undone.`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/fleet/trips/${t.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not delete");
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const exportXlsx = async () => {
    await downloadRegisterXlsx({
      filename: `log-book-${vehicle?.vehicleNo ?? "vehicle"}-${month}.xlsx`,
      sheetName: month,
      title: `Log Book — ${vehicle?.vehicleNo ?? ""} — ${monthLabel(month)}`,
      headers: ["Date", "Time From", "Time To", "Details of Journey", "Purpose", "Driver / Officer", "Meter From", "Meter To", "K.M. Covered", "P.O.L. Drawn", "Remarks"],
      colWidths: [11, 10, 10, 26, 22, 26, 11, 11, 12, 12, 22],
      rows: trips.map(t => [
        bookDate(t.date), hm(t.outAt), hm(t.inAt), t.destination, t.purpose,
        [t.driver, ...ridingWith(t)].join(", "), t.meterOut, t.meterIn ?? "", t.kmCovered ?? "",
        polOn(t.date), t.remarks,
      ]),
    });
  };

  const colCount = readOnly ? 11 : 12;

  return (
    <div className="fade-up">
      <PrintLandscape />
      <PrintHeader
        title="Vehicle Log Book"
        subtitle={`${vehicle?.vehicleNo ?? ""}${vehicle?.name ? ` — ${vehicle.name}` : ""}`}
        meta={`${monthLabel(month)} · ${totals.km} km · ${totals.litres} L · Average ${totals.average ?? "—"} km/L`}
      />

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🚐 Vehicle Log Book</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            One page per vehicle per month, as the book has it. Rows come from the gate terminal and can be corrected here.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={() => window.print()}>🖨 Print</button>
          <button className="btn btn-sm" onClick={exportXlsx} disabled={!trips.length}>📊 Excel</button>
          <Link href="/station" className="btn btn-sm">🏭 Terminal</Link>
        </div>
      </div>

      {err && <div className="card no-print" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 12, fontSize: 13 }}>{err}</div>}

      {vehicles.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text2)" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>No vehicles yet</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
            Add one under <Link href="/station/vehicles" style={{ color: "var(--brand)" }}>Station → Vehicles</Link> and its log book starts here.
          </div>
        </div>
      ) : (
        <>
          <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <select value={vehicleId} onChange={e => go({ vehicle: Number(e.target.value) })} style={{ width: "auto", minWidth: 200 }}>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNo}{v.name ? ` — ${v.name}` : ""}{v.active ? "" : " (retired)"}
                </option>
              ))}
            </select>
            <input type="month" value={month} onChange={e => e.target.value && go({ month: e.target.value })} style={{ width: "auto" }} />
          </div>

          {/* The figures written at the top of the paper page. */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <Stat label="K.M. covered" value={`${totals.km} km`} />
            <Stat label="P.O.L. drawn" value={`${totals.litres} L`} />
            <Stat label="Average to litre" value={totals.average === null ? "—" : `${totals.average} km/L`} hint={totals.average === null ? "no fuel recorded" : undefined} />
            <Stat label="Fuel cost" value={totals.cost ? `Rs ${totals.cost.toLocaleString("en-PK")}` : "—"} />
            {totals.openTrips > 0 && <Stat label="Still out" value={String(totals.openTrips)} danger />}
          </div>

          <div className="card" style={{ padding: 0, overflow: "auto" }}>
            <table style={{ fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th rowSpan={2}>Date</th>
                  <th colSpan={2} style={{ textAlign: "center" }}>Time</th>
                  <th rowSpan={2}>Details of Journey</th>
                  <th rowSpan={2}>Purpose</th>
                  <th rowSpan={2}>Driver / Officer</th>
                  <th colSpan={2} style={{ textAlign: "center" }}>Meter Reading</th>
                  <th rowSpan={2} className="num">K.M.</th>
                  <th rowSpan={2}>P.O.L.</th>
                  <th rowSpan={2}>Signature</th>
                  <th rowSpan={2}>Remarks</th>
                  {!readOnly && <th rowSpan={2} className="no-print" style={{ width: 120 }}>Actions</th>}
                </tr>
                <tr>
                  <th style={{ fontWeight: 400 }}>From</th>
                  <th style={{ fontWeight: 400 }}>To</th>
                  <th style={{ fontWeight: 400 }}>From</th>
                  <th style={{ fontWeight: 400 }}>To</th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 && fuelOnlyDays.length === 0 && (
                  <tr><td colSpan={colCount + 1} style={{ color: "var(--text3)", padding: 22, textAlign: "center" }}>
                    Nothing recorded for {monthLabel(month)}.
                  </td></tr>
                )}

                {trips.map(t => editId === t.id ? (
                  <tr key={t.id} className="no-print">
                    <td><input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></td>
                    <td><input type="time" value={draft.outTime} onChange={e => setDraft({ ...draft, outTime: e.target.value })} /></td>
                    <td><input type="time" value={draft.inTime} onChange={e => setDraft({ ...draft, inTime: e.target.value })} /></td>
                    <td><input value={draft.destination} onChange={e => setDraft({ ...draft, destination: e.target.value })} /></td>
                    <td><input value={draft.purpose} onChange={e => setDraft({ ...draft, purpose: e.target.value })} /></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 3 }}>{t.driver}</div>
                      <input value={draft.officers} onChange={e => setDraft({ ...draft, officers: e.target.value })} placeholder="officers, comma separated" />
                    </td>
                    <td><input type="number" value={draft.meterOut} onChange={e => setDraft({ ...draft, meterOut: e.target.value })} /></td>
                    <td><input type="number" value={draft.meterIn} onChange={e => setDraft({ ...draft, meterIn: e.target.value })} placeholder="blank = still out" /></td>
                    <td className="num" style={{ color: "var(--text3)" }}>auto</td>
                    <td>{polOn(t.date)}</td>
                    <td />
                    <td><input value={draft.remarks} onChange={e => setDraft({ ...draft, remarks: e.target.value })} /></td>
                    <td className="no-print">
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => saveEdit(t.id)}>Save</button>
                        <button className="btn btn-sm" disabled={busy} onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{bookDate(t.date)}</td>
                    <td>{hm(t.outAt)}</td>
                    <td>{t.inAt ? hm(t.inAt) : <span className="no-print" style={{ color: "#DC2626", fontWeight: 700 }}>out</span>}</td>
                    <td>{t.destination || "—"}</td>
                    <td>{t.purpose || "—"}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.driver}</div>
                      {ridingWith(t).length > 0 && (
                        <div style={{ fontSize: 11.5, color: "var(--text2)", marginTop: 1 }}>with {ridingWith(t).join(", ")}</div>
                      )}
                    </td>
                    <td className="num">{t.meterOut}</td>
                    <td className="num">{t.meterIn ?? ""}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{t.kmCovered ?? ""}</td>
                    <td>{polOn(t.date)}</td>
                    {/* Signed in ink once the page is printed and filed. */}
                    <td />
                    <td style={{ color: "var(--text2)" }}>{t.remarks}</td>
                    {!readOnly && (
                      <td className="no-print">
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" disabled={busy} onClick={() => startEdit(t)}>Edit</button>
                          {canDelete && <button className="btn btn-sm" style={{ color: "#A32D2D" }} disabled={busy} onClick={() => remove(t)}>Delete</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {fuelOnlyDays.map(d => (
                  <tr key={`fuel-${d}`} style={{ background: "var(--bg2)" }}>
                    <td style={{ whiteSpace: "nowrap" }}>{bookDate(d)}</td>
                    <td colSpan={5} style={{ color: "var(--text2)", fontStyle: "italic" }}>P.O.L. drawn — no journey</td>
                    <td className="num">{fuel.find(f => f.date === d)?.meterReading ?? ""}</td>
                    <td /><td />
                    <td style={{ fontWeight: 700 }}>{polOn(d)}</td>
                    <td /><td />
                    {!readOnly && <td className="no-print" />}
                  </tr>
                ))}
              </tbody>
              {trips.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={8} style={{ textAlign: "right" }}>Total</td>
                    <td className="num">{totals.km}</td>
                    <td>{totals.litres ? `${totals.litres} L` : ""}</td>
                    <td colSpan={readOnly ? 2 : 3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <FuelPanel
            vehicleId={vehicleId} month={month} fuel={fuel} people={people}
            readOnly={readOnly} canDelete={canDelete} onChanged={() => router.refresh()}
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className="card" style={{ padding: "10px 16px", minWidth: 130, borderLeft: `4px solid ${danger ? "#DC2626" : "var(--brand)"}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, color: danger ? "#DC2626" : "var(--text)" }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: "var(--text3)" }}>{hint}</div>}
    </div>
  );
}
