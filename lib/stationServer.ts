import { db } from "@/lib/db";
import { stationLeaves, employees } from "@/lib/schema";
import { and, gte, lte, isNotNull, isNull, eq, desc, sql } from "drizzle-orm";

// Idempotently add the punch-out reason column. Called before any read/write
// that touches it, so production self-migrates on deploy without a manual step.
let reasonColumnEnsured = false;
export async function ensureStationReasonColumn() {
  if (reasonColumnEnsured) return;
  await db.execute(sql`ALTER TABLE station_leaves ADD COLUMN IF NOT EXISTS reason varchar(200)`);
  reasonColumnEnsured = true;
}

// Sum of completed Station leave minutes per (employeeId, date), split by type.
// Fed into the attendance register so its OL/PL columns reflect Station punches
// (only "personal" is deducted from worked hours). Server-only (imports db) —
// keep it out of lib/station.ts, which is imported by client components.
export type LeaveMins = { official: number; personal: number };

// One row per trip (punch-out → punch-in), newest first, for the Station report.
export interface StationTrip {
  id: number;
  employeeId: number;
  empCode: string;
  name: string;
  department: string | null;
  date: string;
  outAt: string;
  inAt: string | null;
  type: string;
  reason: string | null;
  minutes: number | null;
}

export async function stationTrips(fromISO: string, toISO: string): Promise<StationTrip[]> {
  await ensureStationReasonColumn();
  const rows = await db.select({
    id: stationLeaves.id,
    employeeId: stationLeaves.employeeId,
    empCode: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
    department: employees.department,
    date: stationLeaves.date,
    outAt: stationLeaves.outAt,
    inAt: stationLeaves.inAt,
    type: stationLeaves.type,
    reason: stationLeaves.reason,
    minutes: stationLeaves.minutes,
  }).from(stationLeaves)
    .innerJoin(employees, eq(employees.id, stationLeaves.employeeId))
    .where(and(gte(stationLeaves.date, fromISO), lte(stationLeaves.date, toISO)))
    .orderBy(desc(stationLeaves.outAt));

  // Serialise timestamps so the rows can cross into a client component.
  return rows.map(r => ({
    id: r.id,
    employeeId: r.employeeId,
    empCode: r.empCode,
    name: `${r.firstName} ${r.lastName}`,
    department: r.department,
    date: r.date,
    outAt: new Date(r.outAt).toISOString(),
    inAt: r.inAt ? new Date(r.inAt).toISOString() : null,
    type: r.type,
    reason: r.reason,
    minutes: r.minutes,
  }));
}

// Everyone currently outside the factory — one row per open trip (inAt IS NULL),
// oldest punch-out first. Powers the "Who's Out" board on the Station terminal.
export interface OutNow {
  id: number;
  employeeId: number;
  empCode: string;
  name: string;
  designation: string | null;
  department: string | null;
  outAt: string;            // ISO — punch-out time
  type: string;             // personal | official
  reason: string | null;
}

export async function currentlyOut(): Promise<OutNow[]> {
  await ensureStationReasonColumn();
  const rows = await db.select({
    id: stationLeaves.id,
    employeeId: stationLeaves.employeeId,
    empCode: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
    designation: employees.designation,
    department: employees.department,
    outAt: stationLeaves.outAt,
    type: stationLeaves.type,
    reason: stationLeaves.reason,
  }).from(stationLeaves)
    .innerJoin(employees, eq(employees.id, stationLeaves.employeeId))
    .where(isNull(stationLeaves.inAt))
    .orderBy(stationLeaves.outAt);

  return rows.map(r => ({
    id: r.id,
    employeeId: r.employeeId,
    empCode: r.empCode,
    name: `${r.firstName} ${r.lastName}`,
    designation: r.designation,
    department: r.department,
    outAt: new Date(r.outAt).toISOString(),
    type: r.type,
    reason: r.reason,
  }));
}

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
