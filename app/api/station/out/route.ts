import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { roleCanAccess } from "@/lib/permissions";
import { currentlyOut, outOn } from "@/lib/stationServer";
import { tripsOn, vehiclesOut } from "@/lib/fleetServer";

// GET /api/station/out — live list of everyone currently outside the factory.
// Read-only, so a view-only station role can watch the board too.
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "superadmin" && !(await roleCanAccess(user.role, "station"))) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const asked = req.nextUrl.searchParams.get("date") || "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;
    const isToday = date === today;

    const out = isToday ? await currentlyOut() : await outOn(date);
    // Separately, and forgiving: the people half of this board is the part
    // the gate depends on, and must not go dark because a fleet query failed.
    let vehicles: any[] = [];
    try { vehicles = isToday ? await vehiclesOut() : await tripsOn(date); }
    catch (e: any) { console.warn("Vehicles unavailable:", e?.message); }
    return NextResponse.json({ out, vehicles, date, isToday });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
