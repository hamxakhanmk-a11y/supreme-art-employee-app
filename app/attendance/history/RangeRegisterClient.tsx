"use client";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { downloadCSV } from "@/lib/csv";
import PrintHeader from "@/components/PrintHeader";
import PrintLandscape, { printLandscape } from "@/components/PrintLandscape";
import { MONTHS, RangeToolbar, StatusBadge, RequiredHoursPanel } from "./MonthlyRegisterClient";
import { lateMinutes, formatLate, sortEmployees, type SortKey, workedMinutesForDay, countsTowardYield, formatHoursHM, workStatus, workPercent, formatPercent, DAILY_EXPECTED_MINUTES } from "@/lib/attendance";

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
type Rec = { employeeId: number; date: string; status: string; checkIn: string | null; officialLeaveMin?: number; personalLeaveMin?: number };
type YM = { y: number; m: number };

const STATUS_COLORS: Record<string, { color: string; bg: string; }> = {
  P: { color: "#15803D", bg: "#dcf5dc" },
  A: { color: "#DC2626", bg: "#fcdada" },
  L: { color: "#D97706", bg: "#fdebd0" },
  H: { color: "#0E7490", bg: "#cffafe" },
  Lt: { color: "#DC2626", bg: "#fcdada" },
  OL: { color: "#0E7490", bg: "#cffafe" },
  PL: { color: "#9333EA", bg: "#f3e8ff" },
};

export default function RangeRegisterClient({
  from, to, months, employees, records,
}: {
  from: YM; to: YM;
  months: YM[];
  employees: Emp[];
  records: Rec[];
}) {
  const pathname = usePathname();
  const today = new Date();
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);

  // Build a lookup: `${employeeId}-${YYYY}-${M}` -> { P, A, L, H, Half }
  const byEmpMonth = useMemo(() => {
    const m = new Map<string, { P: number; A: number; L: number; H: number; Half: number; Late: number; LateMin: number; WorkedMin: number; MarkedDays: number; OffLvMin: number; PerLvMin: number }>();
    const key = (emp: number, y: number, mo: number) => `${emp}-${y}-${mo}`;
    for (const r of records) {
      const y = parseInt(r.date.slice(0, 4));
      const mo = parseInt(r.date.slice(5, 7));
      const k = key(r.employeeId, y, mo);
      let bucket = m.get(k);
      if (!bucket) { bucket = { P: 0, A: 0, L: 0, H: 0, Half: 0, Late: 0, LateMin: 0, WorkedMin: 0, MarkedDays: 0, OffLvMin: 0, PerLvMin: 0 }; m.set(k, bucket); }
      if (countsTowardYield(r.status)) bucket.MarkedDays++;
      if (r.status === "present") bucket.P++;
      else if (r.status === "half-day") { bucket.P++; bucket.Half++; }
      else if (r.status === "absent") bucket.A++;
      else if (r.status === "leave") bucket.L++;
      else if (r.status === "holiday") bucket.H++;
      const late = lateMinutes(r.checkIn);
      if (late > 0) { bucket.Late++; bucket.LateMin += late; }
      bucket.OffLvMin += r.officialLeaveMin ?? 0;
      bucket.PerLvMin += r.personalLeaveMin ?? 0;
      bucket.WorkedMin += workedMinutesForDay(r.status, late, r.personalLeaveMin ?? 0);
    }
    return m;
  }, [records]);

  const cellFor = (emp: Emp, y: number, mo: number) =>
    byEmpMonth.get(`${emp.id}-${y}-${mo}`) || { P: 0, A: 0, L: 0, H: 0, Half: 0, Late: 0, LateMin: 0, WorkedMin: 0, MarkedDays: 0, OffLvMin: 0, PerLvMin: 0 };

  const totalsFor = (emp: Emp) => {
    let P = 0, A = 0, L = 0, H = 0, Half = 0, Late = 0, LateMin = 0, WorkedMin = 0, MarkedDays = 0, OffLvMin = 0, PerLvMin = 0;
    for (const ym of months) {
      const t = cellFor(emp, ym.y, ym.m);
      P += t.P; A += t.A; L += t.L; H += t.H; Half += t.Half; Late += t.Late; LateMin += t.LateMin; WorkedMin += t.WorkedMin; MarkedDays += t.MarkedDays;
      OffLvMin += t.OffLvMin; PerLvMin += t.PerLvMin;
    }
    const percent = workPercent(WorkedMin, MarkedDays);
    return {
      P, A, L, H, Half, Late, LateMin, WorkedMin, MarkedDays, OffLvMin, PerLvMin,
      status: workStatus(percent), percent,
      net: P + L + H,
    };
  };

  const [sort, setSort] = useState<SortKey>("id");
  const activeEmps = useMemo(
    () => sortEmployees(employees.filter(e => e.status === "active"), sort),
    [employees, sort]
  );

  const rangeLabel = `${MONTHS[from.m - 1]} ${from.y} – ${MONTHS[to.m - 1]} ${to.y}`;

  // Live "time required" per month — only counts calendar days actually marked
  // so far in that month (not the whole month), same live scoping as the yield %.
  const requiredByMonth = useMemo(() => {
    const activeIds = new Set(activeEmps.map(e => e.id));
    const daysByMonth = new Map<string, Set<number>>();
    for (const r of records) {
      if (!activeIds.has(r.employeeId) || !countsTowardYield(r.status)) continue;
      const key = `${r.date.slice(0, 4)}-${r.date.slice(5, 7)}`;
      if (!daysByMonth.has(key)) daysByMonth.set(key, new Set());
      daysByMonth.get(key)!.add(parseInt(r.date.slice(8, 10)));
    }
    return months.map(ym => {
      const key = `${ym.y}-${String(ym.m).padStart(2, "0")}`;
      const markedDays = daysByMonth.get(key)?.size || 0;
      return {
        label: `${MONTHS[ym.m - 1].slice(0, 3)} ${String(ym.y).slice(2)}`,
        markedDays,
        requiredMinutes: markedDays * DAILY_EXPECTED_MINUTES,
      };
    });
  }, [records, months, activeEmps]);

  const exportCSV = () => {
    const headers = ["Emp ID", "Full Name", "Department", "Designation"];
    for (const ym of months) {
      const lbl = `${MONTHS[ym.m - 1].slice(0, 3)} ${String(ym.y).slice(2)}`;
      headers.push(`${lbl} P`, `${lbl} A`, `${lbl} L`, `${lbl} H`);
    }
    headers.push("Total P", "Total A", "Total L", "Total H", "Total Half", "Total Late Days", "Total Late Time (incl. personal lv)", "Official Lv", "Personal Lv", "Net Days", "Worked Hrs", "Status %");
    const rows = activeEmps.map(e => {
      const r: (string | number)[] = [e.employeeId, `${e.firstName} ${e.lastName}`, e.department || "", e.designation || ""];
      for (const ym of months) {
        const c = cellFor(e, ym.y, ym.m);
        r.push(c.P, c.A, c.L, c.H);
      }
      const t = totalsFor(e);
      r.push(t.P, t.A, t.L, t.H, t.Half, t.Late, formatLate(t.LateMin + t.PerLvMin),
        t.OffLvMin ? formatHoursHM(t.OffLvMin) : "", t.PerLvMin ? formatHoursHM(t.PerLvMin) : "",
        t.net, formatHoursHM(t.WorkedMin), formatPercent(t.percent));
      return r;
    });
    downloadCSV(`attendance-range-${from.y}-${from.m}-to-${to.y}-${to.m}.csv`, headers, rows);
  };

  return (
    <>
      <PrintLandscape />
      <PrintHeader title="Attendance Register" subtitle={rangeLabel} />

      <RangeToolbar
        pathname={pathname}
        from={`${from.y}-${String(from.m).padStart(2, "0")}`}
        to={`${to.y}-${String(to.m).padStart(2, "0")}`}
        onPrint={printLandscape}
        onExport={exportCSV}
        years={years}
        sort={sort}
        onSortChange={setSort}
      />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 12, fontSize: 12, color: "var(--text2)" }}>
        <strong style={{ color: "var(--text)" }}>Codes:</strong>
        <Chip code="P" label="Present (incl. half-day)" />
        <Chip code="A" label="Absent" />
        <Chip code="L" label="Leave" />
        <Chip code="H" label="Holiday" />
        <Chip code="Lt" label="Late arrivals" />
        <Chip code="OL" label="Official hourly leave (excused)" />
        <Chip code="PL" label="Personal hourly leave (deducted like lateness)" />
        <span style={{ marginLeft: 8 }}>Net = P + L + H · {months.length} month{months.length === 1 ? "" : "s"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 8 }}>
          <StatusBadge status="ok" percent={97} /> / <StatusBadge status="not-ok" percent={80} />
          <span>= live yield: worked hours ÷ expected hours for days marked so far × 100 (8:10–16:45, 1h break, minus lateness)</span>
        </span>
      </div>

      <RequiredHoursPanel months={requiredByMonth} />

      <div className="card range-wrap" style={{ padding: 0, overflow: "auto" }}>
        <table className="range-table">
          <thead>
            <tr className="range-banner">
              <th colSpan={4 + months.length * 4 + 12} style={{
                textAlign: "center", fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "#fff",
                background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)",
                padding: "10px 8px", textTransform: "uppercase",
              }}>
                📋 Attendance Register — {rangeLabel}
              </th>
            </tr>
            <tr>
              <th rowSpan={2}>Emp ID</th>
              <th rowSpan={2}>Full Name</th>
              <th rowSpan={2}>Department</th>
              <th rowSpan={2}>Designation</th>
              {months.map(ym => (
                <th key={`${ym.y}-${ym.m}`} colSpan={4} className="month-h">
                  {MONTHS[ym.m - 1].slice(0, 3)} {String(ym.y).slice(2)}
                </th>
              ))}
              <th colSpan={12} className="tot-group-h">Totals</th>
            </tr>
            <tr>
              {months.flatMap(ym => [
                <th key={`${ym.y}-${ym.m}-P`} className="sub-h" style={{ color: STATUS_COLORS.P.color }}>P</th>,
                <th key={`${ym.y}-${ym.m}-A`} className="sub-h" style={{ color: STATUS_COLORS.A.color }}>A</th>,
                <th key={`${ym.y}-${ym.m}-L`} className="sub-h" style={{ color: STATUS_COLORS.L.color }}>L</th>,
                <th key={`${ym.y}-${ym.m}-H`} className="sub-h" style={{ color: STATUS_COLORS.H.color }}>H</th>,
              ])}
              <th className="sub-h" style={{ color: STATUS_COLORS.P.color, background: "#f3eee4" }}>P</th>
              <th className="sub-h" style={{ color: "#1D4ED8", background: "#f3eee4" }}>½</th>
              <th className="sub-h" style={{ color: STATUS_COLORS.A.color, background: "#f3eee4" }}>A</th>
              <th className="sub-h" style={{ color: STATUS_COLORS.L.color, background: "#f3eee4" }}>L</th>
              <th className="sub-h" style={{ color: STATUS_COLORS.H.color, background: "#f3eee4" }}>H</th>
              <th className="sub-h" style={{ color: "#DC2626", background: "#f3eee4" }}>Lt</th>
              <th className="sub-h" style={{ color: "#DC2626", background: "#f3eee4" }} title="Lateness + personal hourly leave">Late Time</th>
              <th className="sub-h" style={{ color: "#0E7490", background: "#f3eee4" }} title="Official hourly leave — excused, not deducted">OL</th>
              <th className="sub-h" style={{ color: "#9333EA", background: "#f3eee4" }} title="Personal hourly leave — deducted like lateness">PL</th>
              <th className="sub-h" style={{ background: "#f3eee4" }}>Net</th>
              <th className="sub-h" style={{ background: "#f3eee4" }}>Worked Hrs</th>
              <th className="sub-h" style={{ background: "#f3eee4" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {activeEmps.length === 0 && (
              <tr><td colSpan={4 + months.length * 4 + 12} className="empty">No active employees.</td></tr>
            )}
            {activeEmps.map(emp => {
              const t = totalsFor(emp);
              return (
                <tr key={emp.id}>
                  <td className="emp-id">{emp.employeeId}</td>
                  <td className="emp-name">{emp.firstName} {emp.lastName}</td>
                  <td className="emp-dept">{emp.department || "—"}</td>
                  <td className="emp-desig">{emp.designation || "—"}</td>
                  {months.flatMap(ym => {
                    const c = cellFor(emp, ym.y, ym.m);
                    return [
                      <Num key={`${ym.y}-${ym.m}-P`} v={c.P} c={STATUS_COLORS.P.color} />,
                      <Num key={`${ym.y}-${ym.m}-A`} v={c.A} c={STATUS_COLORS.A.color} />,
                      <Num key={`${ym.y}-${ym.m}-L`} v={c.L} c={STATUS_COLORS.L.color} />,
                      <Num key={`${ym.y}-${ym.m}-H`} v={c.H} c={STATUS_COLORS.H.color} />,
                    ];
                  })}
                  <Tot v={t.P} c={STATUS_COLORS.P.color} />
                  <Tot v={t.Half} c="#1D4ED8" />
                  <Tot v={t.A} c={STATUS_COLORS.A.color} />
                  <Tot v={t.L} c={STATUS_COLORS.L.color} />
                  <Tot v={t.H} c={STATUS_COLORS.H.color} />
                  <Tot v={t.Late} c="#DC2626" />
                  <td style={{ color: "#DC2626", fontWeight: 700, background: "#fdf8ee", fontSize: 11 }}>{formatLate(t.LateMin + t.PerLvMin)}</td>
                  <td style={{ color: "#0E7490", fontWeight: 700, background: "#fdf8ee", fontSize: 11 }}>{t.OffLvMin ? formatHoursHM(t.OffLvMin) : ""}</td>
                  <td style={{ color: "#9333EA", fontWeight: 700, background: "#fdf8ee", fontSize: 11 }}>{t.PerLvMin ? formatHoursHM(t.PerLvMin) : ""}</td>
                  <Tot v={t.net} c="var(--brand)" />
                  <td style={{ fontWeight: 700, background: "#fdf8ee", fontSize: 11 }}>{formatHoursHM(t.WorkedMin)}</td>
                  <td style={{ background: "#fdf8ee" }}><StatusBadge status={t.status} percent={t.percent} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .range-wrap { max-width: 100%; }
        .range-table { border-collapse: collapse; font-size: 11px; background: var(--bg); width: max-content; min-width: 100%; }
        .range-table th, .range-table td {
          border: 1px solid var(--border);
          padding: 5px 6px; text-align: center; background: var(--bg); white-space: nowrap;
        }
        .range-table thead th { background: var(--bg2); color: var(--text); font-weight: 700; font-size: 11px; }
        .range-table .month-h { font-weight: 700; background: #f3eee4; color: var(--brand-dark); }
        .range-table .tot-group-h { font-weight: 800; background: var(--brand); color: #fff; letter-spacing: 0.5px; }
        .range-table .sub-h { font-size: 10.5px; font-weight: 700; padding: 3px 6px; }
        .range-table .emp-id { font-weight: 700; color: var(--brand); text-align: left; padding-left: 10px; }
        .range-table .emp-name { font-weight: 600; text-align: left; padding-left: 10px; }
        .range-table .emp-dept, .range-table .emp-desig { text-align: left; padding-left: 10px; color: var(--text2); }
        .range-table tbody tr:hover td { background: var(--bg2); }

        @media print {
          @page { size: A3 landscape; margin: 8mm; }
          .range-banner { display: table-row !important; }
          .range-wrap { overflow: visible !important; border: none !important; box-shadow: none !important; }
          .range-table { font-size: 9.5px; width: 100%; }
          .range-table th, .range-table td { padding: 3px 3px; }
        }
      `}</style>
    </>
  );
}

function Chip({ code, label }: { code: keyof typeof STATUS_COLORS; label: string }) {
  const { color, bg } = STATUS_COLORS[code];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 20, height: 18, padding: "0 5px",
        borderRadius: 4, background: bg, color, fontSize: 10, fontWeight: 800,
      }}>{code}</span>
      <span style={{ fontSize: 11 }}>= {label}</span>
    </span>
  );
}

function Num({ v, c }: { v: number; c: string }) {
  return <td style={{ color: v > 0 ? c : "var(--text3)", fontWeight: v > 0 ? 700 : 400 }}>{v || ""}</td>;
}
function Tot({ v, c }: { v: number; c: string }) {
  return <td style={{ color: c, fontWeight: 700, background: "#fdf8ee" }}>{v || (typeof v === "number" ? 0 : "")}</td>;
}
