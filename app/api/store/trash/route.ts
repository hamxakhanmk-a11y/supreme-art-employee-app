import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeParts } from "@/lib/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const TRASH_RETENTION_DAYS = 7;
function normalizeModule(m: string | null | undefined): "machinery" | "consumables" {
  return m === "consumables" ? "consumables" : "machinery";
}

async function purgeOldTrash() {
  // Parts trashed > retention days ago are permanently deleted.
  await db.execute(sql`DELETE FROM parts WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'`);
}

// GET /api/store/trash?module=machinery → { retentionDays, items: [...] }
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await purgeOldTrash();
    const mod = normalizeModule(req.nextUrl.searchParams.get("module"));
    const rows = await db.execute(sql`
      SELECT id, sku, name, category, machine, module, unit, qty,
             min_qty     AS "minQty",
             description AS "desc",
             deleted_at::text AS "deletedAt",
             (deleted_at + INTERVAL '7 days')::text AS "purgeAt"
      FROM parts
      WHERE module = ${mod} AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `);
    const items = (rows as any).rows ?? (rows as any);
    return NextResponse.json({ retentionDays: TRASH_RETENTION_DAYS, items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { id } — restore a trashed part
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [target] = await db.select({ sku: storeParts.sku, name: storeParts.name }).from(storeParts)
      .where(and(eq(storeParts.id, id), isNotNull(storeParts.deletedAt)));
    if (!target) return NextResponse.json({ error: "Trashed part not found" }, { status: 404 });
    if (target.sku) {
      // Prevent restoring into an SKU already in use by another active part
      const clash = await db.execute(sql`
        SELECT id, sku, name FROM parts
        WHERE LOWER(sku) = LOWER(${target.sku}) AND deleted_at IS NULL AND id <> ${id}
        LIMIT 1
      `);
      const rows: any[] = (clash as any).rows ?? (clash as any);
      if (rows.length) {
        return NextResponse.json({
          error: `Cannot restore: SKU "${target.sku}" is already used by active part "${rows[0].name}". Rename or delete that one first.`,
        }, { status: 409 });
      }
    }
    await db.update(storeParts).set({ deletedAt: null }).where(eq(storeParts.id, id));
    await logActivity({
      user: guard, action: "store.part.restore",
      summary: `restored store part "${target.sku ? `[${target.sku}] ` : ""}${target.name}" from trash`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/store/trash?id=42 — permanent delete (skip retention window)
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const id = parseInt(idParam);
    await db.execute(sql`DELETE FROM parts WHERE id = ${id} AND deleted_at IS NOT NULL`);
    await logActivity({ user: guard, action: "store.part.purge", summary: `permanently deleted store part #${id}` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
