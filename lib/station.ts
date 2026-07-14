// Shared helpers for the Station terminal (hourly in/out leave punches).

export const LEAVE_TYPES = ["personal", "official"] as const;
export type LeaveType = typeof LEAVE_TYPES[number];

export const LEAVE_STYLE: Record<LeaveType, { label: string; color: string; bg: string }> = {
  personal: { label: "Personal", color: "#9333EA", bg: "#f3e8ff" }, // deducted from worked hours
  official: { label: "Official", color: "#0E7490", bg: "#cffafe" }, // excused, not deducted
};

// "14:37" from a Date/ISO string.
export function hhmm(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatMins(min: number | null | undefined): string {
  const m = Math.max(0, Math.round(min ?? 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}
