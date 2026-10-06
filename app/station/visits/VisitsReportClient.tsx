"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PrintLandscape from "@/components/PrintLandscape";
import PrintHeader from "@/components/PrintHeader";
import ScrollBox from "../ScrollBox";
import { LEAVE_STYLE, formatMins } from "@/lib/station";
import { downloadRegisterXlsx } from "@/lib/xlsx";

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

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
const reasonList = (rs: Reason[]) => rs.map(r => (r.n > 1 ? `${r.text} x${r.n}` : r.text)).join("; ");
const visits = (n: number) => (n ? String(n) : "-");
const time = (t: Tally) => (t.visits ? formatMins(t.minutes) : "-");

export default function VisitsReportClient({ rows, from, to }: { rows: VisitRow[]; from: string; to: string }) {
  const router = useRouter();
  const go = (patch: { from?: string; to?: string }) => {
    const p = new URLSearchParams({ from: patch.from ?? from, to: patch.to ?? to });
    router.push(`/station/visits?${p.toString()}`);
  };

  const sum = (pick: (r: VisitRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const pV = sum(r => r.personal.visits), pM = sum(r => r.personal.minutes);
  const oV = sum(r => r.official.visits), oM = sum(r => r.official.minutes);
  const period = `${fmt(from)} to ${fmt(to)}`;

  const exportXlsx = () => downloadRegisterXlsx({
    filename: `station-visits_${from}_to_${to}`,
    sheetName: "Outside Visits",
    title: `Supreme Art — Employees Outside Visits with Reasons (Hourly Leaves)   ${period}`,
    headers: ["#", "Emp ID", "Employee", "Total Visits", "Total Time", "Personal Visits", "Personal Time",
      "Official Visits", "Official Time", "Where they went (reasons)"],
    rows: [
      ...rows.map((r, i) => {
        const tot = { visits: r.personal.visits + r.official.visits, minutes: r.personal.minutes + r.official.minutes };
        const where = [
          r.personalReasons.length ? `P: ${reasonList(r.personalReasons)}` : "",
          r.officialReasons.length ? `O: ${reasonList(r.officialReasons)}` : "",
        ].filter(Boolean).join("  |  ");
        return [i + 1, r.empCode, r.name, tot.visits, formatMins(tot.minutes),
          visits(r.personal.visits), time(r.personal), visits(r.official.visits), time(r.official), where];
      }),
      ["", "", "TOTAL", pV + oV, formatMins(pM + oM), pV, formatMins(pM), oV, formatMins(oM), ""],
    ],
    freezeCols: 3,
    colWidths: [5, 14, 24, 8, 10, 9, 10, 9, 10, 80],
  });

  const stats: { label: string; value: string; color?: string }[] = [
    { label: "Employees", value: String(rows.length) },
    { label: "Total Visits", value: String(pV + oV) },
    { label: "Total Time", value: formatMins(pM + oM), color: "var(--brand)" },
    { label: "Personal (visits / time)", value: `${pV} / ${formatMins(pM)}`, color: P.color },
    { label: "Official (visits / time)", value: `${oV} / ${formatMins(oM)}`, color: O.color },
  ];

  return (
    <div className="fade-up">
      <PrintLandscape />
      <PrintHeader title="Employees Outside Visits Report" subtitle="with Reasons (Hourly Leaves)"
        meta={`Period: ${period} · Sorted by total time · P = Personal, O = Official`} />

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Outside Visits Report</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Who left the factory, how often, for how long and where they went — sorted by total time.{" "}
            <strong style={{ color: P.color }}>P</strong> = Personal, <strong style={{ color: O.color }}>O</strong> = Official.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={exportXlsx} disabled={!rows.length}>⬇ Export Excel</button>
          <button className="btn btn-sm btn-print" onClick={() => window.print()}>🖨 Print</button>
          <Link href="/station/report" className="btn btn-sm">Every trip</Link>
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, fontSize: 13, color: "var(--text2)" }}>
        <span style={{ fontWeight: 600 }}>From</span>
        <input type="date" value={from} onChange={e => e.target.value && go({ from: e.target.value })} style={{ width: 150 }} />
        <span>→</span>
        <input type="date" value={to} onChange={e => e.target.value && go({ to: e.target.value })} style={{ width: 150 }} />
      </div>

      <div className="visits-stats">
        {stats.map(s => (
          <div key={s.label} className="stat" style={{ textAlign: "center" }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label" style={{ marginTop: 6, marginBottom: 0 }}>{s.label}</div>
          </div>
        ))}
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
                Nobody went out in this period.
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
