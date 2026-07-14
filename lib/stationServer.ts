import { db } from "@/lib/db";
import { stationLeaves } from "@/lib/schema";
import { and, gte, lte, isNotNull } from "drizzle-orm";

// Sum of completed Station leave minutes per (employeeId, date), split by type.
// Fed into the attendance register so its OL/PL columns reflect Station punches
// (only "personal" is deducted from worked hours). Server-only (imports db) —
// keep it out of lib/station.ts, which is imported by client components.
export type LeaveMins = { official: number; personal: number };

export async function stationMinutesByEmpDay(fromISO: string, toISO: string): Promise<Map<string, LeaveMins>> {
  const rows = await db.select({
    employeeId: stationLeaves.employeeId, date: stationLeaves.date,
    type: stationLeaves.type, minutes: stationLeaves.minutes,
  }).from(stationLeaves).where(and(
    gte(stationLeaves.date, fromISO), lte(stationLeaves.date, toISO), isNotNull(stationLeaves.minutes),
  ));
  const map = new Map<string, LeaveMins>();
  for (const r of rows) {
    const k = `${r.employeeId}-${r.date}`;
    const a = map.get(k) ?? { official: 0, personal: 0 };
    if (r.type === "official") a.official += r.minutes ?? 0; else a.personal += r.minutes ?? 0;
    map.set(k, a);
  }
  return map;
}
