import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";

// PUT { vehicleId, month, fuelRate?, maintenance? } — the two figures the
// monthly fleet sheet takes by hand. Only the fields sent are changed; an
// empty value clears one.

function figure(v: unknown): number | null | "bad" {
  if (v === "" || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "bad";
}

export async function PUT(req: NextRequest) {
  const guard = await guardWrite("station.monthly");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const vehicleId = Number(b?.vehicleId);
    const month = String(b?.month || "");
    if (!vehicleId) return NextResponse.json({ error: "Pick a vehicle" }, { status: 400 });
    if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Pick a month" }, { status: 400 });

    const has = (k: string) => b && Object.prototype.hasOwnProperty.call(b, k);
    const rate = has("fuelRate") ? figure(b.fuelRate) : undefined;
    const maint = has("maintenance") ? figure(b.maintenance) : undefined;
    if (rate === "bad" || maint === "bad") {
      return NextResponse.json({ error: "Enter an amount in rupees" }, { status: 400 });
    }
    if (rate === undefined && maint === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }

    // Insert the row on first use; afterwards change only what was sent.
    await db.execute(sql`
      INSERT INTO fleet_month_notes (vehicle_id, month, fuel_rate, maintenance, updated_by)
      VALUES (${vehicleId}, ${month}, ${rate ?? null}, ${maint ?? null}, ${guard.name})
      ON CONFLICT (vehicle_id, month) DO UPDATE SET
        fuel_rate   = ${rate === undefined ? sql`fleet_month_notes.fuel_rate` : sql`EXCLUDED.fuel_rate`},
        maintenance = ${maint === undefined ? sql`fleet_month_notes.maintenance` : sql`EXCLUDED.maintenance`},
        updated_by  = EXCLUDED.updated_by,
        updated_at  = now()
    `);

    await logActivity({
      user: guard, action: "station.fleet.month",
      summary: `noted ${[
        rate !== undefined ? `fuel rate ${rate ?? "cleared"}` : "",
        maint !== undefined ? `maintenance ${maint ?? "cleared"}` : "",
      ].filter(Boolean).join(" and ")} for ${month} on the fleet sheet`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
