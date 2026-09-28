import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, vehicleDrivers, vehicles } from "@/lib/schema";
import { and, asc, eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { ensureFleetSchema, lastMeterReading } from "@/lib/fleet";
import { openTripForVehicle } from "@/lib/fleetServer";

// POST /api/fleet/lookup { pin }
// The vehicle half of the gate terminal: a vehicle identifies itself, and the
// answer carries everything needed to show the right form — who may drive it,
// whether it's already out, and the reading it was last seen on.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const { pin } = await req.json().catch(() => ({ pin: "" }));
    const p = String(pin || "").trim();
    if (!p) return NextResponse.json({ error: "Enter the vehicle PIN" }, { status: 400 });

    const [v] = await db.select({
      id: vehicles.id, vehicleNo: vehicles.vehicleNo, name: vehicles.name,
      type: vehicles.type, active: vehicles.active, defaultDriverId: vehicles.defaultDriverId,
    }).from(vehicles).where(eq(vehicles.pin, p));
    if (!v) return NextResponse.json({ error: "No vehicle found for that PIN" }, { status: 404 });
    if (!v.active) return NextResponse.json({ error: `${v.vehicleNo} has been retired` }, { status: 400 });

    // Only the people set on this vehicle, and only those still employed.
    const drivers = await db.select({
      id: employees.id, code: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
    }).from(vehicleDrivers)
      .innerJoin(employees, eq(employees.id, vehicleDrivers.employeeId))
      .where(and(eq(vehicleDrivers.vehicleId, v.id), eq(employees.status, "active")))
      .orderBy(asc(employees.firstName));

    const [openTrip, last] = await Promise.all([
      openTripForVehicle(v.id),
      lastMeterReading(v.id),
    ]);

    return NextResponse.json({
      vehicle: v,
      drivers: drivers.map(d => ({ id: d.id, code: d.code, name: `${d.firstName} ${d.lastName}`.trim() })),
      openTrip,
      lastMeter: last?.km ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
