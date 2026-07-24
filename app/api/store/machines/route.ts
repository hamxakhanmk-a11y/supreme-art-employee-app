import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeMachines, storeParts } from "@/lib/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function normalizeModule(m: string | null | undefined): "machinery" | "consumables" {
  return m === "consumables" ? "consumables" : "machinery";
}

export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const mod = normalizeModule(req.nextUrl.searchParams.get("module"));
    const rows = await db.select({ name: storeMachines.name })
      .from(storeMachines)
      .where(eq(storeMachines.module, mod))
      .orderBy(asc(storeMachines.name));
    return NextResponse.json(rows.map(r => r.name));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const mod = normalizeModule(b?.module);
    const name = String(b?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    await db.execute(sql`
      INSERT INTO machines (name, module) VALUES (${name}, ${mod})
      ON CONFLICT (module, name) DO NOTHING
    `);
    await logActivity({ user: guard, action: "store.machine.add", summary: `added store machine "${name}" (${mod})` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const name = req.nextUrl.searchParams.get("name");
  const mod = normalizeModule(req.nextUrl.searchParams.get("module"));
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    // machine on parts is a comma-separated list; match exact name within it
    const pattern = "(^|,\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s*,|$)";
    const used = await db.execute(sql`
      SELECT id FROM parts
      WHERE machine ~ ${pattern} AND module = ${mod} AND deleted_at IS NULL
      LIMIT 1
    `);
    const list: any[] = (used as any).rows ?? (used as any);
    if (list.length > 0) {
      return NextResponse.json({ error: "Cannot delete: parts are assigned to this machine. Reassign them first." }, { status: 400 });
    }
    await db.delete(storeMachines).where(and(eq(storeMachines.name, name), eq(storeMachines.module, mod)));
    await logActivity({ user: guard, action: "store.machine.delete", summary: `deleted store machine "${name}" (${mod})` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
