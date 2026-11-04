"use client";
import { useMemo, useState } from "react";
import { usePageState } from "@/lib/usePageState";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PrintLandscape from "@/components/PrintLandscape";
import PrintHeader from "@/components/PrintHeader";
import EditCell from "../EditCell";
import ScrollBox from "../ScrollBox";
import StatChip from "../StatChip";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import type { PsoRow } from "@/lib/fleetServer";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { matchesQuery, cmpText } from "@/lib/listTools";

type RegSort = "listed" | "driver" | "vehicle" | "card" | "amount" | "pending";
const SORT_OPTIONS: SortOption<RegSort>[] = [
  { value: "listed", label: "Collection date (as listed)" },
  { value: "driver", label: "Driver (A–Z)" },
  { value: "vehicle", label: "Vehicle" },
  { value: "card", label: "Card SN" },
  { value: "amount", label: "Fuel (most first)" },
  { value: "pending", label: "Pending first" },
];

const LBL: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text2)", letterSpacing: 0.4, textTransform: "uppercase" };



type VehicleRow = { id: number; vehicleNo: string; name: string | null; active: boolean };
export type Person = { id: number; code: string; name: string };
/** Opened from a Monthly Report consumption: what it counted, and the way back. */
export type LogbookFocus = { label: string; back: string | null };

function fmt(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}
const rupees = (n: number | null) => (n === null ? "" : `Rs ${n.toLocaleString("en-PK")}`);

export default function RegisterClient({
  rows, vehicles, people, from, to, readOnly, canDelete, focus = null,
}: {
  rows: PsoRow[]; vehicles: VehicleRow[]; people: Person[];
  from: string; to: string; readOnly: boolean; canDelete: boolean;
  focus?: LogbookFocus | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [search, setSearch] = usePageState("logbook.q", "");

  // Keeps the rest of the page's address — the tab, and the day the cards
  // above are showing — so moving the range doesn't move anything else.
  const params = useSearchParams();
  const go = (patch: { from?: string; to?: string }) => {
    const p = new URLSearchParams(params.toString());
    p.set("tab", "logbook");
    p.set("from", patch.from ?? from);
    p.set("to", patch.to ?? to);
    router.push(`/station/pso?${p.toString()}`, { scroll: false });
  };

  const [sort, setSort] = usePageState<RegSort>("logbook.sort", "listed");

  const shown = useMemo(() => {
    const found = rows.filter(r => matchesQuery(search, [r.sn, r.driver, r.vehicleNo, r.notes, r.slipNo]));
    // "listed" is the order the server sends; the rest re-order a copy.
    const cmp: Record<RegSort, (a: PsoRow, b: PsoRow) => number> = {
      listed: () => 0,
      driver: (a, b) => cmpText(a.driver, b.driver),
      vehicle: (a, b) => cmpText(a.vehicleNo, b.vehicleNo),
      card: (a, b) => cmpText(a.sn, b.sn),
      amount: (a, b) => (b.amount ?? 0) - (a.amount ?? 0),
      pending: (a, b) => Number(!!a.submittedDate) - Number(!!b.submittedDate),
    };
    return sort === "listed" ? found : [...found].sort(cmp[sort]);
  }, [rows, search, sort]);

  const totalAmount = shown.reduce((s, r) => s + (r.amount ?? 0), 0);

  // One field at a time, straight from its cell. Resolves false on failure so
  // the cell can put its old value back; the reason goes in the error bar.
  const saveRecord = async (id: number, patch: Record<string, unknown>): Promise<boolean> => {
    setErr("");
    try {
      const res = await fetch("/api/fleet/card-issues", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      router.refresh();   // totals come from the server
      return true;
    } catch (e: any) { setErr(e.message); return false; }
  };

  const remove = async (r: PsoRow, reverse = false) => {
    if (!confirm(reverse
      ? `Reverse the entry for card ${r.sn} collected ${fmt(r.collectedDate)}? It is taken out, and the fuel it recorded goes with it, so the card's balance goes back. The Activity Log keeps a record.`
      : `Delete the entry for card ${r.sn} collected ${fmt(r.collectedDate)}? Any fuel it recorded goes with it.`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/fleet/card-issues?id=${r.id}${reverse ? "&reverse=1" : ""}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not delete");
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const exportXlsx = async () => {
    await downloadRegisterXlsx({
      filename: `pso-card-register-${from}-to-${to}.xlsx`,
      sheetName: "PSO Cards",
      title: `PSO Card Register — ${fmt(from)} to ${fmt(to)}`,
      headers: ["Sr No", "Driver Name", "Veh No.", "Collection Date", "Collection Time", "Date submitted", "Time submitted", "Card SN", "Slip No.", "Fuel (PKR)", "Notes"],
      colWidths: [7, 24, 12, 15, 14, 15, 14, 16, 14, 13, 26],
      rows: shown.map((r, i) => [
        i + 1, r.driver, r.vehicleNo, fmt(r.collectedDate), r.collectedTime,
        fmt(r.submittedDate), r.submittedTime, r.sn, r.slipNo, r.amount ?? "", r.notes,
      ]),
    });
  };

  const cols = readOnly ? 10 : 11;

  return (
    <div className="fade-up">
      <PrintLandscape />
      <PrintHeader title="PSO Cards — Fuel Logbook" meta={`${fmt(from)} to ${fmt(to)} · ${shown.length} entries · ${rupees(totalAmount)}`} />

      {/* One row, so the entries start as high up the screen as they can: the
          counts, search and sort, the date range, and Print and Excel together at the right. */}
      <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <StatChip label="Entries" value={shown.length} />
          <StatChip label="Fuel" value={rupees(totalAmount)} color="var(--primary)" bg="var(--primary-soft)" />
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox value={search} onChange={setSearch} placeholder="🔍  Search SN, driver, vehicle, slip…" width={210} />
          <SortBy options={SORT_OPTIONS} value={sort} onChange={setSort} minWidth={165} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={LBL}>From</span>
          <input type="date" value={from} onChange={e => e.target.value && go({ from: e.target.value })} style={{ width: 138 }} />
          <span style={LBL}>To</span>
          <input type="date" value={to} onChange={e => e.target.value && go({ to: e.target.value })} style={{ width: 138 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          <button className="btn btn-print" onClick={() => window.print()}>🖨 Print</button>
          <button className="btn btn-primary" onClick={exportXlsx} disabled={!shown.length}>⬇ Excel</button>
        </div>
      </div>

      {err && <div className="card no-print" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 12, fontSize: 13 }}>{err}</div>}

      {focus && (
        // The rows behind a Monthly Report figure. They're placed by the day
        // each was entered, as the report counts them — not by collection
        // date, which is how the logbook normally reads.
        <div className="card no-print" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          marginBottom: 12, padding: "8px 12px", borderLeft: "4px solid var(--brand)", fontSize: 13 }}>
          <span>
            Fuel the Monthly Report counted for <strong>{focus.label}</strong> — entered {fmt(from)} to {fmt(to)} ·{" "}
            <strong>{rupees(totalAmount)}</strong>
          </span>
          <span style={{ flex: 1 }} />
          {focus.back && <Link href={`/station/monthly?month=${focus.back}`} className="btn btn-back btn-xs">← Back to Monthly Report</Link>}
          <Link href={`/station/pso?${new URLSearchParams({ tab: "logbook", from, to })}`} className="btn btn-xs">Show all</Link>
        </div>
      )}

      <ScrollBox>
        <table className="fit-book">
          <thead>
            <tr>
              <th>Sr</th><th>Driver Name</th><th>Veh No.</th>
              <th>Collection Date</th><th>Time</th>
              <th>Date submitted</th><th>Time</th>
              <th>Card / Slip</th><th className="num">Fuel (PKR)</th><th>Notes</th>
              {!readOnly && <th className="no-print" style={{ width: 70 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={cols} style={{ color: "var(--text3)", padding: 22, textAlign: "center" }}>
                No entries in this range.
              </td></tr>
            )}
            {shown.map((r, i) => (
              <tr key={r.id} style={!r.submittedDate ? { background: "#FFFBEB" } : undefined}>
                <td style={{ color: "#bbb" }}>{i + 1}</td>
                <td>
                  {/* Typing a name here records it as typed: matching it back to an
                      employee would be a guess. */}
                  <EditCell value={r.driver === "—" ? "" : r.driver} minWidth={90} bold readOnly={readOnly} placeholder="—"
                    onSave={v => saveRecord(r.id, { driverId: null, driverName: v })} />
                </td>
                <td>
                  {readOnly ? <span style={{ fontFamily: "monospace" }}>{r.vehicleNo}</span> : (
                    <>
                      <select className="edit-cell no-print" value={r.vehicleId ?? ""} style={{ minWidth: 80, fontFamily: "monospace" }}
                        onChange={e => saveRecord(r.id, { vehicleId: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">—</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
                      </select>
                      <span className="print-only" style={{ fontFamily: "monospace" }}>{r.vehicleNo}</span>
                    </>
                  )}
                </td>
                <td>
                  <EditCell type="date" value={r.collectedDate} minWidth={125} readOnly={readOnly} print={fmt(r.collectedDate)}
                    onSave={v => saveRecord(r.id, { collectedDate: v })} />
                </td>
                <td>
                  <EditCell type="time" value={r.collectedTime} minWidth={84} readOnly={readOnly}
                    onSave={v => saveRecord(r.id, { collectedTime: v })} />
                </td>
                <td>
                  <EditCell type="date" value={r.submittedDate ?? ""} minWidth={125} readOnly={readOnly}
                    print={r.submittedDate ? fmt(r.submittedDate) : "pending"}
                    onSave={v => saveRecord(r.id, { submittedDate: v })} />
                  {!r.submittedDate && (
                    <div className="no-print" style={{ color: "#B45309", fontWeight: 700, fontSize: 11, paddingLeft: readOnly ? 0 : 6 }}
                      title="The card is still out — records are submitted when it comes back">pending</div>
                  )}
                </td>
                <td>
                  <EditCell type="time" value={r.submittedTime} minWidth={84} readOnly={readOnly || !r.submittedDate}
                    onSave={v => saveRecord(r.id, { submittedTime: v })} />
                </td>
                <td>
                  <div style={{ fontFamily: "monospace", paddingLeft: readOnly ? 0 : 6 }}>{r.sn}</div>
                  <EditCell value={r.slipNo} minWidth={80} readOnly={readOnly} placeholder="slip no."
                    print={r.slipNo ? <div style={{ fontSize: 11 }}>slip {r.slipNo}</div> : null}
                    onSave={v => saveRecord(r.id, { slipNo: v })} />
                </td>
                <td className="num">
                  <EditCell type="number" value={r.amount === null ? "" : String(r.amount)} minWidth={80} align="right" bold
                    readOnly={readOnly} print={r.amount === null ? "" : r.amount.toLocaleString("en-PK")}
                    onSave={v => saveRecord(r.id, { amount: v })} />
                </td>
                <td>
                  <EditCell value={r.notes} minWidth={80} readOnly={readOnly} placeholder="—"
                    onSave={v => saveRecord(r.id, { notes: v })} />
                </td>
                {!readOnly && (
                  <td className="no-print">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-sm" style={{ color: "#854F0B" }} disabled={busy} title="Take a wrong entry out" onClick={() => remove(r, true)}>Reverse</button>
                      {canDelete && <button className="btn btn-sm btn-restricted" disabled={busy} onClick={() => remove(r)}>Delete</button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={8} style={{ textAlign: "right" }}>Total</td>
                <td className="num">{totalAmount.toLocaleString("en-PK")}</td>
                <td colSpan={readOnly ? 1 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </ScrollBox>

    </div>
  );
}
