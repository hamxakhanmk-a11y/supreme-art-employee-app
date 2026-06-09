import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance, employees } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// GET /api/attendance?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  try {
    const allEmployees = await db.select().from(employees).orderBy(employees.firstName);
    const records = await db.select().from(attendance).where(eq(attendance.date, date));

    const map = new Map(records.map((r) => [r.employeeId, r.status]));

    const result = allEmployees.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      firstName: e.firstName,
      lastName: e.lastName,
      designation: e.designation,
      department: e.department,
      photoUrl: e.photoUrl,
      status: map.get(e.id) ?? null,
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/attendance  { employeeId, date, status }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, date, status } = body;

    if (!employeeId || !date || !status) {
      return NextResponse.json({ error: "employeeId, date, status required" }, { status: 400 });
    }

    // Upsert: update if exists, insert if not
    const existing = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, date)));

    if (existing.length > 0) {
      await db
        .update(attendance)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, date)));
    } else {
      await db.insert(attendance).values({ employeeId, date, status });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
