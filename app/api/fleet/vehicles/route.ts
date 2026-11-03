import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, fleetTrips, vehicleDrivers, vehicles } from "@/lib/schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { guardView, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema, VEHICLE_TYPES } from "@/lib/fleet";
import { karachiNow } from "@/lib/gateTime";

// Station · Vehicles grants this list (view / edit); deleting a vehicle needs
// Station · Delete. The gate reads vehicles through /api/fleet/terminal.

// Two to six digits, and whatever length it is is the length. PINs are usually
// the vehicle's own number because that is what people remember, and those run
// short — so the pad waits for ↵ rather than submitting at some fixed count.
//
// Blank means the vehicle simply can't be taken out at the gate yet, which is
// not an error worth refusing a save for.
export const PIN_MIN = 2;
export const PIN_MAX = 6;

function normalizePin(p: unknown): string | null {
  const s = String(p ?? "").trim();
  return s === "" ? null : s;
}

function pinError(pin: string | null): string | null {
  if (pin === null) return null;
  const ok = new RegExp(`^[0-9]{${PIN_MIN},${PIN_MAX}}$`);
  return ok.test(pin) ? null : `The vehicle PIN must be ${PIN_MIN}–${PIN_MAX} digits`;
}

// Who may drive this vehicle. Each entry is either an employee or a plain
// name for someone off the payroll — a hired driver, a contractor's man.
//
// Replaced wholesale on save: the list is a handful of names, and diffing
// would buy nothing but a chance to get it wrong.
type DriverIn = { employeeId?: number | null; name?: string };

async function setDrivers(vehicleId: number, raw: unknown) {
  const rows: { employeeId: number | null; name: string }[] = [];
  if (Array.isArray(raw)) {
    for (const d of raw as DriverIn[]) {
      const employeeId = d?.employeeId ? Number(d.employeeId) : null;
      const name = String(d?.name || "").trim().slice(0, 160);
      if (!employeeId && !name) continue;
      // Same person twice — by link for employees, by name for the rest.
      if (employeeId ? rows.some(r => r.employeeId === employeeId)
                     : rows.some(r => !r.employeeId && r.name.toLowerCase() === name.toLowerCase())) continue;
      rows.push({ employeeId, name });
    }
  }
  // Scoped to this vehicle: the pool rows (vehicle_id null) are not ours to clear.
  await db.delete(vehicleDrivers).where(eq(vehicleDrivers.vehicleId, vehicleId));
  if (rows.length) await db.insert(vehicleDrivers).values(rows.map(r => ({ vehicleId, ...r })));
  return rows;
}

// The vehicle's latest meter reading, from its trips and fuel records (null when it has none).
async function latestMeter(vehicleId: number): Promise<number | null> {
  const res = await db.execute(sql`
    SELECT NULLIF(GREATEST(
      COALESCE((SELECT MAX(GREATEST(t.meter_out, COALESCE(t.meter_in, 0))) FROM fleet_trips t WHERE t.vehicle_id = ${vehicleId}), 0),
      COALESCE((SELECT MAX(f.meter_reading) FROM fuel_entries f WHERE f.vehicle_id = ${vehicleId}), 0)
    ), 0) AS "meterNow"
  `);
  const r = (((res as any).rows ?? res) as any[])[0];
  return r?.meterNow === null || r?.meterNow === undefined ? null : Number(r.meterNow);
}

function normalizeType(t: unknown): string {
  const s = String(t || "car");
  return (VEHICLE_TYPES as readonly string[]).includes(s) ? s : "car";
}

// GET /api/fleet/vehicles[?active=1] — the registry, with each vehicle's
// current driver if it's out right now.
export async function GET(req: NextRequest) {
  const guard = await guardView("station.vehicles");
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
      ? await db.select({
          id: vehicleDrivers.id, vehicleId: vehicleDrivers.vehicleId,
          employeeId: vehicleDrivers.employeeId, name: vehicleDrivers.name,
        }).from(vehicleDrivers).where(inArray(vehicleDrivers.vehicleId, ids))
      : [];
    type DriverRow = { id: number; employeeId: number | null; name: string };
    const driversBy = new Map<number, DriverRow[]>();
    for (const l of links) {
      // vehicleId is nullable now — a null row belongs to the pool, not to any
      // vehicle, and the inArray above can't return one anyway.
      if (l.vehicleId === null) continue;
      const arr = driversBy.get(l.vehicleId) ?? [];
      arr.push({ id: l.id, employeeId: l.employeeId, name: l.name || "" });
      driversBy.set(l.vehicleId, arr);
    }

    // The oil change: how often, the meter reading at the last change, and the vehicle's latest meter
    // reading from its trips and fuel records — due once the meter is interval km past the last change.
    const oilRes = await db.execute(sql`
      SELECT v.id, v.oil_interval_km AS "oilIntervalKm", v.oil_last_km AS "oilLastKm", v.oil_last_date::text AS "oilLastDate",
             NULLIF(GREATEST(
               COALESCE((SELECT MAX(GREATEST(t.meter_out, COALESCE(t.meter_in, 0))) FROM fleet_trips t WHERE t.vehicle_id = v.id), 0),
               COALESCE((SELECT MAX(f.meter_reading) FROM fuel_entries f WHERE f.vehicle_id = v.id), 0)
             ), 0) AS "meterNow"
      FROM vehicles v
    `);
    const oilBy = new Map((((oilRes as any).rows ?? oilRes) as any[]).map(r => [Number(r.id), {
      oilIntervalKm: r.oilIntervalKm === null ? null : Number(r.oilIntervalKm),
      oilLastKm: r.oilLastKm === null ? null : Number(r.oilLastKm),
      oilLastDate: r.oilLastDate === null ? null : String(r.oilLastDate),
      meterNow: r.meterNow === null ? null : Number(r.meterNow),
    }]));

    return NextResponse.json(rows.map(v => {
      const o = openBy.get(v.id);
      return {
        ...v,
        oilIntervalKm: oilBy.get(v.id)?.oilIntervalKm ?? null,
        oilLastKm: oilBy.get(v.id)?.oilLastKm ?? null,
        oilLastDate: oilBy.get(v.id)?.oilLastDate ?? null,
        meterNow: oilBy.get(v.id)?.meterNow ?? null,
        drivers: driversBy.get(v.id) ?? [],
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
  const guard = await guardWrite("station.vehicles");
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
    const drivers = await setDrivers(row.id, b?.drivers);
    await logActivity({ user: guard, action: "station.vehicle.add", summary: `added vehicle "${vehicleNo}"` });
    return NextResponse.json({ ...row, drivers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardWrite("station.vehicles");
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

    if (Array.isArray(b?.drivers)) await setDrivers(id, b.drivers);

    // Oil change. Only when it was sent: a save that does not mention it leaves it as it was.
    //   oilIntervalKm — every how many km (blank clears it)
    //   oilLastKm     — the meter reading at the last change, to correct it by hand
    //   oilDone: true — the oil was just changed: the last change becomes the meter's latest reading
    // Setting an interval on a vehicle with no last change counts from the meter now.
    if (b && ("oilIntervalKm" in b || "oilLastKm" in b || b.oilDone)) {
      const num = (v: unknown): number | null | "bad" => {
        if (v === "" || v === null || v === undefined) return null;
        const n = Math.round(Number(v));
        return Number.isFinite(n) && n >= 0 ? n : "bad";
      };
      const curRes = await db.execute(sql`SELECT oil_interval_km AS i, oil_last_km AS l, oil_last_date::text AS d FROM vehicles WHERE id = ${id}`);
      const cur = (((curRes as any).rows ?? curRes) as any[])[0] ?? {};
      let interval = "oilIntervalKm" in b ? num(b.oilIntervalKm) : (cur.i === null || cur.i === undefined ? null : Number(cur.i));
      let last = "oilLastKm" in b ? num(b.oilLastKm) : (cur.l === null || cur.l === undefined ? null : Number(cur.l));
      let lastDate: string | null = cur.d ?? null;
      if (interval === "bad" || last === "bad" || interval === 0) {
        return NextResponse.json({ error: "Type the oil change distance as a number of km, like 5000" }, { status: 400 });
      }
      const meter = await latestMeter(id);
      if (b.oilDone) {
        if (meter === null) return NextResponse.json({ error: "This vehicle has no meter reading yet — the oil change is counted from it" }, { status: 400 });
        last = meter; lastDate = karachiNow().date;
      } else if ("oilLastKm" in b && last !== (cur.l === null || cur.l === undefined ? null : Number(cur.l))) {
        lastDate = null;   // typed by hand: the day is not known
      }
      if (interval !== null && last === null && meter !== null) { last = meter; lastDate = karachiNow().date; }
      await db.execute(sql`UPDATE vehicles SET oil_interval_km = ${interval}, oil_last_km = ${last}, oil_last_date = ${lastDate} WHERE id = ${id}`);
      if (b.oilDone) await logActivity({ user: guard, action: "station.vehicle.oil", summary: `oil changed on "${vehicleNo}" at ${meter} km` });
    }

    const what = before.active !== active ? (active ? "put back in service" : "retired") : "edited";
    await logActivity({ user: guard, action: "station.vehicle.edit", summary: `${what} vehicle "${vehicleNo}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE ?id=N[&confirm=<vehicle no>] — Station · Delete.
//
// Deleting a vehicle takes its log book with it (trips, monthly notes and its
// drivers go by cascade); its PSO cards and fuel records stay, with no vehicle.
// Retiring (PUT active:false) is the way to put a real vehicle out of service
// and keep its history; this is for a mistake or a test entry. So a vehicle
// with any history is only deleted when its number is typed back: the first
// call answers 409 with what would go, the second carries the number.
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [v] = await db.select({ vehicleNo: vehicles.vehicleNo }).from(vehicles).where(eq(vehicles.id, id));
    if (!v) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

    const res = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM fleet_trips WHERE vehicle_id = ${id})::int AS trips,
        (SELECT COUNT(*) FROM pso_cards WHERE vehicle_id = ${id})::int AS cards,
        (SELECT COUNT(*) FROM pso_card_issues WHERE vehicle_id = ${id})::int AS fills
    `);
    const usage = ((res as any).rows ?? (res as any))[0] as { trips: number; cards: number; fills: number };
    const hasHistory = usage.trips > 0 || usage.cards > 0 || usage.fills > 0;
    const typed = String(req.nextUrl.searchParams.get("confirm") || "").trim().toLowerCase();
    if (hasHistory && typed !== v.vehicleNo.trim().toLowerCase()) {
      return NextResponse.json({ needsConfirm: v.vehicleNo, ...usage }, { status: 409 });
    }

    await db.delete(vehicles).where(eq(vehicles.id, id));
    await logActivity({
      user: guard, action: "station.vehicle.delete",
      summary: `deleted vehicle "${v.vehicleNo}"`
        + (usage.trips ? ` and its ${usage.trips} log-book trip${usage.trips === 1 ? "" : "s"}` : ""),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
