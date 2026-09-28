import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, fleetTrips, vehicleDrivers, vehicles } from "@/lib/schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema, VEHICLE_TYPES } from "@/lib/fleet";

// Fleet rides on the Station permission — it lives in the Station tab and is
// used by the same people at the same gate, so it gets no grant of its own.
const MODULE = "station";

// 3 digits, same keypad as an employee PIN. Blank means the vehicle simply
// can't be taken out at the gate yet — not an error worth refusing a save for.
function normalizePin(p: unknown): string | null {
  const s = String(p ?? "").trim();
  return s === "" ? null : s;
}

function pinError(pin: string | null): string | null {
  if (pin === null) return null;
  return /^\d{3}$/.test(pin) ? null : "The vehicle PIN must be 3 digits";
}

// Replaced wholesale on save: the list is a handful of names, and diffing
// would buy nothing but a chance to get it wrong.
async function setDrivers(vehicleId: number, ids: unknown) {
  const wanted = Array.isArray(ids)
    ? Array.from(new Set(ids.map((x: any) => Number(x)).filter(Boolean)))
    : [];
  await db.delete(vehicleDrivers).where(eq(vehicleDrivers.vehicleId, vehicleId));
  if (wanted.length) {
    await db.insert(vehicleDrivers).values(wanted.map(employeeId => ({ vehicleId, employeeId })));
  }
  return wanted;
}

function normalizeType(t: unknown): string {
  const s = String(t || "car");
  return (VEHICLE_TYPES as readonly string[]).includes(s) ? s : "car";
}

// GET /api/fleet/vehicles[?active=1] — the registry, with each vehicle's
// current driver if it's out right now.
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const activeOnly = req.nextUrl.searchParams.get("active") === "1";
    const rows = await db.select({
      id: vehicles.id,
      vehicleNo: vehicles.vehicleNo,
      pin: vehicles.pin,
      name: vehicles.name,
      type: vehicles.type,
      defaultDriverId: vehicles.defaultDriverId,
      active: vehicles.active,
      notes: vehicles.notes,
    }).from(vehicles)
      .where(activeOnly ? eq(vehicles.active, true) : undefined)
      .orderBy(asc(vehicles.vehicleNo));

    // Which are out, and on whose watch. One query rather than per-vehicle.
    const open = await db.select({
      vehicleId: fleetTrips.vehicleId,
      tripId: fleetTrips.id,
      outAt: fleetTrips.outAt,
      destination: fleetTrips.destination,
      meterOut: fleetTrips.meterOut,
      driverFirst: employees.firstName,
      driverLast: employees.lastName,
    }).from(fleetTrips)
      .leftJoin(employees, eq(employees.id, fleetTrips.driverId))
      .where(isNull(fleetTrips.inAt));
    const openBy = new Map(open.map(o => [o.vehicleId, o]));

    // Every vehicle's drivers in one query, not one query per vehicle.
    const ids = rows.map(r => r.id);
    const links = ids.length
      ? await db.select({ vehicleId: vehicleDrivers.vehicleId, employeeId: vehicleDrivers.employeeId })
          .from(vehicleDrivers).where(inArray(vehicleDrivers.vehicleId, ids))
      : [];
    const driversBy = new Map<number, number[]>();
    for (const l of links) {
      const arr = driversBy.get(l.vehicleId) ?? [];
      arr.push(l.employeeId);
      driversBy.set(l.vehicleId, arr);
    }

    return NextResponse.json(rows.map(v => {
      const o = openBy.get(v.id);
      return {
        ...v,
        driverIds: driversBy.get(v.id) ?? [],
        openTrip: o ? {
          id: o.tripId, outAt: o.outAt, destination: o.destination, meterOut: o.meterOut,
          driver: `${o.driverFirst ?? ""} ${o.driverLast ?? ""}`.trim() || "—",
        } : null,
      };
    }));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const vehicleNo = String(b?.vehicleNo || "").trim();
    if (!vehicleNo) return NextResponse.json({ error: "Vehicle number is required" }, { status: 400 });
    const pin = normalizePin(b?.pin);
    const pinErr = pinError(pin);
    if (pinErr) return NextResponse.json({ error: pinErr }, { status: 400 });

    const dup = await db.execute(sql`
      SELECT id, vehicle_no AS "vehicleNo" FROM vehicles WHERE LOWER(vehicle_no) = LOWER(${vehicleNo}) LIMIT 1
    `);
    const dups: any[] = (dup as any).rows ?? (dup as any);
    if (dups.length) {
      return NextResponse.json({ error: `Vehicle "${dups[0].vehicleNo}" is already on the list` }, { status: 409 });
    }
    if (pin) {
      const taken = await db.select({ vehicleNo: vehicles.vehicleNo }).from(vehicles).where(eq(vehicles.pin, pin)).limit(1);
      if (taken.length) return NextResponse.json({ error: `PIN ${pin} already belongs to ${taken[0].vehicleNo}` }, { status: 409 });
    }

    const [row] = await db.insert(vehicles).values({
      vehicleNo,
      pin,
      name: String(b?.name || "").trim(),
      type: normalizeType(b?.type),
      defaultDriverId: b?.defaultDriverId ? Number(b.defaultDriverId) : null,
      notes: String(b?.notes || "").trim(),
    }).returning();
    const driverIds = await setDrivers(row.id, b?.driverIds);
    await logActivity({ user: guard, action: "station.vehicle.add", summary: `added vehicle "${vehicleNo}"` });
    return NextResponse.json({ ...row, driverIds });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const vehicleNo = String(b?.vehicleNo || "").trim();
    if (!vehicleNo) return NextResponse.json({ error: "Vehicle number is required" }, { status: 400 });

    const pin = normalizePin(b?.pin);
    const pinErr = pinError(pin);
    if (pinErr) return NextResponse.json({ error: pinErr }, { status: 400 });

    const [before] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    if (!before) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

    const dup = await db.execute(sql`
      SELECT id FROM vehicles WHERE LOWER(vehicle_no) = LOWER(${vehicleNo}) AND id <> ${id} LIMIT 1
    `);
    const dups: any[] = (dup as any).rows ?? (dup as any);
    if (dups.length) return NextResponse.json({ error: `Another vehicle is already "${vehicleNo}"` }, { status: 409 });
    if (pin) {
      const taken = await db.select({ id: vehicles.id, vehicleNo: vehicles.vehicleNo })
        .from(vehicles).where(eq(vehicles.pin, pin)).limit(1);
      if (taken.length && taken[0].id !== id) {
        return NextResponse.json({ error: `PIN ${pin} already belongs to ${taken[0].vehicleNo}` }, { status: 409 });
      }
    }

    const active = b?.active !== false;
    // A vehicle that's out can't be retired — the trip would have nowhere to
    // come back to, and it would vanish from the terminal mid-journey.
    if (before.active && !active) {
      const [stillOut] = await db.select({ id: fleetTrips.id }).from(fleetTrips)
        .where(and(eq(fleetTrips.vehicleId, id), isNull(fleetTrips.inAt))).limit(1);
      if (stillOut) {
        return NextResponse.json({ error: "This vehicle is out right now — bring it back before retiring it." }, { status: 400 });
      }
    }

    await db.update(vehicles).set({
      vehicleNo,
      pin,
      name: String(b?.name || "").trim(),
      type: normalizeType(b?.type),
      defaultDriverId: b?.defaultDriverId ? Number(b.defaultDriverId) : null,
      active,
      notes: String(b?.notes || "").trim(),
    }).where(eq(vehicles.id, id));

    if (Array.isArray(b?.driverIds)) await setDrivers(id, b.driverIds);

    const what = before.active !== active ? (active ? "put back in service" : "retired") : "edited";
    await logActivity({ user: guard, action: "station.vehicle.edit", summary: `${what} vehicle "${vehicleNo}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE is deliberately absent. A vehicle with journeys behind it can't be
// removed without taking the log book with it — retire it instead (PUT with
// active:false), which stops it being offered and keeps its history readable.
