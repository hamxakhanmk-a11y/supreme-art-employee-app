import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance, attendanceDays, employees } from "@/lib/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";

// GET /api/attendance?date=YYYY-MM-DD         -> rows for a day with employee join (for marking form)
// GET /api/attendance?from=&to=&employeeId=   -> filtered range (for history)
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const date = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const employeeId = url.searchParams.get("employeeId");

  try {
    // Single-day mode: return all active employees joined with their attendance record (if any)
    if (date && !from && !to) {
      const allEmployees = await db.select().from(employees)
        .where(eq(employees.status, "active"))
        .orderBy(employees.firstName);
      const records = await db.select().from(attendance).where(eq(attendance.date, date));
      const byEmp = new Map(records.map((r) => [r.employeeId, r]));
      const [closed] = await db.select().from(attendanceDays).where(eq(attendanceDays.date, date));

      const result = allEmployees.map((e) => {
        const r = byEmp.get(e.id);
        return {
          id: e.id,
          employeeId: e.employeeId,
          firstName: e.firstName,
          lastName: e.lastName,
          designation: e.designation,
          department: e.department,
          photoUrl: e.photoUrl,
          status: r?.status ?? null,
          checkIn: r?.checkIn ?? null,
          checkOut: r?.checkOut ?? null,
          officialLeaveMin: r?.officialLeaveMin ?? 0,
          personalLeaveMin: r?.personalLeaveMin ?? 0,
          notes: r?.notes ?? null,
        };
      });
      return NextResponse.json({ rows: result, closed: !!closed, closedAt: closed?.closedAt ?? null });
    }

    // Range mode for history
    const conds: any[] = [];
    if (from) conds.push(gte(attendance.date, from));
    if (to) conds.push(lte(attendance.date, to));
    if (employeeId) conds.push(eq(attendance.employeeId, parseInt(employeeId)));
    const rows = await db.select().from(attendance).where(conds.length ? and(...conds) : undefined);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/attendance  { employeeId, date, status, checkIn?, checkOut?, officialLeaveMin?, personalLeaveMin?, notes? }
export async function POST(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await req.json();
    const { employeeId, date, status, checkIn, checkOut, notes } = body;
    const officialLeaveMin = Math.max(0, parseInt(body.officialLeaveMin) || 0);
    const personalLeaveMin = Math.max(0, parseInt(body.personalLeaveMin) || 0);
    if (!employeeId || !date || !status) {
      return NextResponse.json({ error: "employeeId, date, status required" }, { status: 400 });
    }

    // Half-day requests can come in after a day has already been closed
    // (employee files the form late). Allow status="half-day" through;
    // everything else still requires the day to be open.
    if (status !== "half-day") {
      const [closed] = await db.select().from(attendanceDays).where(eq(attendanceDays.date, date));
      if (closed) return NextResponse.json({ error: "Day is closed and cannot be modified" }, { status: 423 });
    }

    const existing = await db.select().from(attendance)
      .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, date)));

    if (existing.length > 0) {
      await db.update(attendance)
        .set({ status, checkIn: checkIn || null, checkOut: checkOut || null, officialLeaveMin, personalLeaveMin, notes: notes || null, updatedAt: new Date() })
        .where(eq(attendance.id, existing[0].id));
    } else {
      await db.insert(attendance).values({ employeeId, date, status, checkIn: checkIn || null, checkOut: checkOut || null, officialLeaveMin, personalLeaveMin, notes: notes || null });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/attendance?employeeId=&date=   -> unmark (clear) one employee's record for a day
// DELETE /api/attendance?date=                -> unmark (clear) every employee's record for a day
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const url = req.nextUrl;
    const employeeId = url.searchParams.get("employeeId");
    const date = url.searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "date required" }, { status: 400 });
    }

    const [closed] = await db.select().from(attendanceDays).where(eq(attendanceDays.date, date));
    if (closed) return NextResponse.json({ error: "Day is closed and cannot be modified" }, { status: 423 });

    await db.delete(attendance)
      .where(employeeId
        ? and(eq(attendance.employeeId, parseInt(employeeId)), eq(attendance.date, date))
        : eq(attendance.date, date));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
