import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fleetTripOfficers, fleetTrips, vehicles } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema, kmBetween } from "@/lib/fleet";

// Correcting a row on the Log Book page — the readings copied down wrong, a
// destination left blank, a trip that was never closed. The gate terminal is
// where trips are made; this is where they're fixed.

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const id = Number((await params).id);
    const b = await req.json().catch(() => ({}));
    const [trip] = await db.select().from(fleetTrips).where(eq(fleetTrips.id, id));
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    const meterOut = b?.meterOut === undefined ? trip.meterOut : Math.round(Number(b.meterOut));
    const meterIn = b?.meterIn === "" || b?.meterIn === null
      ? null
      : b?.meterIn === undefined ? trip.meterIn : Math.round(Number(b.meterIn));

    if (!isFinite(meterOut) || meterOut < 0) {
      return NextResponse.json({ error: "Opening reading must be a number" }, { status: 400 });
    }
    if (meterIn !== null && (!isFinite(meterIn) || meterIn < meterOut)) {
      return NextResponse.json({ error: `Closing reading can't be below the opening ${meterOut} km` }, { status: 400 });
    }

    // Only "HH:MM" is editable; the day comes from the date field, so a trip
    // corrected onto another date keeps its times.
    const date = String(b?.date || trip.date);
    const timeSql = (hm: unknown, fallback: any) => {
      const v = typeof hm === "string" ? hm.trim() : "";
      if (!v) return fallback;
      if (!/^\d{1,2}:\d{2}$/.test(v)) return undefined;   // signalled as invalid below
      return sql`((${date}::date + ${v}::time) AT TIME ZONE 'Asia/Karachi')`;
    };
    const outAt = timeSql(b?.outTime, trip.outAt);
    const inAt = b?.inTime === "" ? null : timeSql(b?.inTime, trip.inAt);
    if (outAt === undefined || inAt === undefined) {
      return NextResponse.json({ error: "Times must be in HH:MM format" }, { status: 400 });
    }
    // A trip can't be open and have a closing reading, or closed without one.
    if ((inAt === null) !== (meterIn === null)) {
      return NextResponse.json({
        error: inAt === null
          ? "Clear the closing reading too, or give a return time."
          : "A returned trip needs its closing meter reading.",
      }, { status: 400 });
    }

    await db.update(fleetTrips).set({
      date,
      outAt: outAt as any,
      inAt: inAt as any,
      meterOut,
      meterIn,
      // Recomputed here, never left stale from before the correction.
      kmCovered: kmBetween(meterOut, meterIn),
      destination: b?.destination !== undefined ? String(b.destination).trim() : trip.destination,
      purpose: b?.purpose !== undefined ? String(b.purpose).trim() : trip.purpose,
      remarks: b?.remarks !== undefined ? String(b.remarks).trim() : trip.remarks,
    }).where(eq(fleetTrips.id, id));

    // Officers are replaced wholesale when supplied — simpler to reason about
    // than diffing, and the list is never more than a few names.
    if (Array.isArray(b?.officers)) {
      await db.delete(fleetTripOfficers).where(eq(fleetTripOfficers.tripId, id));
      const rows = (b.officers as any[])
        .map(o => ({ employeeId: o?.employeeId ? Number(o.employeeId) : null, name: String(o?.name || "").trim().slice(0, 160) }))
        .filter(o => o.name);
      if (rows.length) await db.insert(fleetTripOfficers).values(rows.map(o => ({ tripId: id, ...o })));
    }

    const [v] = await db.select({ vehicleNo: vehicles.vehicleNo }).from(vehicles).where(eq(vehicles.id, trip.vehicleId));
    await logActivity({
      user: guard, action: "station.trip.edit",
      summary: `edited a ${v?.vehicleNo ?? "vehicle"} log book entry dated ${date}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e?.message || "").includes("fleet_trips_open_")) {
      return NextResponse.json({ error: "That would leave two trips open for the same vehicle or driver" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const id = Number((await params).id);
    const [trip] = await db.select().from(fleetTrips).where(eq(fleetTrips.id, id));
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    const [v] = await db.select({ vehicleNo: vehicles.vehicleNo }).from(vehicles).where(eq(vehicles.id, trip.vehicleId));
    // Officers go with it — the cascade on trip_id.
    await db.delete(fleetTrips).where(eq(fleetTrips.id, id));
    await logActivity({
      user: guard, action: "station.trip.delete",
      summary: `deleted a ${v?.vehicleNo ?? "vehicle"} log book entry dated ${trip.date} (${trip.kmCovered ?? "—"} km)`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
