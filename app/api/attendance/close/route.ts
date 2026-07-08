import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attendanceDays } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// POST /api/attendance/close   { date }
export async function POST(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const { date } = await req.json();
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

    const existing = await db.select().from(attendanceDays).where(eq(attendanceDays.date, date));
    if (existing.length) return NextResponse.json({ error: "Already closed" }, { status: 409 });

    await db.insert(attendanceDays).values({ date });
    await logActivity({ user: guard, action: "attendance.close-day", summary: `closed attendance for ${date}` });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/attendance/close?date=YYYY-MM-DD  -> reopen
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const date = req.nextUrl.searchParams.get("date");
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
    await db.delete(attendanceDays).where(eq(attendanceDays.date, date));
    await logActivity({ user: guard, action: "attendance.reopen-day", summary: `reopened attendance for ${date}` });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
