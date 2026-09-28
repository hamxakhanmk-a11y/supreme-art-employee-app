import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { guardAuth } from "@/lib/auth";
import { vehicleOptions } from "@/lib/fleetServer";

// GET /api/fleet/terminal — everything the gate terminal needs to offer a
// vehicle trip: which vehicles it can take out, and who can be named as
// travelling. One request, fetched once when the terminal loads, kept apart
// from the PIN lookup so a slow or missing fleet table never delays the PIN.
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const [vehicles, people] = await Promise.all([
      vehicleOptions(),
      db.select({
        id: employees.id,
        code: employees.employeeId,
        firstName: employees.firstName,
        lastName: employees.lastName,
        department: employees.department,
      }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    ]);
    return NextResponse.json({
      vehicles,
      people: people.map(p => ({
        id: p.id,
        code: p.code,
        name: `${p.firstName} ${p.lastName}`.trim(),
        department: p.department || "",
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
