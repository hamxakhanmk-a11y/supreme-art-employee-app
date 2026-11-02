import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devicePunches } from "@/lib/schema";
import {
  ensureDeviceTables, rejectUnlessBridge, readJsonObject, asObject, errorResponse,
  parseTimestamp, shortString, smallInt, VERIFY_METHODS,
} from "@/lib/deviceServer";

const MAX_PUNCHES = 1000;

// POST /api/attendance/punches  (called by the device bridge, not a browser)
// Authorization: Bearer <ATTENDANCE_BRIDGE_KEY>
// { deviceSerial, punches: [{ deviceUserId, timestamp, verifyMethod, verifyCode, punchState }] }
// Re-sent punches are ignored, so the bridge can safely retry.
// -> { accepted, duplicates }
export async function POST(req: NextRequest) {
  const denied = rejectUnlessBridge(req);
  if (denied) return denied;

  const body = await readJsonObject(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const deviceSerial = shortString(body.deviceSerial, 40);
  if (!deviceSerial) return NextResponse.json({ error: "deviceSerial required" }, { status: 400 });
  if (!Array.isArray(body.punches)) return NextResponse.json({ error: "punches[] required" }, { status: 400 });
  if (body.punches.length > MAX_PUNCHES) {
    return NextResponse.json({ error: `At most ${MAX_PUNCHES} punches per request` }, { status: 413 });
  }

  // Reject the whole batch on any bad row, so a problem is loud in the bridge
  // log rather than punches quietly going missing.
  const rows: (typeof devicePunches.$inferInsert)[] = [];
  for (const [i, item] of body.punches.entries()) {
    const p = asObject(item);
    const deviceUserId = shortString(p?.deviceUserId, 24);
    const punchedAt = parseTimestamp(p?.timestamp);
    const verifyMethod = typeof p?.verifyMethod === "string" && VERIFY_METHODS.has(p.verifyMethod) ? p.verifyMethod : null;
    if (!p || !deviceUserId || !punchedAt || !verifyMethod) {
      return NextResponse.json({ error: `Invalid punch at index ${i}` }, { status: 400 });
    }
    rows.push({
      deviceSerial,
      deviceUserId,
      punchedAt,
      verifyMethod,
      verifyCode: smallInt(p.verifyCode),
      punchState: smallInt(p.punchState),
    });
  }
  if (!rows.length) return NextResponse.json({ accepted: 0, duplicates: 0 });

  try {
    await ensureDeviceTables();
    const inserted = await db.insert(devicePunches).values(rows)
      .onConflictDoNothing()
      .returning({ id: devicePunches.id });
    return NextResponse.json({ accepted: inserted.length, duplicates: rows.length - inserted.length });
  } catch (e) {
    return errorResponse(e);
  }
}
