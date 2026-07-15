import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, stationLeaves } from "@/lib/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStationReasonColumn } from "@/lib/stationServer";

// POST /api/station/punch  { pin, type?, reason? }
// Toggle: if the employee has an open trip, punch them back IN (fills inAt +
// minutes). Otherwise punch them OUT with the given type (personal/official)
// and the free-text reason.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStationReasonColumn();
    const body = await req.json();
    const p = String(body.pin || "").trim();
    const type = body.type === "official" ? "official" : "personal";
    const reason = String(body.reason || "").trim().slice(0, 200) || null;
    if (!p) return NextResponse.json({ error: "Enter your PIN" }, { status: 400 });

    const [emp] = await db.select().from(employees)
      .where(and(eq(employees.stationPin, p), eq(employees.status, "active")));
    if (!emp) return NextResponse.json({ error: "No employee found for that PIN" }, { status: 404 });

    const [open] = await db.select().from(stationLeaves)
      .where(and(eq(stationLeaves.employeeId, emp.id), isNull(stationLeaves.inAt))).limit(1);

    const name = `${emp.firstName} ${emp.lastName}`;

    if (open) {
      // Compute duration in-DB so it's exact regardless of server/JS timezone.
      const [row] = await db.update(stationLeaves)
        .set({
          inAt: sql`now()`,
          minutes: sql`GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - ${stationLeaves.outAt})) / 60))::int`,
        })
        .where(eq(stationLeaves.id, open.id)).returning();
      await logActivity({
        user: guard, action: "station.in", employeeId: emp.id, employeeName: name,
        summary: `punched IN after ${row.minutes}m out (${open.type})`,
      });
      return NextResponse.json({ action: "in", employee: { id: emp.id, name }, leave: row });
    }

    const [row] = await db.insert(stationLeaves)
      .values({ employeeId: emp.id, date: sql`(now() AT TIME ZONE 'Asia/Karachi')::date`, outAt: sql`now()`, type, reason })
      .returning();
    await logActivity({
      user: guard, action: "station.out", employeeId: emp.id, employeeName: name,
      summary: `punched OUT (${type})${reason ? ` — ${reason}` : ""}`,
    });
    return NextResponse.json({ action: "out", employee: { id: emp.id, name }, leave: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
