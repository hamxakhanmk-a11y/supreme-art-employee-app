import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardView, guardWrite } from "@/lib/auth";
import { attendanceDeviceUsers, devicePunches, employees } from "@/lib/schema";
import { ensureDeviceTables, errorResponse, readJsonObject, shortString } from "@/lib/deviceServer";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/attendance/device-users
// Users enrolled on the biometric devices with their employee link, plus the
// employees to link them to.
// -> { users: [{ deviceSerial, deviceUserId, name, privilege, employeeId, lastPunchAt, punches30d }], employees[] }
export async function GET() {
  const guard = await guardView("attendance");
  if (guard instanceof NextResponse) return guard;

  try {
    await ensureDeviceTables();
    const stats = db.select({
      deviceSerial: devicePunches.deviceSerial,
      deviceUserId: devicePunches.deviceUserId,
      lastPunchAt: sql<string>`max(${devicePunches.punchedAt})`.as("last_punch_at"),
      punches30d: sql<number>`count(*) filter (where ${devicePunches.punchedAt} > now() - interval '30 days')::int`.as("punches_30d"),
    }).from(devicePunches)
      .groupBy(devicePunches.deviceSerial, devicePunches.deviceUserId)
      .as("stats");

    const [users, emps] = await Promise.all([
      db.select({
        deviceSerial: attendanceDeviceUsers.deviceSerial,
        deviceUserId: attendanceDeviceUsers.deviceUserId,
        name: attendanceDeviceUsers.name,
        privilege: attendanceDeviceUsers.privilege,
        employeeId: attendanceDeviceUsers.employeeId,
        lastPunchAt: stats.lastPunchAt,
        punches30d: stats.punches30d,
      })
        .from(attendanceDeviceUsers)
        .leftJoin(stats, and(
          eq(stats.deviceSerial, attendanceDeviceUsers.deviceSerial),
          eq(stats.deviceUserId, attendanceDeviceUsers.deviceUserId),
        ))
        .orderBy(attendanceDeviceUsers.deviceSerial, sql`length(${attendanceDeviceUsers.deviceUserId})`, attendanceDeviceUsers.deviceUserId),
      db.select({
        id: employees.id,
        employeeId: employees.employeeId,
        firstName: employees.firstName,
        lastName: employees.lastName,
        department: employees.department,
        status: employees.status,
      }).from(employees).orderBy(employees.firstName, employees.lastName),
    ]);
    // max() comes back as Postgres text ("2026-11-03 09:35:46+00"); send ISO.
    const out = users.map(u => ({ ...u, lastPunchAt: u.lastPunchAt ? new Date(u.lastPunchAt).toISOString() : null }));
    return NextResponse.json({ users: out, employees: emps });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST { deviceSerial, deviceUserId, employeeId: number | null }
// Links a device user to an employee, or unlinks them with null. Punches are
// matched through this link when read, so past punches follow it too.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("attendance");
  if (guard instanceof NextResponse) return guard;

  const body = await readJsonObject(req);
  const deviceSerial = shortString(body?.deviceSerial, 40);
  const deviceUserId = shortString(body?.deviceUserId, 24);
  const employeeId = body?.employeeId === null ? null : Number.isInteger(body?.employeeId) ? (body?.employeeId as number) : undefined;
  if (!deviceSerial || !deviceUserId || employeeId === undefined) {
    return NextResponse.json({ error: "deviceSerial, deviceUserId and employeeId (or null) required" }, { status: 400 });
  }

  try {
    await ensureDeviceTables();
    const [user] = await db.select().from(attendanceDeviceUsers).where(and(
      eq(attendanceDeviceUsers.deviceSerial, deviceSerial),
      eq(attendanceDeviceUsers.deviceUserId, deviceUserId),
    ));
    if (!user) return NextResponse.json({ error: "Device user not found" }, { status: 404 });

    let emp: { firstName: string; lastName: string; employeeId: string } | undefined;
    if (employeeId !== null) {
      [emp] = await db.select({ firstName: employees.firstName, lastName: employees.lastName, employeeId: employees.employeeId })
        .from(employees).where(eq(employees.id, employeeId));
      if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      const [taken] = await db.select({ deviceUserId: attendanceDeviceUsers.deviceUserId, name: attendanceDeviceUsers.name })
        .from(attendanceDeviceUsers).where(and(
          eq(attendanceDeviceUsers.deviceSerial, deviceSerial),
          eq(attendanceDeviceUsers.employeeId, employeeId),
          ne(attendanceDeviceUsers.deviceUserId, deviceUserId),
        ));
      if (taken) {
        return NextResponse.json({
          error: `${emp.firstName} ${emp.lastName} is already linked to device user ${taken.deviceUserId}${taken.name ? ` (${taken.name})` : ""}. Unlink them there first.`,
        }, { status: 409 });
      }
    }

    await db.update(attendanceDeviceUsers).set({ employeeId }).where(and(
      eq(attendanceDeviceUsers.deviceSerial, deviceSerial),
      eq(attendanceDeviceUsers.deviceUserId, deviceUserId),
    ));

    const who = `device user ${deviceUserId}${user.name ? ` (${user.name})` : ""}`;
    await logActivity(employeeId !== null
      ? { user: guard, action: "attendance.device_link", summary: `linked to ${who}`, employeeId }
      : { user: guard, action: "attendance.device_unlink", summary: `unlinked ${who}`, employeeId: user.employeeId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
