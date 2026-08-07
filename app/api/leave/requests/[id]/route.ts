import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveRequests, attendance, leaveTypes } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
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

    // Auto-stamp attendance across the whole leave range for an approved full
    // leave (not a half-day) — including future dates. These are ordinary
    // attendance rows, so HR can still edit any day afterwards. Sundays (the
    // weekly off) are left untouched.
    if (u && body.status === "approved" && !u.halfSegment) {
      const [lt] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, u.leaveTypeId));
      const typeName = lt?.name || "Leave";
      const note = `Approved leave — ${typeName}${update.decidedBy ? ` by ${update.decidedBy}` : ""}`;

      // Enumerate calendar dates start..end inclusive (UTC-safe), skipping Sundays.
      const [ys, ms, ds] = u.startDate.split("-").map(Number);
      const [ye, me2, de] = u.endDate.split("-").map(Number);
      const endUtc = Date.UTC(ye, me2 - 1, de);
      const dates: string[] = [];
      for (let cur = Date.UTC(ys, ms - 1, ds); cur <= endUtc; cur += 86400000) {
        const dd = new Date(cur);
        if (dd.getUTCDay() === 0) continue; // Sunday off
        dates.push(dd.toISOString().slice(0, 10));
      }

      if (dates.length) {
        const existing = await db.select().from(attendance)
          .where(and(eq(attendance.employeeId, u.employeeId), inArray(attendance.date, dates)));
        const byDate = new Map(existing.map(r => [r.date, r]));
        const toInsert: { employeeId: number; date: string; status: string; notes: string }[] = [];
        for (const dt of dates) {
          const ex = byDate.get(dt);
          if (ex) {
            await db.update(attendance)
              .set({ status: "leave", notes: note, updatedAt: new Date() })
              .where(eq(attendance.id, ex.id));
          } else {
            toInsert.push({ employeeId: u.employeeId, date: dt, status: "leave", notes: note });
          }
        }
        if (toInsert.length) await db.insert(attendance).values(toInsert);
      }
    }

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
