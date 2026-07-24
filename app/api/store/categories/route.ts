import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeCategories, storeParts } from "@/lib/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function normalizeModule(m: string | null | undefined): "machinery" | "consumables" {
  return m === "consumables" ? "consumables" : "machinery";
}

// GET /api/store/categories?module=machinery → ["Bearings", "Belts", …]
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const mod = normalizeModule(req.nextUrl.searchParams.get("module"));
    const rows = await db.select({ name: storeCategories.name })
      .from(storeCategories)
      .where(eq(storeCategories.module, mod))
      .orderBy(asc(storeCategories.name));
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
    // Use raw SQL for the composite (module,name) ON CONFLICT since Drizzle
    // doesn't know about our custom unique index.
    await db.execute(sql`
      INSERT INTO categories (name, module) VALUES (${name}, ${mod})
      ON CONFLICT (module, name) DO NOTHING
    `);
    await logActivity({ user: guard, action: "store.category.add", summary: `added store category "${name}" (${mod})` });
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
    const used = await db.select({ id: storeParts.id }).from(storeParts)
      .where(and(eq(storeParts.category, name), eq(storeParts.module, mod), isNull(storeParts.deletedAt)))
      .limit(1);
    if (used.length > 0) {
      return NextResponse.json({ error: "Cannot delete: parts are using this category. Reassign them first." }, { status: 400 });
    }
    await db.delete(storeCategories).where(and(eq(storeCategories.name, name), eq(storeCategories.module, mod)));
    await logActivity({ user: guard, action: "store.category.delete", summary: `deleted store category "${name}" (${mod})` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
