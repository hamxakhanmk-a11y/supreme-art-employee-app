import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { demands } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const [row] = await db.select().from(demands).where(eq(demands.id, parseInt(id)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ demand: row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("demand");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const items = Array.isArray(b.items) ? b.items : [];
  await db.update(demands).set({
    date: b.date || new Date().toISOString().slice(0, 10),
    requiredBy: b.requiredBy || null,
    demandBy: b.demandBy || null,
    department: b.department || null,
    preparedBy: b.preparedBy || null,
    approvedBy: b.approvedBy || null,
    sectionIncharge: b.sectionIncharge || null,
    items: JSON.stringify(items),
  }).where(eq(demands.id, parseInt(id)));
  await logActivity({ user: guard, action: "demand.update", summary: `edited Demand (id ${id})` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("demand");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  await db.delete(demands).where(eq(demands.id, parseInt(id)));
  await logActivity({ user: guard, action: "demand.delete", summary: `deleted Demand (id ${id})` });
  return NextResponse.json({ ok: true });
}
