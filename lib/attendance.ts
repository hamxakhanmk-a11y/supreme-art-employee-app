// Single source of truth for "how late" an employee's check-in was.
export const DEFAULT_CHECK_IN = "08:00";

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
