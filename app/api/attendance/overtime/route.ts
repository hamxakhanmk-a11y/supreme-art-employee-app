import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { overtime } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { guardWrite, getSession } from "@/lib/auth";
import { ensureOvertimeTable, overtimeForDate } from "@/lib/overtimeServer";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/attendance/overtime?date=YYYY-MM-DD → { entries: { [employeeId]: hours } }
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date required" }, { status: 400 });
  const entries = await overtimeForDate(date);
  return NextResponse.json({ entries });
}

// POST { date, entries: [{ employeeId, hours }] } — save the overtime for a date.
// hours <= 0 clears that employee's record for the day; positive values upsert.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("attendance");
  if (guard instanceof NextResponse) return guard;
  await ensureOvertimeTable();
  try {
    const b = await req.json().catch(() => ({}));
    const date = String(b.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date required" }, { status: 400 });
    const entries: { employeeId: number; hours: number }[] = Array.isArray(b.entries) ? b.entries : [];

    for (const e of entries) {
      const empId = parseInt(String(e.employeeId), 10);
      if (isNaN(empId)) continue;
      const hours = Math.max(0, Number(e.hours) || 0);
      if (hours > 0) {
        await db.insert(overtime).values({ employeeId: empId, date, hours })
          .onConflictDoUpdate({ target: [overtime.employeeId, overtime.date], set: { hours, updatedAt: new Date() } });
      } else {
        await db.delete(overtime).where(and(eq(overtime.employeeId, empId), eq(overtime.date, date)));
      }
    }
    await logActivity({ user: guard, action: "overtime.save", summary: `recorded overtime for ${date}` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
