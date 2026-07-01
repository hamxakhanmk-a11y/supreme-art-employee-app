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
