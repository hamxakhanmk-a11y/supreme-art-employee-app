"use client";
import { useState } from "react";
import { downloadWorkbookXlsx, type SheetSpec } from "@/lib/xlsx";
import { inReportRange, reportLetterhead } from "@/lib/report-export";
import PrintLandscape from "@/components/PrintLandscape";
import ReportLetterhead from "@/components/ReportLetterhead";
export function useReportRange<T extends { date: string }>(rows: T[]) {
 const [from,setFrom] = useState(""); const [to,setTo] = useState("");
 return { from,to,setFrom,setTo, rows: rows.filter(r => inReportRange(r.date,from,to)) };
}
// Two rows, like the other reports. Row 1: the page's search ("search") and, at
// the right end, its own buttons ("actions"), e.g. + New. Row 2: its filter tabs
// ("tabs"), the date range, and at the right end Excel and Print.
export default function ReportExportControls({ range, sheet, filename, search, actions, tabs }: {
 range: { from: string; to: string; setFrom: (s: string)=>void; setTo: (s: string)=>void }; sheet: SheetSpec; filename: string;
 search?: React.ReactNode; actions?: React.ReactNode; tabs?: React.ReactNode;
}) {
 const [busy,setBusy] = useState(false); const [error,setError] = useState("");
 const invalid = !!(range.from && range.to && range.from > range.to);
 async function run() {
  if(invalid) return; setBusy(true); setError("");
  try { await downloadWorkbookXlsx({ filename, sheets: [{...sheet,letterhead:reportLetterhead(range.from,range.to)}] }); }
  catch(e) { setError(e instanceof Error ? e.message : "Export failed. Please retry."); }
  finally { setBusy(false); }
 }
 // The same letterhead the Excel file carries heads the printed page: logo box,
 // the register's title, and the date range — landscape, screen-only parts hidden.
 return <><PrintLandscape /><ReportLetterhead title={sheet.title} date={reportLetterhead(range.from,range.to).date} />
 <div className="no-print">
 <div className="toolbar-row">{search}<div style={{flex:1}} />{actions}</div>
 <div className="toolbar-row">
 {tabs}
 <label className="head-filter">From <input type="date" aria-label="Report from date" value={range.from} max={range.to || undefined} onChange={e=>range.setFrom(e.target.value)} style={{width:138}} /></label>
 <label className="head-filter">To <input type="date" aria-label="Report to date" value={range.to} min={range.from || undefined} onChange={e=>range.setTo(e.target.value)} style={{width:138}} /></label>
 {(range.from || range.to) && <button className="btn btn-xs" onClick={()=>{range.setFrom("");range.setTo("");}} title="Clear the dates">Clear</button>}
 <div style={{flex:1}} />
 <button className="btn btn-sm" disabled={busy || invalid || !sheet.rows.length} onClick={run}>{busy ? "Exporting…" : "⬇ Excel"}</button>
 <button className="btn btn-sm btn-print" disabled={invalid || !sheet.rows.length} onClick={() => window.print()}>🖨 Print</button>
 </div>{(invalid || error) && <p role="alert" style={{margin:"0 0 8px"}}>{invalid ? "From date must be on or before To date." : error}</p>}</div></>;
}
