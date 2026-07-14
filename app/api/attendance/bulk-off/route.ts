import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance, attendanceDays, employees } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// POST /api/attendance/bulk-off
// Body: { dates: string[], status?: "holiday" | "week-off" }
// Stamps every active employee with the given status for each date.
// Skips dates that are already closed. Upserts (replaces) existing rows
// for the same (employee_id, date).
export async function POST(req: NextRequest) {
  const guard = await guardWrite("attendance");
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await req.json();
    const dates: string[] = Array.isArray(body.dates) ? body.dates : [];
    const status: "holiday" | "week-off" = body.status === "week-off" ? "week-off" : "holiday";
    if (dates.length === 0) {
      return NextResponse.json({ error: "Provide at least one date" }, { status: 400 });
    }

    // Drop any dates that are already closed
    const closed = await db.select({ d: attendanceDays.date }).from(attendanceDays)
      .where(inArray(attendanceDays.date, dates));
    const closedSet = new Set(closed.map(c => c.d));
    const allowed = dates.filter(d => !closedSet.has(d));
    if (allowed.length === 0) {
      return NextResponse.json({ error: "All selected dates are closed" }, { status: 423 });
    }

    const emps = await db.select({ id: employees.id })
      .from(employees).where(eq(employees.status, "active"));

    let upserts = 0;
    for (const d of allowed) {
      // Find existing rows for this date
      const existing = await db.select({ id: attendance.id, employeeId: attendance.employeeId })
        .from(attendance).where(eq(attendance.date, d));
      const existingByEmp = new Map(existing.map(e => [e.employeeId, e.id]));

      const toInsert: { employeeId: number; date: string; status: string; notes: string }[] = [];
      for (const e of emps) {
        if (existingByEmp.has(e.id)) {
          await db.update(attendance)
            .set({ status, notes: `Bulk OFF (${status})`, updatedAt: new Date() })
            .where(eq(attendance.id, existingByEmp.get(e.id)!));
        } else {
          toInsert.push({ employeeId: e.id, date: d, status, notes: `Bulk OFF (${status})` });
        }
      }
      if (toInsert.length) await db.insert(attendance).values(toInsert);
      upserts += emps.length;
    }

    await logActivity({ user: guard, action: "attendance.bulk-off", summary: `marked OFF (${status}) for all ${emps.length} active employees on ${allowed.join(", ")}` });
    return NextResponse.json({ ok: true, datesApplied: allowed, datesSkipped: dates.filter(d => closedSet.has(d)), totalUpserts: upserts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
