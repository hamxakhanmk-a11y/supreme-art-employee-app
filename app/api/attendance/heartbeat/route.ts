import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendanceDevices, attendanceDeviceUsers } from "@/lib/schema";
import {
  ensureDeviceTables, rejectUnlessBridge, readJsonObject, asObject, errorResponse,
  parseTimestamp, shortString,
} from "@/lib/deviceServer";

const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);

// POST /api/attendance/heartbeat  (called by the device bridge every poll)
// Authorization: Bearer <ATTENDANCE_BRIDGE_KEY>
// Records device health and refreshes the list of users enrolled on it.
// Employee links (employee_id) set by HR are left untouched.
export async function POST(req: NextRequest) {
  const denied = rejectUnlessBridge(req);
  if (denied) return denied;

  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const serial = shortString(body.deviceSerial, 40);
  if (!serial) return NextResponse.json({ error: "deviceSerial required" }, { status: 400 });

  const now = new Date();
  const fields = {
    name: shortString(body.deviceName, 80),
    firmware: shortString(body.firmware, 80),
    ip: shortString(body.ip, 45),
    bridgeVersion: shortString(body.bridgeVersion, 20),
    deviceTime: parseTimestamp(body.deviceTime),
    clockDriftSeconds: int(body.clockDriftSeconds),
    counts: asObject(body.counts),
    invalidPunchCount: int(body.invalidPunchCount),
    lastSyncedAt: parseTimestamp(body.lastSyncedTimestamp),
    lastSeenAt: now,
  };

  const users: (typeof attendanceDeviceUsers.$inferInsert)[] = [];
  for (const item of Array.isArray(body.users) ? body.users : []) {
    const u = asObject(item);
    const deviceUserId = shortString(u?.deviceUserId, 24);
    if (!u || !deviceUserId) continue;
    const card = int(u.card);
    users.push({
      deviceSerial: serial,
      deviceUserId,
      name: shortString(u.name, 80),
      card: card !== null && card >= 0 ? card : null,
      privilege: shortString(u.privilege, 10),
      lastSeenAt: now,
    });
  }

  try {
    await ensureDeviceTables();
    await db.insert(attendanceDevices).values({ serial, ...fields })
      .onConflictDoUpdate({ target: attendanceDevices.serial, set: fields });
    if (users.length) {
      await db.insert(attendanceDeviceUsers).values(users)
        .onConflictDoUpdate({
          target: [attendanceDeviceUsers.deviceSerial, attendanceDeviceUsers.deviceUserId],
          set: {
            name: sql`excluded.name`,
            card: sql`excluded.card`,
            privilege: sql`excluded.privilege`,
            lastSeenAt: sql`excluded.last_seen_at`,
          },
        });
    }
    return NextResponse.json({ ok: true, users: users.length });
  } catch (e) {
    return errorResponse(e);
  }
}
