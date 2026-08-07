import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stationLeaves, employees } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStationReasonColumn } from "@/lib/stationServer";

// Look up a trip's employee (id + name) for the activity log.
async function tripEmp(tripId: number) {
  const [row] = await db.select({
    employeeId: stationLeaves.employeeId,
    firstName: employees.firstName, lastName: employees.lastName,
  }).from(stationLeaves)
    .innerJoin(employees, eq(employees.id, stationLeaves.employeeId))
    .where(eq(stationLeaves.id, tripId));
  return row ? { id: row.employeeId, name: `${row.firstName} ${row.lastName}` } : null;
}

// PATCH /api/station/trips/[id] — edit a trip's times (and type / reason).
// Times are wall-clock "HH:MM" on the given date, interpreted in Karachi time
// (matching how punches are stamped). Duration is recomputed in-DB.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStationReasonColumn();
    const { id } = await ctx.params;
    const tripId = parseInt(id);
    if (isNaN(tripId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const date = String(body.date || "").trim();
    const outTime = String(body.outTime || "").trim();
    const inTime = String(body.inTime || "").trim();
    const type = body.type === "official" ? "official" : "personal";
    const reason = String(body.reason || "").trim().slice(0, 200) || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 });
    if (!/^\d{1,2}:\d{2}$/.test(outTime)) return NextResponse.json({ error: "Check-out time must be HH:MM" }, { status: 400 });
    if (inTime && !/^\d{1,2}:\d{2}$/.test(inTime)) return NextResponse.json({ error: "Check-in time must be HH:MM" }, { status: 400 });

    const emp = await tripEmp(tripId);
    if (!emp) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    const outStamp = sql`((${date}::date + ${outTime}::time) AT TIME ZONE 'Asia/Karachi')`;
    const set: Record<string, unknown> = { date, outAt: outStamp, type, reason };
    if (inTime) {
      const inStamp = sql`((${date}::date + ${inTime}::time) AT TIME ZONE 'Asia/Karachi')`;
      set.inAt = inStamp;
      set.minutes = sql`GREATEST(0, ROUND(EXTRACT(EPOCH FROM (${inStamp} - ${outStamp})) / 60))::int`;
    } else {
      // Still out — no check-in, no duration yet.
      set.inAt = null;
      set.minutes = null;
    }

    const [row] = await db.update(stationLeaves).set(set).where(eq(stationLeaves.id, tripId)).returning();
    await logActivity({
      user: guard, action: "station.edit", employeeId: emp.id, employeeName: emp.name,
      summary: `edited hourly-leave trip (${type}${inTime ? `, ${row.minutes}m` : ", still out"})`,
    });
    return NextResponse.json({ ok: true, leave: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/station/trips/[id] — remove a trip. Gated by its own permission
// (station.delete), separate from the station edit right.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const tripId = parseInt(id);
    if (isNaN(tripId)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const emp = await tripEmp(tripId);
    await db.delete(stationLeaves).where(eq(stationLeaves.id, tripId));
    await logActivity({
      user: guard, action: "station.delete",
      employeeId: emp?.id, employeeName: emp?.name,
      summary: "deleted an hourly-leave trip",
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
