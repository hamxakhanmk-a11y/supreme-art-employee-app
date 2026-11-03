import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardView } from "@/lib/auth";
import { attendanceDevices, attendanceDeviceUsers, devicePunches, employees } from "@/lib/schema";
import { ensureDeviceTables, errorResponse } from "@/lib/deviceServer";
import { karachiNow } from "@/lib/gateTime";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 1000;

// GET /api/attendance/device-log?date=YYYY-MM-DD&user=<deviceUserId>
// Raw punches as received from the biometric device bridge, for checking the
// feed. date is a Karachi day (default today); user narrows to one device user.
// -> { date, devices[], punches[], dayTotal, storedTotal }
export async function GET(req: NextRequest) {
  const guard = await guardView("attendance");
  if (guard instanceof NextResponse) return guard;

  const params = req.nextUrl.searchParams;
  const date = params.get("date") ?? karachiNow().date;
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const user = params.get("user")?.trim() || null;

  // Karachi has no DST, so a local day is a fixed +05:00 window.
  const from = new Date(`${date}T00:00:00+05:00`);
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  const where = and(
    sql`${devicePunches.punchedAt} >= ${from.toISOString()}`,
    sql`${devicePunches.punchedAt} < ${to.toISOString()}`,
    user ? eq(devicePunches.deviceUserId, user) : undefined,
  );

  try {
    await ensureDeviceTables();
    const [devices, punches, [day], [stored]] = await Promise.all([
      db.select().from(attendanceDevices).orderBy(attendanceDevices.serial),
      db.select({
        id: devicePunches.id,
        deviceSerial: devicePunches.deviceSerial,
        deviceUserId: devicePunches.deviceUserId,
        punchedAt: devicePunches.punchedAt,
        verifyMethod: devicePunches.verifyMethod,
        punchState: devicePunches.punchState,
        receivedAt: devicePunches.receivedAt,
        deviceName: attendanceDeviceUsers.name,
        employeeCode: employees.employeeId,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
        .from(devicePunches)
        .leftJoin(attendanceDeviceUsers, and(
          eq(attendanceDeviceUsers.deviceSerial, devicePunches.deviceSerial),
          eq(attendanceDeviceUsers.deviceUserId, devicePunches.deviceUserId),
        ))
        .leftJoin(employees, eq(employees.id, attendanceDeviceUsers.employeeId))
        .where(where)
        .orderBy(desc(devicePunches.punchedAt), desc(devicePunches.id))
        .limit(MAX_ROWS),
      db.select({ n: sql<number>`count(*)::int` }).from(devicePunches).where(where),
      db.select({ n: sql<number>`count(*)::int` }).from(devicePunches),
    ]);
    return NextResponse.json({ date, devices, punches, dayTotal: day.n, storedTotal: stored.n });
  } catch (e) {
    return errorResponse(e);
  }
}
