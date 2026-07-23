import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeParts } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// GET /api/store/parts → [{ id, name, category, unit, qty, minQty, desc }]
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const rows = await db.select({
      id: storeParts.id,
      name: storeParts.name,
      category: storeParts.category,
      unit: storeParts.unit,
      qty: storeParts.qty,
      minQty: storeParts.minQty,
      desc: storeParts.description,
    }).from(storeParts).orderBy(asc(storeParts.id));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { name, category, unit?, minQty?, desc? } — create a new part with qty=0
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const name = String(b?.name || "").trim();
    const category = String(b?.category || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category required" }, { status: 400 });
    const [row] = await db.insert(storeParts).values({
      name, category,
      unit: (b?.unit || "pcs").toString(),
      qty: 0,
      minQty: Number(b?.minQty || 0),
      description: (b?.desc || "").toString(),
    }).returning({
      id: storeParts.id, name: storeParts.name, category: storeParts.category,
      unit: storeParts.unit, qty: storeParts.qty, minQty: storeParts.minQty, desc: storeParts.description,
    });
    await logActivity({ user: guard, action: "store.part.add", summary: `added store part "${name}" (${category})` });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT { id, name, category, unit, minQty?, desc? } — edit a part (qty is NOT
// editable here; changes go through /api/store/transactions).
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const name = String(b?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    await db.update(storeParts).set({
      name,
      category: String(b?.category || ""),
      unit: String(b?.unit || "pcs"),
      minQty: Number(b?.minQty || 0),
      description: (b?.desc || "").toString(),
    }).where(eq(storeParts.id, id));
    await logActivity({ user: guard, action: "store.part.edit", summary: `edited store part "${name}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/store/parts?id=42
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const id = parseInt(idParam);
    const [existing] = await db.select({ name: storeParts.name }).from(storeParts).where(eq(storeParts.id, id));
    await db.delete(storeParts).where(eq(storeParts.id, id));
    await logActivity({ user: guard, action: "store.part.delete", summary: `deleted store part "${existing?.name || `#${id}`}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
