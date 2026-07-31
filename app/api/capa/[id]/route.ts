import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { capaReports } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureCapaTable } from "@/lib/capa";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureCapaTable();
  const { id } = await ctx.params;
  const [row] = await db.select().from(capaReports).where(eq(capaReports.id, parseInt(id)));
  if (!row) return NextResponse.json({ error: "CAPA not found" }, { status: 404 });
  return NextResponse.json({ capa: row });
}

// PUT — save the form. Body: { data, status?, issueDate? }
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("capa");
  if (guard instanceof NextResponse) return guard;
  await ensureCapaTable();
  const { id } = await ctx.params;
  const capaId = parseInt(id);
  const b = await req.json().catch(() => ({}));

  const [existing] = await db.select().from(capaReports).where(eq(capaReports.id, capaId));
  if (!existing) return NextResponse.json({ error: "CAPA not found" }, { status: 404 });

  // A closed CAPA is locked — only a superadmin can reopen or amend it, so the
  // signed-off record can't be quietly rewritten.
  if (existing.status === "closed" && guard.role !== "superadmin") {
    return NextResponse.json(
      { error: "This CAPA is closed and locked. Only a Super Admin can edit it." },
      { status: 403 },
    );
  }

  const nextStatus: string = typeof b.status === "string" ? b.status : existing.status;
  const isClosing = nextStatus === "closed" && existing.status !== "closed";

  const [row] = await db.update(capaReports).set({
    data: JSON.stringify(b.data ?? {}),
    status: nextStatus,
    issueDate: b.issueDate ?? existing.issueDate,
    updatedAt: new Date(),
    closedAt: isClosing ? new Date() : (nextStatus === "closed" ? existing.closedAt : null),
  }).where(eq(capaReports.id, capaId)).returning();

  await logActivity({
    user: guard,
    action: isClosing ? "capa.close" : "capa.update",
    summary: isClosing ? `closed CAPA ${existing.capaRef}` : `updated CAPA ${existing.capaRef}`,
  });
  return NextResponse.json({ capa: row });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("capa");
  if (guard instanceof NextResponse) return guard;
  await ensureCapaTable();
  const { id } = await ctx.params;
  const capaId = parseInt(id);
  const [existing] = await db.select().from(capaReports).where(eq(capaReports.id, capaId));
  if (!existing) return NextResponse.json({ error: "CAPA not found" }, { status: 404 });
  // Deleting a signed-off record is a superadmin-only action.
  if (existing.status === "closed" && guard.role !== "superadmin") {
    return NextResponse.json({ error: "Closed CAPAs can only be deleted by a Super Admin." }, { status: 403 });
  }
  await db.delete(capaReports).where(eq(capaReports.id, capaId));
  await logActivity({ user: guard, action: "capa.delete", summary: `deleted CAPA ${existing.capaRef}` });
  return NextResponse.json({ ok: true });
}
