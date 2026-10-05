import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, fleetTripOfficers, fleetTrips, vehicleDrivers, vehicles } from "@/lib/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema, kmBetween } from "@/lib/fleet";
import { meterCheckAt } from "@/lib/fleetServer";
import { gateWhen } from "@/lib/gateTime";

const MODULE = "station";

// Names travelling on a trip. Each is either an employee (id + name) or a
// plain name for someone off the payroll — the same shape the store's
// "Issued To" settled on.
type OfficerIn = { employeeId?: number | null; name?: string };

function cleanOfficers(raw: unknown): { employeeId: number | null; name: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { employeeId: number | null; name: string }[] = [];
  for (const o of raw as OfficerIn[]) {
    const name = String(o?.name || "").trim().slice(0, 160);
    if (!name) continue;
    if (out.some(x => x.name.toLowerCase() === name.toLowerCase())) continue;  // same person twice
    out.push({ employeeId: o?.employeeId ? Number(o.employeeId) : null, name });
  }
  return out;
}

// POST — take a vehicle out. { vehicleId, driverId, meterOut, destination,
// purpose, officers[], at? }
export async function POST(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const vehicleId = Number(b?.vehicleId);
    // The gate names a row from the vehicle's own driver list, which may or may
    // not be an employee; the employee link and the name both come from it.
    const driverRowId = b?.driverRowId ? Number(b.driverRowId) : null;
    const typedName = String(b?.driverName || "").trim().slice(0, 160);
    const meterOut = Math.round(Number(b?.meterOut));
    if (!vehicleId) return NextResponse.json({ error: "Pick a vehicle" }, { status: 400 });
    if (!driverRowId && !typedName) return NextResponse.json({ error: "Nobody is named on this trip" }, { status: 400 });
    if (!isFinite(meterOut) || meterOut < 0) {
      return NextResponse.json({ error: "Enter the meter reading" }, { status: 400 });
    }

    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!v) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    if (!v.active) return NextResponse.json({ error: `${v.vehicleNo} has been retired` }, { status: 400 });

    // Checked before writing so the driver gets a sentence rather than a
    // constraint violation — the unique indexes are the backstop, not the UI.
    const [vehicleOut] = await db.select({ id: fleetTrips.id }).from(fleetTrips)
      .where(and(eq(fleetTrips.vehicleId, vehicleId), isNull(fleetTrips.inAt))).limit(1);
    if (vehicleOut) {
      // The usual way to hit this when back-dating: today's trip is still open
      // and yesterday's is being written up. Say how to get past it.
      const backdating = typeof b?.date === "string" && b.date.trim() !== "";
      return NextResponse.json({
        error: backdating
          ? `${v.vehicleNo} is out right now. Bring it back first, then enter the earlier trip.`
          : `${v.vehicleNo} is already out`,
      }, { status: 409 });
    }

    // A name chosen off the list is checked against it here too: a terminal
    // left open while the list was edited could otherwise still book a trip
    // against someone taken off it. A typed name has no list to be on.
    let driverId: number | null = null;
    let listedName = "";
    if (driverRowId) {
      const [allowed] = await db.select({
        id: vehicleDrivers.id, employeeId: vehicleDrivers.employeeId, name: vehicleDrivers.name,
      }).from(vehicleDrivers)
        // Either in the pool, or named on this vehicle.
        .where(and(
          eq(vehicleDrivers.id, driverRowId),
          or(isNull(vehicleDrivers.vehicleId), eq(vehicleDrivers.vehicleId, vehicleId)),
        )).limit(1);
      if (!allowed) {
        return NextResponse.json({ error: `That driver isn't on ${v.vehicleNo}'s list` }, { status: 400 });
      }
      driverId = allowed.employeeId;
      listedName = allowed.name || "";
    }

    // Only employees can be "already out": a name with no employee behind it
    // isn't one person the system can follow across vehicles.
    if (driverId) {
      const [driverOut] = await db.select({ id: fleetTrips.id }).from(fleetTrips)
        .where(and(eq(fleetTrips.driverId, driverId), isNull(fleetTrips.inAt))).limit(1);
      if (driverOut) return NextResponse.json({ error: "That driver is already out in another vehicle" }, { status: 409 });
    }

    // Resolved now and stored on the trip, so the log book still reads after
    // the driver leaves — or when they were never an employee at all.
    let driverName = listedName.trim() || typedName;
    if (driverId) {
      const [drv] = await db.select({ first: employees.firstName, last: employees.lastName })
        .from(employees).where(eq(employees.id, driverId));
      if (drv) driverName = `${drv.first} ${drv.last}`.trim();
    }
    if (!driverName) return NextResponse.json({ error: "That driver has no name recorded" }, { status: 400 });

    // Now, or the date and time typed for a trip written up after the fact.
    const when = gateWhen(b);
    if (when.error) return NextResponse.json({ error: when.error }, { status: 400 });

    // Against the readings either side of that moment, so a trip entered the
    // next morning isn't refused for being lower than today's.
    const meterErr = await meterCheckAt(vehicleId, when.stamp, meterOut);
    if (meterErr) return NextResponse.json({ error: meterErr }, { status: 400 });

    const [trip] = await db.insert(fleetTrips).values({
      vehicleId,
      // The log book's date column: the day the vehicle left, in Karachi.
      date: when.date,
      outAt: when.stamp,
      driverId,
      driverName,
      destination: String(b?.destination || "").trim(),
      purpose: String(b?.purpose || "").trim(),
      meterOut,
      remarks: String(b?.remarks || "").trim(),
    }).returning();

    const officers = cleanOfficers(b?.officers);
    if (officers.length) {
      await db.insert(fleetTripOfficers).values(officers.map(o => ({ tripId: trip.id, ...o })));
    }

    await logActivity({
      user: guard, action: "station.vehicle.out", employeeId: driverId ?? undefined, employeeName: driverName,
      summary: `took ${v.vehicleNo} out at ${meterOut} km${trip.destination ? ` — ${trip.destination}` : ""}`,
    });
    return NextResponse.json({ action: "out", trip, officers: officers.map(o => o.name) });
  } catch (e: any) {
    // The partial unique indexes catching a double tap the checks above raced.
    if (String(e?.message || "").includes("fleet_trips_open_")) {
      return NextResponse.json({ error: "That trip has already been started" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — bring a vehicle back. { tripId, meterIn, remarks?, at? }
export async function PUT(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const tripId = Number(b?.tripId);
    const meterIn = Math.round(Number(b?.meterIn));
    if (!tripId) return NextResponse.json({ error: "Trip required" }, { status: 400 });
    if (!isFinite(meterIn) || meterIn < 0) {
      return NextResponse.json({ error: "Enter the meter reading" }, { status: 400 });
    }

    const [trip] = await db.select().from(fleetTrips).where(eq(fleetTrips.id, tripId));
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    if (trip.inAt) return NextResponse.json({ error: "This vehicle is already back" }, { status: 409 });
    if (meterIn < trip.meterOut) {
      return NextResponse.json({
        error: `It went out on ${trip.meterOut} km, so it can't come back on ${meterIn} km.`,
      }, { status: 400 });
    }

    const when = gateWhen(b);
    if (when.error) return NextResponse.json({ error: when.error }, { status: 400 });

    // A vehicle can't come back before it left — the easy slip when both ends
    // of a trip are being typed in the next day.
    const order = await db.execute(sql`SELECT (${when.stamp}) < ${trip.outAt.toISOString()}::timestamptz AS early`);
    const orderRows: any[] = (order as any).rows ?? (order as any);
    if (orderRows[0]?.early === true || orderRows[0]?.early === "t") {
      return NextResponse.json({ error: "That is before the vehicle went out — check the date and time." }, { status: 400 });
    }

    // Nothing recorded later may read lower than this.
    const meterErr = await meterCheckAt(trip.vehicleId, when.stamp, meterIn, trip.id);
    if (meterErr) return NextResponse.json({ error: meterErr }, { status: 400 });

    const [row] = await db.update(fleetTrips)
      .set({ inAt: when.stamp, meterIn, kmCovered: kmBetween(trip.meterOut, meterIn),
             remarks: b?.remarks !== undefined ? String(b.remarks).trim() : trip.remarks })
      .where(eq(fleetTrips.id, tripId)).returning();

    const [v] = await db.select({ vehicleNo: vehicles.vehicleNo }).from(vehicles).where(eq(vehicles.id, trip.vehicleId));
    await logActivity({
      user: guard, action: "station.vehicle.in", employeeId: trip.driverId ?? undefined,
      summary: `brought ${v?.vehicleNo ?? "a vehicle"} back at ${meterIn} km — ${row.kmCovered} km covered`,
    });
    return NextResponse.json({ action: "in", trip: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
