"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PrintLandscape from "@/components/PrintLandscape";
import ReportLetterhead from "@/components/ReportLetterhead";
import ScrollBox from "../ScrollBox";
import { LEAVE_STYLE, formatMins } from "@/lib/station";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { reportLetterhead } from "@/lib/report-export";

const TITLE = "EMPLOYEES OUTSIDE VISITS REPORT";

type Tally = { visits: number; minutes: number };
type Reason = { text: string; n: number };
export type VisitRow = {
  employeeId: number; empCode: string; name: string;
  personal: Tally; official: Tally;
  outNow: boolean;
  personalReasons: Reason[]; officialReasons: Reason[];
};

const P = LEAVE_STYLE.personal;
const O = LEAVE_STYLE.official;

const reasonList = (rs: Reason[]) => rs.map(r => (r.n > 1 ? `${r.text} x${r.n}` : r.text)).join("; ");
const visits = (n: number) => n || "-";
const time = (t: Tally) => (t.visits ? formatMins(t.minutes) : "-");

export type Staff = { id: number; empCode: string; name: string };

const blank = (s: Staff): VisitRow => ({
  employeeId: s.id, empCode: s.empCode, name: s.name,
  personal: { visits: 0, minutes: 0 }, official: { visits: 0, minutes: 0 },
  outNow: false, personalReasons: [], officialReasons: [],
});

export default function VisitsReportClient({ rows: movers, everyone, from, to, today }: {
  rows: VisitRow[]; everyone: Staff[]; from: string; to: string; today: string;
}) {
  const router = useRouter();
  const go = (f: string, t: string) => router.push(`/station/visits?${new URLSearchParams({ from: f, to: t })}`);

  const monthStart = `${today.slice(0, 8)}01`;
  const preset = from === today && to === today ? "today" : from === monthStart && to === today ? "month" : "custom";
  // Custom shows its two date boxes as soon as it's clicked, before any date
  // is changed — the range itself only moves when a date is picked.
  const [customOpen, setCustomOpen] = useState(preset === "custom");
  const mode = preset === "custom" || customOpen ? "custom" : preset;

  // Who's listed: by default only the people who went out in the period; ticked,
  // everyone on the books, the ones who stayed in showing dashes.
  const [showAll, setShowAll] = useState(false);
  const [empId, setEmpId] = useState("");
  const [search, setSearch] = useState("");

  const base = useMemo(() => {
    if (!showAll) return movers;
    const went = new Set(movers.map(r => r.employeeId));
    return [...movers, ...everyone.filter(s => !went.has(s.id)).map(blank)];
  }, [movers, everyone, showAll]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter(r =>
      (!empId || String(r.employeeId) === empId)
      && (!q || `${r.empCode} ${r.name}`.toLowerCase().includes(q)));
  }, [base, empId, search]);

  // The list follows what's shown, by name; a pick that's dropped out of it
  // (another range, box unticked) stays listed so the filter can be seen and cleared.
  const pickList = useMemo(() => {
    const list = [...base].sort((a, b) => a.name.localeCompare(b.name));
    if (empId && !list.some(r => String(r.employeeId) === empId)) {
      const s = everyone.find(e => String(e.id) === empId);
      if (s) list.unshift(blank(s));
    }
    return list;
  }, [base, empId, everyone]);
  const picked = pickList.find(r => String(r.employeeId) === empId);

  const sum = (pick: (r: VisitRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const pV = sum(r => r.personal.visits), pM = sum(r => r.personal.minutes);
  const oV = sum(r => r.official.visits), oM = sum(r => r.official.minutes);

  // Same letterhead as the other registers, on paper and in Excel.
  const letterhead = { ...reportLetterhead(from, to), issue: "01" };

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportXlsx = async () => {
    setExporting(true); setExportError("");
    try {
      await downloadWorkbookXlsx({
        filename: `outside-visits_${from}_to_${to}`,
        sheets: [{
          sheetName: "Outside Visits",
          title: TITLE,
          letterhead,
          // Two header rows, as on screen: Total / Personal / Official over their
          // Visits and Time. Excel numbers its own rows, so no Sr column — and the
          // logo sits in the first column, which wants to be wide.
          headers: ["Emp ID", "Employee", "Visits", "Time", "Visits", "Time", "Visits", "Time", "Where they went (reasons)"],
          headerGroups: [
            { label: "Total", start: 2, span: 2 },
            { label: "Personal", start: 4, span: 2 },
            { label: "Official", start: 6, span: 2 },
          ],
          rows: [
            ...rows.map(r => {
              const where = [
                r.personalReasons.length ? `P: ${reasonList(r.personalReasons)}` : "",
                r.officialReasons.length ? `O: ${reasonList(r.officialReasons)}` : "",
              ].filter(Boolean).join("  |  ");
              return [r.empCode, r.name,
                r.personal.visits + r.official.visits, formatMins(r.personal.minutes + r.official.minutes),
                visits(r.personal.visits), time(r.personal), visits(r.official.visits), time(r.official), where];
            }),
            ["", "TOTAL", pV + oV, formatMins(pM + oM), pV, formatMins(pM), oV, formatMins(oM), ""],
          ],
          leftCols: [8],
          freezeCols: 2,
          colWidths: [20, 26, 8, 10, 8, 10, 8, 10, 70],
        }],
      });
    } catch (e) { setExportError(e instanceof Error ? e.message : "Export failed. Please try again."); }
    finally { setExporting(false); }
  };

  const presetBtn = (key: "today" | "month", label: string, f: string) => (
    <button className={`btn btn-sm${mode === key ? " btn-primary" : ""}`}
      onClick={() => { setCustomOpen(false); if (preset !== key) go(f, today); }}>{label}</button>
  );

  return (
    <div className="fade-up">
      <PrintLandscape />
      <ReportLetterhead title={TITLE} code={letterhead.code} date={letterhead.date} issue={letterhead.issue} />
      <div className="print-only" style={{ fontSize: "9pt", margin: "0 0 6px" }}>
        {picked && <><strong>{picked.empCode} — {picked.name}</strong> · </>}
        Sorted by total time · <strong style={{ color: P.color }}>P</strong> = Personal, <strong style={{ color: O.color }}>O</strong> = Official
      </div>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Outside Visits Report</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Who left the factory, how often, for how long and where they went — sorted by total time.{" "}
            <strong style={{ color: P.color }}>P</strong> = Personal, <strong style={{ color: O.color }}>O</strong> = Official.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={exportXlsx} disabled={!rows.length || exporting}>{exporting ? "Exporting…" : "⬇ Export Excel"}</button>
          <button className="btn btn-sm btn-print" onClick={() => window.print()}>🖨 Print</button>
          <Link href="/station/report" className="btn btn-sm">Every trip</Link>
        </div>
      </div>
      {exportError && <p className="no-print" role="alert" style={{ color: "#DC2626", fontSize: 13 }}>{exportError}</p>}

      <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10, fontSize: 13, color: "var(--text2)" }}>
        {presetBtn("today", "Today", today)}
        {presetBtn("month", "This month", monthStart)}
        <button className={`btn btn-sm${mode === "custom" ? " btn-primary" : ""}`} onClick={() => setCustomOpen(true)}>Custom</button>
        {mode === "custom" && (
          <>
            <span style={{ fontWeight: 600, marginLeft: 6 }}>From</span>
            <input type="date" value={from} max={to} onChange={e => e.target.value && go(e.target.value, to)} style={{ width: 150 }} />
            <span>→</span>
            <input type="date" value={to} min={from} onChange={e => e.target.value && go(from, e.target.value)} style={{ width: 150 }} />
          </>
        )}
      </div>

      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, fontSize: 13, color: "var(--text2)" }}>
        <select value={empId} onChange={e => setEmpId(e.target.value)} style={{ width: 260 }}>
          <option value="">{showAll ? "All employees" : `Everyone who went out (${movers.length})`}</option>
          {pickList.map(r => <option key={r.employeeId} value={r.employeeId}>{r.empCode} — {r.name}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name or Emp ID" style={{ width: 220 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Show all employees, including those who didn&apos;t go out
        </label>
        <span style={{ marginLeft: "auto" }}>
          <strong>{rows.length}</strong> employee{rows.length === 1 ? "" : "s"} · <strong>{pV + oV}</strong> visit{pV + oV === 1 ? "" : "s"}
        </span>
      </div>

      <ScrollBox>
        <table className="visits-table">
          <thead>
            <tr>
              <th rowSpan={2} className="c">#</th>
              <th rowSpan={2}>Emp ID</th>
              <th rowSpan={2}>Employee</th>
              <th colSpan={2} className="c grp">Total</th>
              <th colSpan={2} className="c grp" style={{ color: P.color, background: P.bg }}>Personal</th>
              <th colSpan={2} className="c grp" style={{ color: O.color, background: O.bg }}>Official</th>
              <th rowSpan={2} className="grp">Where they went (reasons)</th>
            </tr>
            <tr>
              <th className="c grp">Visits</th><th className="c">Time</th>
              <th className="c grp" style={{ color: P.color }}>Visits</th><th className="c" style={{ color: P.color }}>Time</th>
              <th className="c grp" style={{ color: O.color }}>Visits</th><th className="c" style={{ color: O.color }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                {movers.length ? "No one matches this filter." : "Nobody went out in this period."}
              </td></tr>
            )}
            {rows.map((r, i) => {
              const totV = r.personal.visits + r.official.visits;
              const totM = r.personal.minutes + r.official.minutes;
              return (
                <tr key={r.employeeId}>
                  <td className="c" style={{ color: "var(--text3)" }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, color: "var(--brand)" }}>{r.empCode}</td>
                  <td style={{ fontWeight: 600 }}>
                    {r.name}
                    {r.outNow && <span className="no-print" style={{ color: "#DC2626", fontWeight: 700, fontSize: 11 }}> · out now</span>}
                  </td>
                  <td className="c grp" style={{ fontWeight: 700 }}>{totV}</td>
                  <td className="c" style={{ fontWeight: 700 }}>{formatMins(totM)}</td>
                  <td className="c grp" style={{ color: r.personal.visits ? P.color : "var(--text3)" }}>{visits(r.personal.visits)}</td>
                  <td className="c" style={{ color: r.personal.visits ? P.color : "var(--text3)" }}>{time(r.personal)}</td>
                  <td className="c grp" style={{ color: r.official.visits ? O.color : "var(--text3)" }}>{visits(r.official.visits)}</td>
                  <td className="c" style={{ color: r.official.visits ? O.color : "var(--text3)" }}>{time(r.official)}</td>
                  <td className="grp where">
                    {r.personalReasons.length > 0 && (
                      <span style={{ color: P.color }}><b>P:</b> {reasonList(r.personalReasons)}</span>
                    )}
                    {r.personalReasons.length > 0 && r.officialReasons.length > 0 && <span className="sep"> | </span>}
                    {r.officialReasons.length > 0 && (
                      <span style={{ color: O.color }}><b>O:</b> {reasonList(r.officialReasons)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td /><td />
                <td>TOTAL</td>
                <td className="c grp">{pV + oV}</td>
                <td className="c">{formatMins(pM + oM)}</td>
                <td className="c grp" style={{ color: P.color }}>{pV}</td>
                <td className="c" style={{ color: P.color }}>{formatMins(pM)}</td>
                <td className="c grp" style={{ color: O.color }}>{oV}</td>
                <td className="c" style={{ color: O.color }}>{formatMins(oM)}</td>
                <td className="grp" />
              </tr>
            </tfoot>
          )}
        </table>
      </ScrollBox>

      <div className="no-print" style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10 }}>
        Visits and time come from the Station punches. Only <strong style={{ color: P.color }}>Personal</strong> time is
        subtracted from worked hours. Someone still out today counts the visit, with its time added once they punch back in.
      </div>
    </div>
  );
}
