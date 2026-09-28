import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, vehicleDrivers } from "@/lib/schema";
import { asc, eq, isNull } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";

// The drivers pool: people who may drive anything. Most yards work this way —
// whoever is free takes whatever is free — so the list is set once here
// instead of being copied onto every vehicle. A vehicle can still name extra
// drivers of its own; the gate offers both.
//
// Held in vehicle_drivers with a null vehicle_id, so one query answers "who may
// drive this?" for both kinds.

// GET /api/fleet/drivers → [{ employeeId, name }]
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const rows = await db.select({
      id: vehicleDrivers.id,
      employeeId: vehicleDrivers.employeeId,
      manualName: vehicleDrivers.name,
      firstName: employees.firstName,
      lastName: employees.lastName,
      code: employees.employeeId,
    }).from(vehicleDrivers)
      .leftJoin(employees, eq(employees.id, vehicleDrivers.employeeId))
      .where(isNull(vehicleDrivers.vehicleId))
      .orderBy(asc(vehicleDrivers.id));

    return NextResponse.json(rows.map(r => ({
      id: r.id,
      employeeId: r.employeeId,
      code: r.code || "",
      name: r.employeeId ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() : (r.manualName || ""),
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT { drivers: [{ employeeId?, name? }] } — replaces the pool wholesale, the
// same way a vehicle's own list is saved. It is a handful of names; diffing
// would buy nothing but a chance to get it wrong.
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const raw = Array.isArray(b?.drivers) ? b.drivers : [];

    const rows: { employeeId: number | null; name: string }[] = [];
    for (const d of raw as { employeeId?: number | null; name?: string }[]) {
      const employeeId = d?.employeeId ? Number(d.employeeId) : null;
      const name = String(d?.name || "").trim().slice(0, 160);
      if (!employeeId && !name) continue;
      if (employeeId ? rows.some(r => r.employeeId === employeeId)
                     : rows.some(r => !r.employeeId && r.name.toLowerCase() === name.toLowerCase())) continue;
      rows.push({ employeeId, name });
    }

    await db.delete(vehicleDrivers).where(isNull(vehicleDrivers.vehicleId));
    if (rows.length) {
      await db.insert(vehicleDrivers).values(rows.map(r => ({ vehicleId: null, ...r })));
    }

    await logActivity({
      user: guard, action: "station.drivers.edit",
      summary: `set the drivers pool — ${rows.length} ${rows.length === 1 ? "driver" : "drivers"}`,
    });
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
