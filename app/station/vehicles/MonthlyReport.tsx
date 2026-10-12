"use client";
import { useState } from "react";
import PrintLandscape from "@/components/PrintLandscape";
import ReportLetterhead from "@/components/ReportLetterhead";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { reportLetterhead } from "@/lib/report-export";
import type { FleetMonth } from "@/lib/fleetMonthly";

// Fleet Management — Log Book Details, one month. The sheet the office signs:
// per vehicle, the card money (opening, top-up, consumption, closing) and the
// distance from the log book. Fuel rate, litres, km/l and maintenance aren't
// recorded in the app, so their columns are left blank to be written in.

const TITLE = "FLEET MANAGEMENT (LOG BOOK DETAILS)";
const HEADERS = ["Vehicle Registration", "Vehicle Type", "Opening (PKR)", "Top-up (PKR)", "Consumption (PKR)",
  "Fuel Avg Rate (PKR)", "Ltrs", "Dist. Traveled in KMs", "Km/L", "Closing (PKR)", "Maintenance Expense (PKR)"];

const pkr = (n: number | null) => (n === null ? "" : n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const monthName = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default function MonthlyReport({ data }: { data: FleetMonth }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const period = monthName(data.month);   // the letterhead prints it as "Date: October 2026"
  const t = data.totals;

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
            ...data.rows.map(r => [r.vehicleNo, r.vehicleType, r.opening ?? "", r.topup, r.consumption, "", "", r.km || "", "", r.closing ?? "", ""]),
            ["TOTAL", "", t.opening, t.topup, t.consumption, "", "", t.km, "", t.closing, ""],
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
          Fuel rate, litres, km/l and maintenance are left blank to fill in by hand.
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
                <td className="blank" /><td className="blank" />
                <td className="n">{r.km || ""}</td>
                <td className="blank" />
                <td className="n strong">{pkr(r.closing)}</td>
                <td className="blank" />
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
                <td /><td />
                <td className="n">{t.km}</td>
                <td />
                <td className="n">{pkr(t.closing)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="fleet-sign">
        <span>Prepared by HEAD HR &amp; ADMIN:</span><span className="line" />
      </div>
      <div className="no-print" style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>
        Opening is last month&apos;s closing; in the month a card&apos;s opening balance is first set, that figure, and only
        what came after it. Top-ups count by their date, fuel by the day it was entered. Closing for the current month
        matches the balance on PSO Cards.
      </div>
    </div>
  );
}
