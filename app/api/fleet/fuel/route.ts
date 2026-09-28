import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fuelEntries, vehicles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";
import { checkMeterForward } from "@/lib/fleetServer";

const MODULE = "station";

function money(n: unknown): number {
  const v = Number(n);
  return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}

// POST — record P.O.L. drawn. { vehicleId, date, litres, rate, meterReading?,
// drawnById?, vendor?, notes? }
export async function POST(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const vehicleId = Number(b?.vehicleId);
    const date = String(b?.date || "");
    const litres = money(b?.litres);
    const rate = money(b?.rate);
    if (!vehicleId) return NextResponse.json({ error: "Pick a vehicle" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });
    if (litres <= 0) return NextResponse.json({ error: "Litres must be more than zero" }, { status: 400 });

    const [v] = await db.select({ vehicleNo: vehicles.vehicleNo }).from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!v) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

    // A reading at the pump moves the odometer forward like any other, so it
    // gets the same check — a typo here would otherwise block the next trip.
    const meterReading = b?.meterReading === "" || b?.meterReading === null || b?.meterReading === undefined
      ? null : Math.round(Number(b.meterReading));
    if (meterReading !== null) {
      if (!isFinite(meterReading) || meterReading < 0) {
        return NextResponse.json({ error: "Meter reading must be a number" }, { status: 400 });
      }
      const err = await checkMeterForward(vehicleId, meterReading);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const [row] = await db.insert(fuelEntries).values({
      vehicleId, date, litres, rate,
      // Stored rather than multiplied at read time: a rate that changes later
      // must not quietly rewrite what was paid on the day.
      amount: Math.round(litres * rate * 100) / 100,
      meterReading,
      drawnById: b?.drawnById ? Number(b.drawnById) : null,
      vendor: String(b?.vendor || "").trim(),
      notes: String(b?.notes || "").trim(),
    }).returning();

    await logActivity({
      user: guard, action: "station.fuel.add",
      summary: `${v.vehicleNo}: ${litres} L drawn on ${date}${rate ? ` at ${rate}/L` : ""}`,
    });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — correct an entry. Same body plus { id }.
export async function PUT(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [before] = await db.select().from(fuelEntries).where(eq(fuelEntries.id, id));
    if (!before) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const litres = money(b?.litres);
    const rate = money(b?.rate);
    if (litres <= 0) return NextResponse.json({ error: "Litres must be more than zero" }, { status: 400 });

    const meterReading = b?.meterReading === "" || b?.meterReading === null || b?.meterReading === undefined
      ? null : Math.round(Number(b.meterReading));

    await db.update(fuelEntries).set({
      date: String(b?.date || before.date),
      litres, rate,
      amount: Math.round(litres * rate * 100) / 100,
      meterReading,
      drawnById: b?.drawnById ? Number(b.drawnById) : null,
      vendor: String(b?.vendor || "").trim(),
      notes: String(b?.notes || "").trim(),
    }).where(eq(fuelEntries.id, id));

    await logActivity({ user: guard, action: "station.fuel.edit", summary: `edited a fuel entry dated ${before.date}` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/fleet/fuel?id=4 — needs the same grant deleting a Station trip does.
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await ensureFleetSchema();
    const id = Number(idParam);
    const [row] = await db.select().from(fuelEntries).where(eq(fuelEntries.id, id));
    if (!row) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    await db.delete(fuelEntries).where(eq(fuelEntries.id, id));
    await logActivity({ user: guard, action: "station.fuel.delete", summary: `deleted a fuel entry of ${row.litres} L dated ${row.date}` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
