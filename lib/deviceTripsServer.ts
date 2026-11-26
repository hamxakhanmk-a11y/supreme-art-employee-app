// Server side of the fingerprint device's mid-day trips (see lib/deviceTrips.ts):
// finds them in the punches, keeps them as tickets in station_device_trips,
// and turns an approved one into a normal Station trip (station_leaves), which
// the register then counts the same way as a gate PIN trip.
import { db } from "@/lib/db";
import { attendanceDeviceUsers, devicePunches, employees, stationDeviceTrips, stationLeaves } from "@/lib/schema";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { ensureDeviceTables } from "@/lib/deviceServer";
import { ensureStationReasonColumn } from "@/lib/stationServer";
import { buildMoves } from "@/lib/deviceAttendance";
import { findDeviceTrips, type DeviceTripKind } from "@/lib/deviceTrips";
import { karachiNow } from "@/lib/gateTime";
import { SHIFT_END } from "@/lib/attendance";

// How far back tickets are looked for.
export const DEVICE_TRIP_DAYS = 7;
// A gate PIN trip starting this close to a device OUT is the same trip.
const PIN_MATCH_MINUTES = 15;
const DAY_MS = 86_400_000;

let ensured = false;
export async function ensureDeviceTripsTable() {
  if (ensured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS station_device_trips (
      id serial PRIMARY KEY,
      employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date date NOT NULL,
      out_at timestamptz NOT NULL,
      in_at timestamptz,
      kind varchar(12) NOT NULL,
      status varchar(12) NOT NULL DEFAULT 'pending',
      station_leave_id integer,
      decided_by varchar(120),
      decided_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS station_device_trips_emp_out_uq ON station_device_trips (employee_id, out_at)`);
  ensured = true;
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/**
 * Find trips in the last DEVICE_TRIP_DAYS of punches from linked employees and
 * store new ones. A pending ticket gets its return filled in when that punch
 * arrives; decided tickets are never changed.
 */
export async function syncDeviceTrips() {
  await Promise.all([ensureDeviceTables(), ensureDeviceTripsTable(), ensureStationReasonColumn()]);
  const today = karachiNow().date;
  const fromDay = addDays(today, -DEVICE_TRIP_DAYS);
  // From the day before, so a shift running into fromDay is known.
  const from = new Date(Date.parse(`${fromDay}T00:00:00+05:00`) - DAY_MS);

  const [punches, pinTrips] = await Promise.all([
    db.select({
      employeeId: attendanceDeviceUsers.employeeId,
      punchedAt: devicePunches.punchedAt,
      punchState: devicePunches.punchState,
      verifyMethod: devicePunches.verifyMethod,
    }).from(devicePunches)
      .innerJoin(attendanceDeviceUsers, and(
        eq(attendanceDeviceUsers.deviceSerial, devicePunches.deviceSerial),
        eq(attendanceDeviceUsers.deviceUserId, devicePunches.deviceUserId),
      ))
      .where(and(isNotNull(attendanceDeviceUsers.employeeId), gte(devicePunches.punchedAt, from))),
    db.select({ id: stationLeaves.id, employeeId: stationLeaves.employeeId, outAt: stationLeaves.outAt })
      .from(stationLeaves).where(gte(stationLeaves.date, addDays(fromDay, -1))),
  ]);

  const byEmp = new Map<number, typeof punches>();
  for (const p of punches) {
    const list = byEmp.get(p.employeeId!) ?? [];
    list.push(p);
    byEmp.set(p.employeeId!, list);
  }

  const rows: (typeof stationDeviceTrips.$inferInsert)[] = [];
  for (const [employeeId, ps] of byEmp) {
    const moves = buildMoves(ps);
    const days = [...new Set(moves.map(m => m.workDay))].filter(d => d >= fromDay);
    for (const day of days) {
      const dayOver = day < today || moves.some(m => m.workDay > day);
      for (const t of findDeviceTrips(moves.filter(m => m.workDay === day), dayOver)) {
        const out = Date.parse(t.outAt);
        const pin = pinTrips.find(s => s.employeeId === employeeId && Math.abs(new Date(s.outAt).getTime() - out) <= PIN_MATCH_MINUTES * 60_000);
        rows.push({
          employeeId, date: t.workDay, outAt: new Date(t.outAt), inAt: t.inAt ? new Date(t.inAt) : null, kind: t.kind,
          ...(pin ? { status: "matched", stationLeaveId: pin.id } : {}),
        });
      }
    }
  }
  if (!rows.length) return;
  await db.insert(stationDeviceTrips).values(rows).onConflictDoUpdate({
    target: [stationDeviceTrips.employeeId, stationDeviceTrips.outAt],
    // A pending ticket picks up its return punch, or a gate PIN trip made since.
    set: { inAt: sql`excluded.in_at`, kind: sql`excluded.kind`, status: sql`excluded.status`, stationLeaveId: sql`excluded.station_leave_id` },
    setWhere: sql`${stationDeviceTrips.status} = 'pending'`,
  });
}

export type DeviceTripTicket = {
  id: number;
  employeeId: number;
  empCode: string;
  name: string;
  department: string | null;
  date: string;
  outAt: string;
  inAt: string | null;
  kind: DeviceTripKind;
  status: string;
  minutes: number;            // what approving would count (up to the shift end)
  type: string | null;        // the Station trip's type once approved
  decidedBy: string | null;
  decidedAt: string | null;
};

// Minutes a trip counts for, the Station way: up to the shift end on its day,
// and a trip with no return runs to the shift end.
function countedMinutes(date: string, outAt: Date, inAt: Date | null) {
  const end = Date.parse(`${date}T${SHIFT_END}:00+05:00`);
  const back = Math.min(inAt ? inAt.getTime() : end, end);
  return Math.max(0, Math.round((back - outAt.getTime()) / 60_000));
}

/** Every ticket in the last DEVICE_TRIP_DAYS, newest first. Syncs first. */
export async function deviceTripTickets(): Promise<DeviceTripTicket[]> {
  await syncDeviceTrips();
  const fromDay = addDays(karachiNow().date, -DEVICE_TRIP_DAYS);
  const rows = await db.select({
    t: stationDeviceTrips,
    empCode: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: employees.department,
    type: stationLeaves.type,
  }).from(stationDeviceTrips)
    .innerJoin(employees, eq(employees.id, stationDeviceTrips.employeeId))
    .leftJoin(stationLeaves, eq(stationLeaves.id, stationDeviceTrips.stationLeaveId))
    .where(gte(stationDeviceTrips.date, fromDay))
    .orderBy(sql`${stationDeviceTrips.outAt} desc`);
  return rows.map(({ t, ...r }) => ({
    id: t.id,
    employeeId: t.employeeId,
    empCode: r.empCode,
    name: `${r.firstName} ${r.lastName}`.replace(/\s+/g, " "),
    department: r.department,
    date: t.date,
    outAt: t.outAt.toISOString(),
    inAt: t.inAt ? t.inAt.toISOString() : null,
    kind: t.kind as DeviceTripKind,
    status: t.status,
    minutes: countedMinutes(t.date, t.outAt, t.inAt),
    type: r.type,
    decidedBy: t.decidedBy,
    decidedAt: t.decidedAt ? t.decidedAt.toISOString() : null,
  }));
}

export type TripDecision = "personal" | "official" | "left" | "dismiss" | "reopen";

export class TripDecisionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/**
 * Decide a ticket. personal / official writes a Station trip (minutes up to the
 * shift end, as at the gate). left = they went home, no trip. dismiss = not a
 * trip. reopen puts a decided ticket back to pending and removes the Station
 * trip it created.
 */
export async function decideDeviceTrip(id: number, decision: TripDecision, by: string, reason: string | null) {
  await ensureDeviceTripsTable();
  const [ticket] = await db.select().from(stationDeviceTrips).where(eq(stationDeviceTrips.id, id));
  if (!ticket) throw new TripDecisionError("Ticket not found", 404);

  if (decision === "reopen") {
    if (ticket.status === "pending" || ticket.status === "matched") throw new TripDecisionError("Only a decided ticket can be reopened", 409);
    const [row] = await db.update(stationDeviceTrips)
      .set({ status: "pending", stationLeaveId: null, decidedBy: null, decidedAt: null })
      .where(and(eq(stationDeviceTrips.id, id), eq(stationDeviceTrips.status, ticket.status))).returning();
    if (!row) throw new TripDecisionError("Someone else changed this ticket; reload", 409);
    if (ticket.status === "approved" && ticket.stationLeaveId) await db.delete(stationLeaves).where(eq(stationLeaves.id, ticket.stationLeaveId));
    return { ticket: row, previous: ticket.status };
  }

  if (ticket.status !== "pending") throw new TripDecisionError("This ticket has already been decided", 409);
  if (ticket.kind === "still-out") throw new TripDecisionError("They haven't punched back in yet. Decide it once they're back, or tomorrow.", 409);

  const status = decision === "personal" || decision === "official" ? "approved" : decision === "left" ? "left" : "dismissed";
  // Claim the ticket first so two admins can't both approve it.
  const [claimed] = await db.update(stationDeviceTrips)
    .set({ status, decidedBy: by, decidedAt: new Date() })
    .where(and(eq(stationDeviceTrips.id, id), eq(stationDeviceTrips.status, "pending"))).returning();
  if (!claimed) throw new TripDecisionError("Someone else decided this ticket; reload", 409);
  if (status !== "approved") return { ticket: claimed, previous: "pending" };

  await ensureStationReasonColumn();
  const end = new Date(Date.parse(`${ticket.date}T${SHIFT_END}:00+05:00`));
  const [leave] = await db.insert(stationLeaves).values({
    employeeId: ticket.employeeId,
    date: ticket.date,
    outAt: ticket.outAt,
    inAt: ticket.inAt ?? end,
    type: decision,
    reason: reason || (ticket.kind === "no-return" ? "Fingerprint device · didn't punch back in" : "Fingerprint device"),
    minutes: countedMinutes(ticket.date, ticket.outAt, ticket.inAt),
  }).returning();
  const [row] = await db.update(stationDeviceTrips).set({ stationLeaveId: leave.id }).where(eq(stationDeviceTrips.id, id)).returning();
  return { ticket: row, previous: "pending", leave };
}
