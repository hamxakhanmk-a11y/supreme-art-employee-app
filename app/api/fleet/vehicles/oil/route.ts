import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardView, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";

// A vehicle's oil changes: one row each time "Oil changed" was pressed on All vehicles.

const rowsOf = (res: unknown): any[] => (res as any).rows ?? (res as any);

// GET ?vehicleId= — newest first.
export async function GET(req: NextRequest) {
  const guard = await guardView("station.vehicles");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const vehicleId = Number(req.nextUrl.searchParams.get("vehicleId"));
    if (!vehicleId) return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
    const res = await db.execute(sql`
      SELECT id, date::text AS date, meter_km AS "meterKm", COALESCE(created_by, '') AS "createdBy"
      FROM vehicle_oil_changes WHERE vehicle_id = ${vehicleId}
      ORDER BY date DESC, meter_km DESC, id DESC
    `);
    return NextResponse.json(rowsOf(res).map(r => ({ ...r, id: Number(r.id), meterKm: Number(r.meterKm) })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE ?id= — a wrong entry. The vehicle's last change goes back to the newest one left (Station · Delete).
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const found = rowsOf(await db.execute(sql`
      SELECT c.vehicle_id AS "vehicleId", c.meter_km AS "meterKm", v.vehicle_no AS "vehicleNo"
      FROM vehicle_oil_changes c JOIN vehicles v ON v.id = c.vehicle_id WHERE c.id = ${id}`))[0];
    if (!found) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    await db.execute(sql`DELETE FROM vehicle_oil_changes WHERE id = ${id}`);
    await db.execute(sql`
      UPDATE vehicles v SET
        oil_last_km = (SELECT meter_km FROM vehicle_oil_changes c WHERE c.vehicle_id = v.id ORDER BY date DESC, meter_km DESC, id DESC LIMIT 1),
        oil_last_date = (SELECT date FROM vehicle_oil_changes c WHERE c.vehicle_id = v.id ORDER BY date DESC, meter_km DESC, id DESC LIMIT 1)
      WHERE v.id = ${Number(found.vehicleId)}`);
    await logActivity({ user: guard, action: "station.vehicle.oil.delete", summary: `deleted an oil change at ${found.meterKm} km on "${found.vehicleNo}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
