import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { grns } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const [row] = await db.select().from(grns).where(eq(grns.id, parseInt(id)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ grn: row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("grn");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const items = Array.isArray(b.items) ? b.items : [];
  await db.update(grns).set({
    date: b.date || new Date().toISOString().slice(0, 10),
    receivedBy: b.receivedBy || null,
    verifiedBy: b.verifiedBy || null,
    items: JSON.stringify(items),
  }).where(eq(grns.id, parseInt(id)));
  await logActivity({ user: guard, action: "grn.update", summary: `edited GRN (id ${id})` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("grn");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  await db.delete(grns).where(eq(grns.id, parseInt(id)));
  await logActivity({ user: guard, action: "grn.delete", summary: `deleted GRN (id ${id})` });
  return NextResponse.json({ ok: true });
}
