"use client";
import { useState } from "react";
import { downloadWorkbookXlsx, type SheetSpec } from "@/lib/xlsx";
import { inReportRange, reportLetterhead } from "@/lib/report-export";
export function useReportRange<T extends { date: string }>(rows: T[]) {
 const [from,setFrom] = useState(""); const [to,setTo] = useState("");
 return { from,to,setFrom,setTo, rows: rows.filter(r => inReportRange(r.date,from,to)) };
}
export default function ReportExportControls({ range, sheet, filename }: {
 range: { from: string; to: string; setFrom: (s: string)=>void; setTo: (s: string)=>void }; sheet: SheetSpec; filename: string;
}) {
 const [busy,setBusy] = useState(false); const [error,setError] = useState("");
 const invalid = !!(range.from && range.to && range.from > range.to);
 async function run() {
  if(invalid) return; setBusy(true); setError("");
  try { await downloadWorkbookXlsx({ filename, sheets: [{...sheet,letterhead:reportLetterhead(range.from,range.to)}] }); }
  catch(e) { setError(e instanceof Error ? e.message : "Export failed. Please retry."); }
  finally { setBusy(false); }
 }
 return <div className="no-print" style={{marginBottom:12}}><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
 <label>From <input type="date" aria-label="Report from date" value={range.from} max={range.to || undefined} onChange={e=>range.setFrom(e.target.value)} style={{width:150}} /></label>
 <label>To <input type="date" aria-label="Report to date" value={range.to} min={range.from || undefined} onChange={e=>range.setTo(e.target.value)} style={{width:150}} /></label>
 {(range.from || range.to) && <button className="btn btn-sm" onClick={()=>{range.setFrom("");range.setTo("");}}>Clear dates</button>}
 <button className="btn btn-sm" disabled={busy || invalid || !sheet.rows.length} onClick={run}>{busy ? "Exporting…" : "⬇ Export Excel"}</button>
 </div>{(invalid || error) && <p role="alert">{invalid ? "From date must be on or before To date." : error}</p>}</div>;
}
