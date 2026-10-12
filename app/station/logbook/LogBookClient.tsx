"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PrintLandscape from "@/components/PrintLandscape";
import PrintHeader from "@/components/PrintHeader";
import EditCell from "../EditCell";
import ScrollBox from "../ScrollBox";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import type { LogBookTrip, LogBookFuel } from "@/lib/fleetServer";
import type { Person } from "../VehicleTripForms";

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
  vehicles, people, vehicleId, month, trips, fuel, totals, readOnly, canDelete, onAddVehicle, filtersInHead = false,
}: {
  vehicles: VehicleRow[]; people: Person[]; vehicleId: number; month: string;
  trips: LogBookTrip[]; fuel: LogBookFuel[]; totals: Totals; readOnly: boolean; canDelete: boolean;
  /** Opens the All vehicles tab, from the empty state. */
  onAddVehicle?: () => void;
  /** The vehicle and month pickers are in the page's title line instead. */
  filtersInHead?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // An open trip's return time and closing reading, held until both are in:
  // the server keeps those two together, so neither can be saved alone.
  const [closing, setClosing] = useState<Record<number, { inTime: string; meterIn: string }>>({});

  const vehicle = vehicles.find(v => v.id === vehicleId);

  const go = (patch: { vehicle?: number; month?: string }) => {
    // Keeps the rest of the address (the tab) as it is.
    const p = new URLSearchParams(params.toString());
    p.set("tab", "logbook");
    p.set("vehicle", String(patch.vehicle ?? vehicleId));
    p.set("month", patch.month ?? month);
    router.push(`/station/vehicles?${p.toString()}`, { scroll: false });
  };


  // One field at a time, straight from its cell. Resolves false on failure so
  // the cell can put its old value back; the reason goes in the error bar.
  const saveTrip = async (id: number, patch: Record<string, unknown>): Promise<boolean> => {
    setErr("");
    try {
      const res = await fetch(`/api/fleet/trips/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      router.refresh();   // km covered and totals are worked out on the server
      return true;
    } catch (e: any) { setErr(e.message); return false; }
  };

  // Typed back as plain names: matching them to employees again would guess at
  // who was meant, and the printed page only ever shows names.
  const officersFrom = (text: string) =>
    text.split(",").map(x => x.trim()).filter(Boolean).map(name => ({ name }));

  // Closes an open trip once both halves are there.
  const tryClose = async (t: LogBookTrip) => {
    const c = closing[t.id];
    if (!c?.inTime || c.meterIn.trim() === "") return;
    const ok = await saveTrip(t.id, { inTime: c.inTime, meterIn: c.meterIn });
    if (ok) setClosing(prev => { const next = { ...prev }; delete next[t.id]; return next; });
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
      headers: ["Date", "Time From", "Time To", "Details of Journey", "Purpose", "Driver / Officer", "Meter From", "Meter To", "K.M. Covered", "Remarks"],
      colWidths: [11, 10, 10, 26, 22, 26, 11, 11, 12, 22],
      rows: trips.map(t => [
        bookDate(t.date), hm(t.outAt), hm(t.inAt), t.destination, t.purpose,
        [t.driver, ...ridingWith(t)].join(", "), t.meterOut, t.meterIn ?? "", t.kmCovered ?? "",
        t.remarks,
      ]),
    });
  };

  const colCount = readOnly ? 10 : 11;

  return (
    <div className="fade-up">
      <PrintLandscape />
      <PrintHeader
        title="Vehicle Log Book"
        subtitle={`${vehicle?.vehicleNo ?? ""}${vehicle?.name ? ` — ${vehicle.name}` : ""}`}
        meta={`${monthLabel(month)} · ${totals.km} km`}
      />

      {err && <div className="card no-print" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 12, fontSize: 13 }}>{err}</div>}

      {vehicles.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text2)" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>No vehicles yet</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
            Add one under{" "}
            <button type="button" onClick={onAddVehicle} disabled={!onAddVehicle}
              style={{ background: "none", border: "none", padding: 0, color: "var(--brand)", cursor: "pointer", font: "inherit" }}>
              All vehicles
            </button>{" "}
            and its log book starts here.
          </div>
        </div>
      ) : (
        <>
          {/* One row: which page of the book, what it adds up to, and its
              buttons — so the entries start as high up the screen as they can. */}
          <div className="no-print toolbar-row">
            {!filtersInHead && (
              <>
                <select value={vehicleId} onChange={e => go({ vehicle: Number(e.target.value) })} style={{ width: "auto", minWidth: 190 }}>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNo}{v.name ? ` — ${v.name}` : ""}{v.active ? "" : " (retired)"}
                    </option>
                  ))}
                </select>
                <input type="month" value={month} onChange={e => e.target.value && go({ month: e.target.value })} style={{ width: "auto" }} />
              </>
            )}
            {/* Only when something needs doing: a trip not yet closed. */}
            {totals.openTrips > 0 && <span className="mini-stat danger">Still out <b>{totals.openTrips}</b></span>}
            <span style={{ flex: 1 }} />
            <button className="btn btn-xs" onClick={() => window.print()}>🖨 Print</button>
            <button className="btn btn-xs" onClick={exportXlsx} disabled={!trips.length}>📊 Excel</button>
          </div>

          <ScrollBox>
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
                {trips.length === 0 && (
                  <tr><td colSpan={colCount + 1} style={{ color: "var(--text3)", padding: 22, textAlign: "center" }}>
                    Nothing recorded for {monthLabel(month)}.
                  </td></tr>
                )}

                {trips.map(t => {
                  const open = t.inAt === null;
                  const c = closing[t.id] ?? { inTime: "", meterIn: "" };
                  const setC = (patch: Partial<typeof c>) => setClosing(prev => ({ ...prev, [t.id]: { ...c, ...patch } }));
                  return (
                    <tr key={t.id}>
                      <td>
                        {/* Moving the day moves both times with it. */}
                        <EditCell type="date" value={t.date} minWidth={130} readOnly={readOnly} print={bookDate(t.date)}
                          onSave={v => saveTrip(t.id, { date: v, outTime: hm(t.outAt), inTime: hm(t.inAt) })} />
                      </td>
                      <td>
                        <EditCell type="time" value={hm(t.outAt)} minWidth={100} readOnly={readOnly}
                          onSave={v => saveTrip(t.id, { outTime: v })} />
                      </td>
                      <td>
                        {open && !readOnly ? (
                          <>
                            <input type="time" className="edit-cell no-print" value={c.inTime} style={{ minWidth: 100 }}
                              onChange={e => setC({ inTime: e.target.value })} onBlur={() => tryClose(t)} />
                            {!c.inTime && <div className="no-print" style={{ color: "#DC2626", fontWeight: 700, fontSize: 11, paddingLeft: 6 }}>out</div>}
                          </>
                        ) : open ? (
                          <span className="no-print" style={{ color: "#DC2626", fontWeight: 700 }}>out</span>
                        ) : (
                          <EditCell type="time" value={hm(t.inAt)} minWidth={100} readOnly={readOnly}
                            onSave={v => saveTrip(t.id, { inTime: v })} />
                        )}
                      </td>
                      <td>
                        <EditCell value={t.destination} minWidth={150} readOnly={readOnly} placeholder="—"
                          onSave={v => saveTrip(t.id, { destination: v })} />
                      </td>
                      <td>
                        <EditCell value={t.purpose} minWidth={130} readOnly={readOnly} placeholder="—"
                          onSave={v => saveTrip(t.id, { purpose: v })} />
                      </td>
                      <td>
                        {/* The driver comes from the gate; who rode along is editable. */}
                        <div style={{ fontWeight: 600, paddingLeft: readOnly ? 0 : 6 }}>{t.driver}</div>
                        <EditCell value={ridingWith(t).join(", ")} minWidth={150} readOnly={readOnly}
                          placeholder="+ who else went"
                          print={ridingWith(t).length ? <div style={{ fontSize: 11.5 }}>with {ridingWith(t).join(", ")}</div> : null}
                          onSave={v => saveTrip(t.id, { officers: officersFrom(v) })} />
                      </td>
                      <td className="num">
                        <EditCell type="number" value={String(t.meterOut)} minWidth={95} align="right" readOnly={readOnly}
                          onSave={v => saveTrip(t.id, { meterOut: v })} />
                      </td>
                      <td className="num">
                        {open && !readOnly ? (
                          <input type="number" className="edit-cell no-print" value={c.meterIn} placeholder="—"
                            style={{ minWidth: 95, textAlign: "right" }}
                            onChange={e => setC({ meterIn: e.target.value })} onBlur={() => tryClose(t)} />
                        ) : (
                          <EditCell type="number" value={t.meterIn === null ? "" : String(t.meterIn)} minWidth={95}
                            align="right" readOnly={readOnly || open}
                            onSave={v => saveTrip(t.id, { meterIn: v })} />
                        )}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>{t.kmCovered ?? ""}</td>
                      {/* Signed in ink once the page is printed and filed. */}
                      <td />
                      <td>
                        <EditCell value={t.remarks} minWidth={140} readOnly={readOnly} placeholder="—"
                          onSave={v => saveTrip(t.id, { remarks: v })} />
                      </td>
                      {!readOnly && (
                        <td className="no-print">
                          {canDelete && <button className="btn btn-sm btn-restricted" disabled={busy} onClick={() => remove(t)}>Delete</button>}
                        </td>
                      )}
                    </tr>
                  );
                })}

              </tbody>
              {trips.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={8} style={{ textAlign: "right" }}>Total</td>
                    <td className="num">{totals.km}</td>
                    <td colSpan={readOnly ? 2 : 3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollBox>

        </>
      )}
    </div>
  );
}

