import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveRequests } from "@/lib/schema";
import { eq } from "drizzle-orm";

// PUT — approve/reject or edit request
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
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
      .where(eq(leaveRequests.id, parseInt(id))).returning();
    return NextResponse.json(u);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.delete(leaveRequests).where(eq(leaveRequests.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
