import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardView } from "@/lib/auth";
import { attendanceDevices, attendanceDeviceUsers, devicePunches, employees } from "@/lib/schema";
import { ensureDeviceTables, errorResponse } from "@/lib/deviceServer";
import { buildDayTimeline, buildMoves, DayTimeline, deviceOvertimeMinutes, isNightShift } from "@/lib/deviceAttendance";
import { SHIFT_END } from "@/lib/attendance";
import { karachiNow } from "@/lib/gateTime";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DeviceDayRow = {
  key: string;                // employee id, or device user for unlinked punchers
  employeeId: number | null;
  employeeCode: string | null;
  name: string;
  department: string | null;
  deviceUserIds: string[];
  timeline: DayTimeline;
  nightShift: boolean;        // first IN at or after NIGHT_SHIFT_FROM: nothing is filled from the device
  overtimeMinutes: number;    // inside after SHIFT_END (all of it on Sunday), not rounded; 0 on a night shift
};

// GET /api/attendance/device-day?date=YYYY-MM-DD  (Karachi day, default today)
// Everyone's IN/OUT moves for a work day, built from the raw device punches.
// A work day includes a shift's punches after midnight (e.g. an OUT at 02:00
// after overtime), so punches are read from the day before to the day after.
// Punches from device users not linked to an employee are listed by their
// device name. Active employees with no punches come back in `noPunches`.
// -> { date, today, lastSyncAt, rows: DeviceDayRow[], noPunches[] }
export async function GET(req: NextRequest) {
  const guard = await guardView("attendance");
  if (guard instanceof NextResponse) return guard;

  const today = karachiNow().date;
  const date = req.nextUrl.searchParams.get("date") ?? today;
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });

  // Karachi has no DST, so a local day is a fixed +05:00 window. Read the day
  // before (to know who was still inside) through the day after (overnight OUTs).
  const DAY_MS = 24 * 3600 * 1000;
  const dayStart = new Date(`${date}T00:00:00+05:00`);
  const from = new Date(dayStart.getTime() - DAY_MS);
  const to = new Date(dayStart.getTime() + 2 * DAY_MS);
  const isToday = date === today;
  const now = new Date();

  try {
    await ensureDeviceTables();
    const [punches, active, devices] = await Promise.all([
      db.select({
        deviceSerial: devicePunches.deviceSerial,
        deviceUserId: devicePunches.deviceUserId,
        punchedAt: devicePunches.punchedAt,
        punchState: devicePunches.punchState,
        verifyMethod: devicePunches.verifyMethod,
        deviceName: attendanceDeviceUsers.name,
        employeeId: employees.id,
        employeeCode: employees.employeeId,
        firstName: employees.firstName,
        lastName: employees.lastName,
        department: employees.department,
      })
        .from(devicePunches)
        .leftJoin(attendanceDeviceUsers, and(
          eq(attendanceDeviceUsers.deviceSerial, devicePunches.deviceSerial),
          eq(attendanceDeviceUsers.deviceUserId, devicePunches.deviceUserId),
        ))
        .leftJoin(employees, eq(employees.id, attendanceDeviceUsers.employeeId))
        .where(and(
          sql`${devicePunches.punchedAt} >= ${from.toISOString()}`,
          sql`${devicePunches.punchedAt} < ${to.toISOString()}`,
        )),
      db.select({
        id: employees.id, employeeCode: employees.employeeId,
        firstName: employees.firstName, lastName: employees.lastName, department: employees.department,
      }).from(employees).where(eq(employees.status, "active")),
      db.select({ lastSeenAt: attendanceDevices.lastSeenAt }).from(attendanceDevices),
    ]);

    // Group by employee when linked, so someone enrolled twice is one person.
    const groups = new Map<string, Omit<DeviceDayRow, "timeline" | "nightShift" | "overtimeMinutes"> & { punches: typeof punches }>();
    for (const p of punches) {
      const key = p.employeeId !== null ? `e${p.employeeId}` : `d${p.deviceSerial}/${p.deviceUserId}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          employeeId: p.employeeId,
          employeeCode: p.employeeCode,
          name: p.employeeId !== null ? `${p.firstName} ${p.lastName}`.replace(/\s+/g, " ") : (p.deviceName || `Device user ${p.deviceUserId}`),
          department: p.department,
          deviceUserIds: [],
          punches: [],
        };
        groups.set(key, g);
      }
      if (!g.deviceUserIds.includes(p.deviceUserId)) g.deviceUserIds.push(p.deviceUserId);
      g.punches.push(p);
    }

    const rows: DeviceDayRow[] = [];
    for (const { punches: ps, ...g } of groups.values()) {
      const moves = buildMoves(ps);
      const day = moves.filter(m => m.workDay === date);
      if (!day.length) continue;
      const next = moves.find(m => m.workDay > date);
      const timeline = buildDayTimeline(day, next, now);
      const nightShift = isNightShift(timeline.firstIn);
      rows.push({ ...g, timeline, nightShift, overtimeMinutes: nightShift ? 0 : deviceOvertimeMinutes(timeline.spells, date, SHIFT_END) });
    }
    rows.sort((a, b) => a.timeline.moves[0].at.localeCompare(b.timeline.moves[0].at));

    const seen = new Set(rows.map(r => r.employeeId).filter(id => id !== null));
    const noPunches = active
      .filter(e => !seen.has(e.id))
      .map(e => ({ id: e.id, employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`.replace(/\s+/g, " "), department: e.department }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const lastSyncAt = devices.reduce<Date | null>((m, d) => (!m || d.lastSeenAt > m ? d.lastSeenAt : m), null);
    return NextResponse.json({ date, today: isToday, lastSyncAt, rows, noPunches });
  } catch (e) {
    return errorResponse(e);
  }
}
