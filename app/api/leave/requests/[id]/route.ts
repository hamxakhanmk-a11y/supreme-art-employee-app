import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveRequests, attendance, leaveTypes } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// PUT — approve/reject or edit request
// On approval of a half-day request, auto-stamp attendance for that date
// with status="half-day" so the Monthly Register shows P with the ½ marker.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("forms");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const reqId = parseInt(id);
    const body = await req.json();

    const update: any = { updatedAt: new Date() };
    if (body.status) {
      update.status = body.status;
      update.decidedAt = new Date();
      update.decidedBy = body.decidedBy || "Admin";
      update.decisionNote = body.decisionNote || null;
    }
    if (body.reason !== undefined) update.reason = body.reason;

    const [u] = await db.update(leaveRequests).set(update)
      .where(eq(leaveRequests.id, reqId)).returning();

    // Auto-stamp attendance for approved half-day requests
    if (u && body.status === "approved" && u.halfSegment) {
      const segLabel = u.halfSegment === "first" ? "First half (morning)" : "Second half (afternoon)";
      const note = `Approved half-day — ${segLabel}${update.decidedBy ? ` by ${update.decidedBy}` : ""}`;
      // Upsert: replace any existing record for this employee/date
      const existing = await db.select().from(attendance)
        .where(and(eq(attendance.employeeId, u.employeeId), eq(attendance.date, u.startDate)));
      if (existing.length > 0) {
        await db.update(attendance)
          .set({ status: "half-day", notes: note, updatedAt: new Date() })
          .where(eq(attendance.id, existing[0].id));
      } else {
        await db.insert(attendance).values({
          employeeId: u.employeeId,
          date: u.startDate,
          status: "half-day",
          notes: note,
        });
      }
    }

    if (u && body.status) {
      await logActivity({
        user: guard, action: `leave.${body.status}`, employeeId: u.employeeId,
        summary: `leave request ${body.status} (${u.startDate}${u.endDate !== u.startDate ? ` → ${u.endDate}` : ""}, ${u.days} day${u.days === 1 ? "" : "s"}${u.halfSegment ? ", half-day" : ""})`,
      });
    }
    return NextResponse.json(u);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("forms");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    await db.delete(leaveRequests).where(eq(leaveRequests.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
