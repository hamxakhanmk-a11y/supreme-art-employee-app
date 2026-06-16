import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveTypes } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const [u] = await db.update(leaveTypes).set({
      name: body.name,
      daysAllowed: parseInt(body.daysAllowed) || 0,
      isPaid: body.isPaid !== false,
      color: body.color || "#185FA5",
      description: body.description || null,
    }).where(eq(leaveTypes.id, parseInt(id))).returning();
    return NextResponse.json(u);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.delete(leaveTypes).where(eq(leaveTypes.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
