import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { roleCanAccess } from "@/lib/permissions";
import { currentlyOut } from "@/lib/stationServer";

// GET /api/station/out — live list of everyone currently outside the factory.
// Read-only, so a view-only station role can watch the board too.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "superadmin" && !(await roleCanAccess(user.role, "station"))) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }
  try {
    const out = await currentlyOut();
    return NextResponse.json({ out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
