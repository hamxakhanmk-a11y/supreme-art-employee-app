import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeCategories, storeParts } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// GET /api/store/categories → ["Bearings", "Inks", …]
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const rows = await db.select({ name: storeCategories.name }).from(storeCategories).orderBy(asc(storeCategories.name));
    return NextResponse.json(rows.map(r => r.name));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { name } — add a category. Silently ignores duplicates.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    await db.insert(storeCategories).values({ name }).onConflictDoNothing();
    await logActivity({ user: guard, action: "store.category.add", summary: `added store category "${name}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/store/categories?name=Bearings
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  try {
    const used = await db.select({ id: storeParts.id }).from(storeParts).where(eq(storeParts.category, name)).limit(1);
    if (used.length > 0) {
      return NextResponse.json({ error: "Cannot delete: parts are using this category. Reassign them first." }, { status: 400 });
    }
    await db.delete(storeCategories).where(eq(storeCategories.name, name));
    await logActivity({ user: guard, action: "store.category.delete", summary: `deleted store category "${name}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
