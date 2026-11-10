import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Server-only helpers for the biometric device feed. The bridge program on the
// factory LAN pulls punches off the ZKTeco device and POSTs them here with a
// shared secret (ATTENDANCE_BRIDGE_KEY), not a user session.

// Idempotently create the device tables. Called before any read/write that
// touches them, so production self-migrates on deploy without a manual step.
let tablesEnsured = false;
export async function ensureDeviceTables() {
  if (tablesEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS attendance_devices (
      serial varchar(40) PRIMARY KEY,
      name varchar(80),
      firmware varchar(80),
      ip varchar(45),
      bridge_version varchar(20),
      device_time timestamptz,
      clock_drift_seconds integer,
      counts jsonb,
      invalid_punch_count integer,
      last_synced_at timestamptz,
      last_seen_at timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`ALTER TABLE attendance_devices ADD COLUMN IF NOT EXISTS poll_interval_seconds integer`);
  await db.execute(sql`ALTER TABLE attendance_devices ADD COLUMN IF NOT EXISTS device_read_at timestamptz`);
  await db.execute(sql`ALTER TABLE attendance_devices ADD COLUMN IF NOT EXISTS device_error text`);
  await db.execute(sql`ALTER TABLE attendance_devices ADD COLUMN IF NOT EXISTS device_error_since timestamptz`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS attendance_device_users (
      device_serial varchar(40) NOT NULL,
      device_user_id varchar(24) NOT NULL,
      name varchar(80),
      card bigint,
      privilege varchar(10),
      employee_id integer REFERENCES employees(id) ON DELETE SET NULL,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (device_serial, device_user_id)
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS device_punches (
      id bigserial PRIMARY KEY,
      device_serial varchar(40) NOT NULL,
      device_user_id varchar(24) NOT NULL,
      punched_at timestamptz NOT NULL,
      verify_method varchar(16),
      verify_code integer,
      punch_state integer,
      received_at timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS device_punches_uq ON device_punches (device_serial, device_user_id, punched_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS device_punches_punched_at_idx ON device_punches (punched_at)`);
  // An employee can be linked to at most one user per device.
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS attendance_device_users_employee_uq ON attendance_device_users (device_serial, employee_id) WHERE employee_id IS NOT NULL`);
  tablesEnsured = true;
}

// Returns a response to send back when the request isn't from the bridge, or
// null when it is. Compares hashes so the check takes the same time either way.
export function rejectUnlessBridge(req: NextRequest): NextResponse | null {
  const expected = process.env.ATTENDANCE_BRIDGE_KEY;
  if (!expected) {
    return NextResponse.json({ error: "ATTENDANCE_BRIDGE_KEY is not configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!given || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

// Device timestamps arrive as local time with an explicit offset,
// e.g. "2026-10-31T08:05:27+05:00".
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseTimestamp(v: unknown): Date | null {
  if (typeof v !== "string" || !ISO_WITH_OFFSET.test(v)) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function shortString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
}

export function smallInt(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 0xffff ? (v as number) : null;
}

export const VERIFY_METHODS = new Set(["fingerprint", "face", "card", "password", "other"]);

export type JsonObject = Record<string, unknown>;

export function asObject(v: unknown): JsonObject | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : null;
}

export async function readJsonObject(req: NextRequest): Promise<JsonObject | null> {
  try {
    return asObject(await req.json());
  } catch {
    return null;
  }
}

export function errorResponse(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}
