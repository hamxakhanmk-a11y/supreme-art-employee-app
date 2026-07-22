import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inspections } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const [row] = await db.select().from(inspections).where(eq(inspections.id, parseInt(id)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ inspection: row });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("inspection");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const results = Array.isArray(b.results) ? b.results : [];
  await db.update(inspections).set({
    date: b.date || new Date().toISOString().slice(0, 10),
    materialType: b.materialType || null,
    supplierName: b.supplierName || null,
    results: JSON.stringify(results),
    inspectedBy: b.inspectedBy || null,
  }).where(eq(inspections.id, parseInt(id)));
  await logActivity({ user: guard, action: "inspection.update", summary: `edited Inspection (id ${id})` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("inspection");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const { id } = await ctx.params;
  await db.delete(inspections).where(eq(inspections.id, parseInt(id)));
  await logActivity({ user: guard, action: "inspection.delete", summary: `deleted Inspection (id ${id})` });
  return NextResponse.json({ ok: true });
}
