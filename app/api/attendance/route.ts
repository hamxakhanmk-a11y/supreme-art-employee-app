import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendance } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, date, status, checkIn, checkOut } = body;

    // Check if record already exists for this employee on this date
    const existing = await db.select().from(attendance)
      .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, date)));

    if (existing.length > 0) {
      // Update existing record
      const updated = await db.update(attendance)
        .set({
          status,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
        })
        .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, date)))
        .returning();
      return NextResponse.json(updated[0]);
    } else {
      // Create new record
      const created = await db.insert(attendance).values({
        employeeId,
        date,
        status,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
      }).returning();
      return NextResponse.json(created[0]);
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to mark attendance" }, { status: 500 });
  }
}
