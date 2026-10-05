import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, stationLeaves } from "@/lib/schema";
import { and, eq, isNull } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { ensureStationReasonColumn } from "@/lib/stationServer";
import { openTripForDriver, type OpenTripInfo } from "@/lib/fleetServer";
import { karachiNow } from "@/lib/gateTime";

// POST /api/station/lookup  { pin }
// Identify the employee by PIN and return their current open leave (if any),
// plus a summary of today's trips. Used before showing the punch buttons.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStationReasonColumn();
    const { pin } = await req.json();
    const p = String(pin || "").trim();
    if (!p) return NextResponse.json({ error: "Enter your PIN" }, { status: 400 });

    const [emp] = await db.select({
      id: employees.id, employeeId: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
      designation: employees.designation, photoUrl: employees.photoUrl,
    }).from(employees).where(and(eq(employees.stationPin, p), eq(employees.status, "active")));
    if (!emp) return NextResponse.json({ error: "No employee found for that PIN" }, { status: 404 });

    const [open] = await db.select().from(stationLeaves)
      .where(and(eq(stationLeaves.employeeId, emp.id), isNull(stationLeaves.inAt)))
      .limit(1);

    const today = karachiNow().date;   // leaves are dated in Karachi; UTC is yesterday until 5am
    const todays = await db.select().from(stationLeaves)
      .where(and(eq(stationLeaves.employeeId, emp.id), eq(stationLeaves.date, today)))
      .orderBy(stationLeaves.outAt);

    // Is this person out in a vehicle right now? Fetched here so the terminal
    // knows which form to show without a second round trip at the gate.
    //
    // In its own try/catch, and deliberately not in a Promise.all with the
    // queries above: a fleet table missing or a slow query must not stop
    // someone punching out on foot, which is what this screen has always been
    // for. openTrip null simply means "no vehicle", and the terminal offers
    // taking one out as usual.
    let openTrip: OpenTripInfo | null = null;
    try {
      openTrip = await openTripForDriver(emp.id);
    } catch (e: any) {
      console.warn("Fleet lookup unavailable:", e?.message);
    }

    return NextResponse.json({ employee: emp, open: open ?? null, todays, openTrip });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
