"use client";
import { useState } from "react";
import { usePageState } from "@/lib/usePageState";
import { downloadWorkbookXlsx, type SheetSpec } from "@/lib/xlsx";
import { inReportRange, reportLetterhead } from "@/lib/report-export";
import PrintLandscape from "@/components/PrintLandscape";
import ReportLetterhead from "@/components/ReportLetterhead";
export function useReportRange<T extends { date: string }>(rows: T[]) {
 const [from,setFrom] = usePageState("from", ""); const [to,setTo] = usePageState("to", ""); // kept when the user leaves and comes back
 return { from,to,setFrom,setTo, rows: rows.filter(r => inReportRange(r.date,from,to)) };
}
// A thin count/total chip (small pill: big number + small caps label), like the Purchase register's.
export function StatChip({ label, value }: { label: string; value: string | number }) {
 return (
  <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 10px", borderRadius: 8, background: "#fafaf6", border: "1px solid var(--border)" }}>
   <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{value}</span>
   <span style={{ fontSize: 10.5, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
  </div>
 );
}
// One controls row that wraps group by group. In order: the count chips ("chips"), the page's search ("search")
// and sort ("sort"), its filter tabs ("tabs"), the date range, and at the right end one group: Print, Excel, then
// the page's own buttons ("actions"), e.g. + New.
export default function ReportExportControls({ range, sheet, filename, chips, search, sort, actions, tabs }: {
 range: { from: string; to: string; setFrom: (s: string)=>void; setTo: (s: string)=>void }; sheet: SheetSpec; filename: string;
 chips?: React.ReactNode; search?: React.ReactNode; sort?: React.ReactNode; actions?: React.ReactNode; tabs?: React.ReactNode;
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
 <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
 {chips && <div style={{display:"flex",gap:6,flexShrink:0}}>{chips}</div>}
 {(search || sort) && <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>{search}{sort}</div>}
 {tabs && <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>{tabs}</div>}
 <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
 <label className="head-filter">From <input type="date" aria-label="Report from date" value={range.from} max={range.to || undefined} onChange={e=>range.setFrom(e.target.value)} style={{width:138}} /></label>
 <label className="head-filter">To <input type="date" aria-label="Report to date" value={range.to} min={range.from || undefined} onChange={e=>range.setTo(e.target.value)} style={{width:138}} /></label>
 {(range.from || range.to) && <button className="btn btn-xs" onClick={()=>{range.setFrom("");range.setTo("");}} title="Clear the dates">Clear</button>}
 </div>
 <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:"auto",flexShrink:0}}>
 <button className="btn btn-print" disabled={invalid || !sheet.rows.length} onClick={() => window.print()}>🖨 Print</button>
 <button className="btn" disabled={busy || invalid || !sheet.rows.length} onClick={run}>{busy ? "Exporting…" : "⬇ Excel"}</button>
 {actions}
 </div>
 </div>{(invalid || error) && <p role="alert" style={{margin:"0 0 8px"}}>{invalid ? "From date must be on or before To date." : error}</p>}</div></>;
}
