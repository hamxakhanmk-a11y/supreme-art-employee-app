// Single source of truth for "how late" an employee's check-in was.
export const DEFAULT_CHECK_IN = "08:10";

export function lateMinutes(checkIn: string | null | undefined): number {
  if (!checkIn) return 0;
  const [ih, im] = checkIn.split(":").map(Number);
  const [dh, dm] = DEFAULT_CHECK_IN.split(":").map(Number);
  const diff = (ih * 60 + im) - (dh * 60 + dm);
  return diff > 0 ? diff : 0;
}

export function formatLate(minutes: number, compact = false): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const sep = compact ? "" : " ";
  if (h > 0) return m > 0 ? `${h}h${sep}${m}m` : `${h}h`;
  return `${m}m`;
}

// Shift: 08:10–16:45 with a 1-hour break in between -> 7h35m expected per working day.
// Sunday is the only off day (handled by callers, which skip/zero it via attendance status).
export const SHIFT_START = DEFAULT_CHECK_IN;
export const SHIFT_END = "16:45";
export const BREAK_MINUTES = 60;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export const DAILY_EXPECTED_MINUTES = toMinutes(SHIFT_END) - toMinutes(SHIFT_START) - BREAK_MINUTES;

// Total expected monthly hours: 48h/week (6-day week, Sunday off) x 4 weeks.
// Kept as the reference figure the 93.75% cutoff below is derived from (180 / 192).
export const TOTAL_MONTHLY_HOURS = 192;

// Flat monthly cutoff (out of TOTAL_MONTHLY_HOURS) below which yield is "Not OK".
export const MONTHLY_MIN_HOURS = 180;
export const MIN_YIELD_PERCENT = (MONTHLY_MIN_HOURS / TOTAL_MONTHLY_HOURS) * 100;

// Minutes credited for one day, given its status and how late the check-in was.
// Present = full expected shift minus lateness; half-day = half credit minus lateness;
// absent/leave/holiday = 0 (the employee wasn't clocked in for the shift).
export function workedMinutesForDay(status: string | null | undefined, late: number): number {
  if (status === "present") return Math.max(0, DAILY_EXPECTED_MINUTES - late);
  if (status === "half-day") return Math.max(0, DAILY_EXPECTED_MINUTES / 2 - late);
  return 0;
}

// Only present/half-day/absent are days the employee was expected to clock in for —
// these are what the live yield % is measured against. Holiday (Sunday is marked as
// a holiday, since there's no separate "off day" status) and approved leave are paid
// non-working days and must NOT count toward the denominator, or every Sunday/leave
// day would silently drag everyone's yield down despite nobody being expected to work.
export function countsTowardYield(status: string | null | undefined): boolean {
  return status === "present" || status === "half-day" || status === "absent";
}

export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export type WorkStatus = "ok" | "not-ok";

export function workStatus(percent: number): WorkStatus {
  return percent >= MIN_YIELD_PERCENT ? "ok" : "not-ok";
}

// Live yield: hours worked so far ÷ expected hours for the days actually marked
// so far (not the whole month) x 100 — e.g. after 6 marked days it's worked ÷ (6 x 7h35m).
export function workPercent(workedMinutes: number, markedDays: number): number {
  if (markedDays <= 0) return 0;
  return (workedMinutes / (markedDays * DAILY_EXPECTED_MINUTES)) * 100;
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

// Sort options for the attendance register's employee rows.
export const SORT_OPTIONS = [
  { value: "name",    label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
  { value: "id",      label: "Employee ID" },
  { value: "department", label: "Department" },
  { value: "newest",  label: "Latest added" },
  { value: "oldest",  label: "Oldest added" },
] as const;

export type SortKey = typeof SORT_OPTIONS[number]["value"];

type SortableEmp = {
  firstName: string;
  lastName: string;
  employeeId: string;
  department: string | null;
  createdAt?: string | Date | null;
};

export function sortEmployees<T extends SortableEmp>(emps: T[], sort: SortKey): T[] {
  const arr = [...emps];
  const byCreated = (a: T, b: T) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  switch (sort) {
    case "name":
      arr.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      break;
    case "nameDesc":
      arr.sort((a, b) => `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`));
      break;
    case "id":
      arr.sort((a, b) => a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true }));
      break;
    case "department":
      arr.sort((a, b) => (a.department || "").localeCompare(b.department || ""));
      break;
    case "newest":
      arr.sort((a, b) => byCreated(b, a));
      break;
    case "oldest":
      arr.sort(byCreated);
      break;
  }
  return arr;
}
