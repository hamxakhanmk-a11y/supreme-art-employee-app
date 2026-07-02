"use client";
import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";
import PrintLandscape, { printLandscape } from "@/components/PrintLandscape";
import { lateMinutes, formatLate, sortEmployees, SORT_OPTIONS, type SortKey, workedMinutesForDay, countsTowardYield, formatHoursHM, workStatus, workPercent, formatPercent, type WorkStatus } from "@/lib/attendance";

type Emp = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string | null;
  designation: string | null;
  status: string;
  createdAt?: string | Date | null;
};
type Rec = { employeeId: number; date: string; status: string; checkIn: string | null };

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Status code (short) + colors. Half-day shows as "P" (still Present)
// with a tiny ½ corner marker — half-day employees are credited as present.
const CODE = {
  present:    { code: "P",  marker: "",  color: "#15803D", bg: "#dcf5dc" },
  absent:     { code: "A",  marker: "",  color: "#DC2626", bg: "#fcdada" },
  leave:      { code: "L",  marker: "",  color: "#D97706", bg: "#fdebd0" },
  "half-day": { code: "P",  marker: "½", color: "#15803D", bg: "#dcf5dc" },
  holiday:    { code: "H",  marker: "",  color: "#0E7490", bg: "#cffafe" },
} as const;

type Code = keyof typeof CODE;

export default function MonthlyRegisterClient({
  year, month, daysInMonth, employees, records,
  rangeFrom, rangeTo,
}: {
  year: number; month: number; daysInMonth: number; employees: Emp[]; records: Rec[];
  // If set, the toolbar shows from/to pickers instead of just month/year.
  rangeFrom?: string; rangeTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // record lookup by `${employeeId}-${day}`
  const byKey = useMemo(() => {
    const m = new Map<string, { status: string; checkIn: string | null }>();
    for (const r of records) {
      const day = parseInt(r.date.slice(8, 10));
      m.set(`${r.employeeId}-${day}`, { status: r.status, checkIn: r.checkIn });
    }
    return m;
  }, [records]);

  const [sort, setSort] = useState<SortKey>("id");

  // Active employees only (inactive can be toggled later if needed)
  const activeEmps = useMemo(
    () => sortEmployees(employees.filter(e => e.status === "active"), sort),
    [employees, sort]
  );

  const cellFor = (emp: Emp, day: number) => {
    const stored = byKey.get(`${emp.id}-${day}`);
    return (stored?.status as Code | undefined) ?? null;
  };
  const lateFor = (emp: Emp, day: number) => lateMinutes(byKey.get(`${emp.id}-${day}`)?.checkIn);

  // Per-employee tallies. Half-day counts as a full P (the employee was
  // present) but is also tracked in `Half` so HR can see how many half-days.
  const tally = (emp: Emp) => {
    let P = 0, A = 0, L = 0, H = 0, Half = 0, Late = 0, LateMin = 0, WorkedMin = 0, MarkedDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const c = cellFor(emp, day);
      const late = lateFor(emp, day);
      if (late > 0) { Late++; LateMin += late; }
      WorkedMin += workedMinutesForDay(c, late);
      if (!c) continue;
      if (countsTowardYield(c)) MarkedDays++;
      if (c === "present") P++;
      else if (c === "half-day") { P++; Half++; }
      else if (c === "absent") A++;
      else if (c === "leave") L++;
      else if (c === "holiday") H++;
    }
    // Net working days = paid days for the month = present + paid leave + holiday.
    // (Absent days are excluded — they're what gets deducted from salary.)
    const percent = workPercent(WorkedMin, MarkedDays);
    return {
      P, A, L, H, Half, Late, LateMin, WorkedMin, MarkedDays,
      status: workStatus(percent), percent,
      net: P + L + H,
    };
  };

  const changeMonth = (delta: number) => {
    let y = year, m = month + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    router.push(`${pathname}?year=${y}&month=${m}`);
  };
  const setMonth = (m: number) => router.push(`${pathname}?year=${year}&month=${m}`);
  const setYear = (y: number) => router.push(`${pathname}?year=${y}&month=${month}`);

  // Day-of-week label for header (S M T W T F S)
  const dowLabel = (day: number) => {
    const d = new Date(year, month - 1, day);
    return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
  };
  const isSunday = (day: number) => new Date(year, month - 1, day).getDay() === 0;

  const exportCSV = () => {
    const dayCols = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    const headers = ["Emp ID", "Full Name", "Department", "Designation", ...dayCols, "P", "Half", "A", "L", "H", "Late Days", "Late Time", "Net Days", "Worked Hrs", "Status %"];
    const rows = activeEmps.map(e => {
      const t = tally(e);
      const cells = Array.from({ length: daysInMonth }, (_, i) => {
        const c = cellFor(e, i + 1);
        const late = lateFor(e, i + 1);
        if (!c) return "";
        const v = CODE[c as Code];
        const code = v.marker ? `${v.code}${v.marker}` : v.code;
        return late > 0 ? `${code} (Late ${formatLate(late)})` : code;
      });
      return [
        e.employeeId, `${e.firstName} ${e.lastName}`, e.department || "", e.designation || "",
        ...cells, t.P, t.Half, t.A, t.L, t.H, t.Late, formatLate(t.LateMin), t.net,
        formatHoursHM(t.WorkedMin), formatPercent(t.percent),
      ];
    });
    downloadCSV(`monthly-register-${MONTHS[month - 1]}-${year}.csv`, headers, rows);
  };

  const today = new Date();
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);

  return (
    <>
      <PrintLandscape />
      <PrintHeader
        title="Monthly Attendance Register"
        subtitle={`${MONTHS[month - 1]} ${year}`}
      />

      {/* Toolbar */}
      {rangeFrom && rangeTo ? (
        <RangeToolbar
          pathname={pathname}
          from={rangeFrom}
          to={rangeTo}
          onPrint={printLandscape}
          onExport={exportCSV}
          years={years}
          sort={sort}
          onSortChange={setSort}
        />
      ) : (
        <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={() => changeMonth(-1)} className="btn btn-sm">‹ Prev</button>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ width: 140 }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 100 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => changeMonth(1)} className="btn btn-sm">Next ›</button>
          <div style={{ flex: 1 }} />
          <SortSelect value={sort} onChange={setSort} />
          <button onClick={printLandscape} className="btn btn-print">🖨 Print Register</button>
          <button onClick={exportCSV} className="btn btn-primary">⬇ Excel</button>
        </div>
      )}

      {/* Codes legend */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 12, fontSize: 12, color: "var(--text2)" }}>
        <strong style={{ color: "var(--text)" }}>Codes:</strong>
        <LegendChip code="P"  label="Present"  c="#15803D" />
        <LegendChip code="A"  label="Absent"   c="#DC2626" />
        <LegendChip code="L"  label="Leave"    c="#D97706" />
        <LegendChip code="H"  label="Holiday"  c="#0E7490" />
        <LegendChip code="P" marker="½" label="Half-day (present)" c="#15803D" />
        <LegendChip code="P" marker="15m" label="Late arrival (shows minutes/hours late)" c="#15803D" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <StatusBadge status="ok" percent={97} /> / <StatusBadge status="not-ok" percent={80} />
          <span>= live yield: worked hours ÷ expected hours for days marked so far × 100 (8:10–16:45, 1h break, minus lateness)</span>
        </span>
      </div>

      {/* Register table */}
      <div className="card register-wrap" style={{ padding: 0, overflow: "auto" }}>
        <table className="register-table">
          <thead>
            {/* Top banner row — print only / accent */}
            <tr className="register-banner">
              <th colSpan={4 + daysInMonth + 10} style={{ textAlign: "center", fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "#fff", background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)", padding: "10px 8px", textTransform: "uppercase" }}>
                📋 Monthly Attendance Register — {MONTHS[month - 1]} {year}
              </th>
            </tr>
            <tr>
              <th>Emp ID</th>
              <th>Full Name</th>
              <th>Department</th>
              <th>Designation</th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                <th key={day} className={`day-h ${isSunday(day) ? "day-sun" : ""}`}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{day}</div>
                  <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.6, marginTop: 1 }}>{dowLabel(day)}</div>
                </th>
              ))}
              <th className="tot-h" style={{ color: "#15803D" }}>P</th>
              <th className="tot-h" style={{ color: "#1D4ED8" }}>½</th>
              <th className="tot-h" style={{ color: "#DC2626" }}>A</th>
              <th className="tot-h" style={{ color: "#D97706" }}>L</th>
              <th className="tot-h" style={{ color: "#0E7490" }}>H</th>
              <th className="tot-h" style={{ color: "#DC2626" }}>Lt</th>
              <th className="tot-h" style={{ color: "#DC2626" }}>Late Time</th>
              <th className="tot-h">Net</th>
              <th className="tot-h">Worked Hrs</th>
              <th className="tot-h">Status</th>
            </tr>
          </thead>
          <tbody>
            {activeEmps.length === 0 && (
              <tr><td colSpan={4 + daysInMonth + 10} className="empty">No active employees.</td></tr>
            )}
            {activeEmps.map(emp => {
              const t = tally(emp);
              return (
                <tr key={emp.id}>
                  <td className="emp-id">{emp.employeeId}</td>
                  <td className="emp-name">{emp.firstName} {emp.lastName}</td>
                  <td className="emp-dept">{emp.department || "—"}</td>
                  <td className="emp-desig">{emp.designation || "—"}</td>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const c = cellFor(emp, day);
                    const late = lateFor(emp, day);
                    if (!c) return <td key={day} className={`day-c ${isSunday(day) ? "day-sun-c" : ""}`} />;
                    const v = CODE[c as Code];
                    const title = late > 0 ? `${c.replace("-", " ")} — late ${formatLate(late)}` : c.replace("-", " ");
                    return (
                      <td key={day} className="day-c" style={{ background: v.bg, color: v.color, fontWeight: 700, position: "relative" }} title={title}>
                        {v.code}
                        {v.marker && <span className="day-marker">{v.marker}</span>}
                        {late > 0 && <span className="day-marker-late">{formatLate(late, true)}</span>}
                      </td>
                    );
                  })}
                  <td className="tot-c" style={{ color: "#15803D" }}>{t.P}</td>
                  <td className="tot-c" style={{ color: "#1D4ED8" }}>{t.Half || ""}</td>
                  <td className="tot-c" style={{ color: "#DC2626" }}>{t.A}</td>
                  <td className="tot-c" style={{ color: "#D97706" }}>{t.L}</td>
                  <td className="tot-c" style={{ color: "#0E7490" }}>{t.H || ""}</td>
                  <td className="tot-c" style={{ color: "#DC2626" }}>{t.Late || ""}</td>
                  <td className="tot-c" style={{ color: "#DC2626", fontSize: 11 }}>{formatLate(t.LateMin)}</td>
                  <td className="tot-c" style={{ color: "var(--brand)" }}>{t.net}</td>
                  <td className="tot-c" style={{ fontSize: 11 }}>{formatHoursHM(t.WorkedMin)}</td>
                  <td className="tot-c"><StatusBadge status={t.status} percent={t.percent} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .register-wrap { max-width: 100%; }
        .register-table {
          border-collapse: collapse;
          font-size: 11px;
          font-family: var(--font);
          background: var(--bg);
          width: max-content;
          min-width: 100%;
        }
        .register-table th, .register-table td {
          border: 1px solid var(--border);
          padding: 5px 6px;
          text-align: center;
          background: var(--bg);
          white-space: nowrap;
        }
        .register-table thead th {
          background: var(--bg2);
          color: var(--text);
          font-weight: 700;
          font-size: 11px;
          padding: 6px 6px;
          text-transform: none;
          letter-spacing: 0;
        }
        .register-table .day-h { min-width: 26px; padding: 4px 2px; }
        .register-table .day-h.day-sun { background: #e2e8f0; color: var(--brand-dark); }
        .register-table .tot-h { background: #f3eee4; min-width: 38px; }
        .register-table .day-c { width: 26px; min-width: 26px; padding: 4px 2px; font-size: 10.5px; }
        .register-table .day-c.day-sun-c { background: #f1f5f9; }
        /* Half-day / Late corner marker on a Present cell */
        .register-table .day-marker {
          position: absolute;
          top: 1px; right: 2px;
          font-size: 7.5px;
          font-weight: 800;
          color: #1D4ED8;
          line-height: 1;
        }
        .register-table .day-marker-late {
          position: absolute;
          bottom: 0px; left: 1px;
          font-size: 6.5px;
          font-weight: 800;
          color: #DC2626;
          line-height: 1;
          white-space: nowrap;
        }
        .register-table .tot-c { font-weight: 700; font-size: 12px; background: #fdf8ee; }
        .register-table .emp-id  { font-weight: 700; color: var(--brand); text-align: left; padding-left: 10px; }
        .register-table .emp-name { font-weight: 600; text-align: left; padding-left: 10px; }
        .register-table .emp-dept,
        .register-table .emp-desig { text-align: left; padding-left: 10px; color: var(--text2); }
        .register-table tbody tr:hover td { background: var(--bg2); }
        .register-table tbody tr:hover td.day-c[style] { /* keep colored cells */ }

        @media print {
          @page { size: A3 landscape; margin: 8mm; }
          .register-banner { display: table-row !important; }
          .register-wrap { overflow: visible !important; border: none !important; box-shadow: none !important; }
          .register-table { font-size: 9.5px; width: 100%; }
          .register-table th, .register-table td { padding: 3px 3px; }
          .register-table .day-c { width: auto; min-width: 0; }
          .register-table .emp-id { padding-left: 5px; }
          .register-table .emp-name { padding-left: 5px; }
        }
      `}</style>
    </>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function RangeToolbar({
  pathname, from, to, onPrint, onExport, years, sort, onSortChange,
}: {
  pathname: string;
  from: string; to: string;
  onPrint: () => void;
  onExport: () => void;
  years: number[];
  sort?: SortKey;
  onSortChange?: (s: SortKey) => void;
}) {
  const router = useRouter();
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  const apply = (newFrom: string, newTo: string) => {
    router.push(`${pathname}?from=${newFrom}&to=${newTo}`);
  };
  const setFromYear = (y: number) => apply(`${y}-${String(fm).padStart(2, "0")}`, to);
  const setFromMonth = (m: number) => apply(`${fy}-${String(m).padStart(2, "0")}`, to);
  const setToYear = (y: number) => apply(from, `${y}-${String(tm).padStart(2, "0")}`);
  const setToMonth = (m: number) => apply(from, `${ty}-${String(m).padStart(2, "0")}`);

  const presetSingleMonth = (y: number, m: number) => {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    apply(ym, ym);
  };
  const presetYear = (y: number) => apply(`${y}-01`, `${y}-12`);
  const presetYTD = () => {
    const now = new Date();
    apply(`${now.getFullYear()}-01`, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", letterSpacing: 0.4 }}>FROM</span>
      <select value={fm} onChange={e => setFromMonth(parseInt(e.target.value))} style={{ width: 130 }}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select value={fy} onChange={e => setFromYear(parseInt(e.target.value))} style={{ width: 90 }}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", letterSpacing: 0.4 }}>TO</span>
      <select value={tm} onChange={e => setToMonth(parseInt(e.target.value))} style={{ width: 130 }}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select value={ty} onChange={e => setToYear(parseInt(e.target.value))} style={{ width: 90 }}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
        <button onClick={() => presetSingleMonth(fy, fm)} className="btn btn-sm" title="Current month only">This month</button>
        <button onClick={presetYTD} className="btn btn-sm" title="January through current month">YTD</button>
        <button onClick={() => presetYear(fy)} className="btn btn-sm" title="Full calendar year">Full year</button>
      </div>
      <div style={{ flex: 1 }} />
      {sort && onSortChange && <SortSelect value={sort} onChange={onSortChange} />}
      <button onClick={onPrint} className="btn btn-print">🖨 Print Register</button>
      <button onClick={onExport} className="btn btn-primary">⬇ Excel</button>
    </div>
  );
}

export function SortSelect({ value, onChange }: { value: SortKey; onChange: (s: SortKey) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as SortKey)}
      title="Sort employees by"
      style={{ width: 150 }}
    >
      {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
    </select>
  );
}

export function StatusBadge({ status, percent }: { status: WorkStatus; percent: number }) {
  const ok = status === "ok";
  return (
    <span style={{
      display: "inline-block", padding: "3px 9px", fontSize: 10, fontWeight: 800,
      borderRadius: 999, letterSpacing: 0.3,
      color: ok ? "#15803D" : "#DC2626", background: ok ? "#dcf5dc" : "#fcdada",
    }}>
      {formatPercent(percent)}
    </span>
  );
}

function LegendChip({ code, marker, label, c }: { code: string; marker?: string; label: string; c: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        position: "relative",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 22, height: 18, padding: "0 4px",
        borderRadius: 4, background: `${c}22`, color: c,
        fontSize: 10, fontWeight: 800, letterSpacing: 0.2,
      }}>
        {code}
        {marker && (
          <span style={{
            position: "absolute", top: -2, right: -3,
            fontSize: 8, fontWeight: 800, color: marker === "½" ? "#1D4ED8" : "#DC2626",
            lineHeight: 1,
          }}>{marker}</span>
        )}
      </span>
      <span style={{ fontSize: 11 }}>= {label}</span>
    </span>
  );
}
