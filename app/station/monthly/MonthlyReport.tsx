"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import EditCell from "../EditCell";
import PrintLandscape from "@/components/PrintLandscape";
import ReportLetterhead from "@/components/ReportLetterhead";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { reportLetterhead } from "@/lib/report-export";
import type { FleetMonth } from "@/lib/fleetMonthly";

// Fleet Management — Log Book Details, one month. The sheet the office signs:
// per vehicle, the card money (opening, top-up, consumption, closing) and the
// distance from the log book. The month's fuel rate and the maintenance spent
// are typed into their cells (fleet_month_notes); litres and km/l follow from
// the rate. Left empty, they print blank to be written in by hand.

const TITLE = "FLEET MANAGEMENT (LOG BOOK DETAILS)";
const HEADERS = ["Vehicle Registration", "Vehicle Type", "Opening (PKR)", "Top-up (PKR)", "Consumption (PKR)",
  "Fuel Avg Rate (PKR)", "Ltrs", "Dist. Traveled in KMs", "Km/L", "Closing (PKR)", "Maintenance Expense (PKR)"];

const pkr = (n: number | null) => (n === null ? "" : n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const monthName = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const litresText = (n: number | null) => (n === null ? "" : n.toLocaleString("en-PK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const kmlText = (n: number | null) => (n === null ? "" : n.toFixed(2));

export default function MonthlyReport({ data, readOnly = false }: { data: FleetMonth; readOnly?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const period = monthName(data.month);   // the letterhead prints it as "Date: October 2026"
  const t = data.totals;

  // One figure at a time, straight from its cell; false puts the old value back.
  const saveNote = async (vehicleId: number, patch: { fuelRate?: string; maintenance?: string }): Promise<boolean> => {
    setErr("");
    try {
      const res = await fetch("/api/fleet/monthly", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, month: data.month, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      router.refresh();   // litres, km/l and the totals come from the server
      return true;
    } catch (e: any) { setErr(e.message); return false; }
  };

  const exportXlsx = async () => {
    setBusy(true); setErr("");
    try {
      await downloadWorkbookXlsx({
        filename: `fleet-log-book-details_${data.month}`,
        sheets: [{
          sheetName: "Fleet Log Book",
          title: TITLE,
          letterhead: { ...reportLetterhead("", ""), date: period, issue: "01" },
          headers: HEADERS,
          rows: [
            ...data.rows.map(r => [r.vehicleNo, r.vehicleType, r.opening ?? "", r.topup, r.consumption,
              r.fuelRate ?? "", r.litres ?? "", r.km || "", r.kmPerLitre ?? "", r.closing ?? "", r.maintenance ?? ""]),
            ["TOTAL", "", t.opening, t.topup, t.consumption, "", t.litres || "", t.km, "", t.closing, t.maintenance || ""],
          ],
          leftCols: [1],
          freezeCols: 1,
          colWidths: [20, 16, 14, 14, 16, 12, 9, 12, 8, 14, 16],
        }],
      });
    } catch (e: any) { setErr(e.message || "Export failed. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PrintLandscape />
      <ReportLetterhead title={TITLE} date={period} issue="01" />

      <div className="no-print toolbar-row">
        <strong style={{ fontSize: 15 }}>📊 {monthName(data.month)}</strong>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          Type the month&apos;s fuel rate and any maintenance into their cells; litres and km/l work themselves out.
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-xs" onClick={() => window.print()}>🖨 Print</button>
        <button className="btn btn-xs" onClick={exportXlsx} disabled={busy || !data.rows.length}>{busy ? "Exporting…" : "📊 Excel"}</button>
      </div>
      {err && <p className="no-print" role="alert" style={{ color: "#DC2626", fontSize: 13 }}>{err}</p>}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="fleet-month">
          <thead>
            <tr>{HEADERS.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr><td colSpan={HEADERS.length} style={{ textAlign: "center", padding: 22, color: "var(--text3)" }}>No vehicles yet.</td></tr>
            )}
            {data.rows.map(r => (
              <tr key={`${r.vehicleId ?? "card"}-${r.vehicleNo}`}>
                <td className="reg">{r.vehicleNo}</td>
                <td className="type">{r.vehicleType}</td>
                <td className="n">
                  {pkr(r.opening)}
                  {r.opening === null && <span className="no-print" style={{ color: "var(--text3)", fontSize: 11 }}>not set</span>}
                  {r.openedOn && <div style={{ fontSize: 10, color: "var(--text3)" }}>set {dm(r.openedOn)}</div>}
                </td>
                <td className="n">{pkr(r.topup)}</td>
                <td className="n">{pkr(r.consumption)}</td>
                <td className="n">
                  {r.vehicleId === null ? null : (
                    <EditCell type="number" align="right" minWidth={80} readOnly={readOnly} placeholder="rate"
                      value={r.fuelRate === null ? "" : String(r.fuelRate)} print={pkr(r.fuelRate)}
                      onSave={v => saveNote(r.vehicleId!, { fuelRate: v })} />
                  )}
                </td>
                <td className="n">{litresText(r.litres)}</td>
                <td className="n">{r.km || ""}</td>
                <td className="n">{kmlText(r.kmPerLitre)}</td>
                <td className="n strong">{pkr(r.closing)}</td>
                <td className="n">
                  {r.vehicleId === null ? null : (
                    <EditCell type="number" align="right" minWidth={90} readOnly={readOnly} placeholder="—"
                      value={r.maintenance === null ? "" : String(r.maintenance)} print={pkr(r.maintenance)}
                      onSave={v => saveNote(r.vehicleId!, { maintenance: v })} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: "center" }}>TOTAL</td>
                <td className="n">{pkr(t.opening)}</td>
                <td className="n">{pkr(t.topup)}</td>
                <td className="n">{pkr(t.consumption)}</td>
                <td />
                <td className="n">{t.litres ? litresText(t.litres) : ""}</td>
                <td className="n">{t.km}</td>
                <td />
                <td className="n">{pkr(t.closing)}</td>
                <td className="n">{t.maintenance ? pkr(t.maintenance) : ""}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="fleet-sign">
        <span>Prepared by HEAD HR &amp; ADMIN:</span><span className="line" />
      </div>
      <div className="no-print" style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>
        Opening is last month&apos;s closing; in the month a card&apos;s opening balance is set, it is that balance as at the
        start of the opening&apos;s date, and everything from that day on counts. Top-ups count by their date, fuel by the
        day it was entered. Closing for the current month matches the balance on PSO Cards.
      </div>
    </div>
  );
}
