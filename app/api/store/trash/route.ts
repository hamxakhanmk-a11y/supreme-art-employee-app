import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeParts } from "@/lib/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema } from "@/lib/store";

// A deleted part stays in the Trash until someone removes it. Removing it from the Trash hides it for
// good but keeps its row, so its stock in and out history stays in the reports; a part that never had
// any movement is deleted outright. Nothing is deleted on a timer.
function normalizeModule(m: string | null | undefined): "machinery" | "consumables" {
  return m === "consumables" ? "consumables" : "machinery";
}

// GET /api/store/trash?module=machinery → { items: [...] }  (all=1 also lists those removed from the Trash,
// which the reports still need to name the parts of old movements; archivedAt says which)
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const mod = normalizeModule(req.nextUrl.searchParams.get("module"));
    const all = req.nextUrl.searchParams.get("all") === "1";
    const rows = await db.execute(sql`
      SELECT id, sku, name, category, machine, module, unit, qty, brand, supplier,
             rack_no     AS "rackNo",
             min_qty     AS "minQty",
             description AS "desc",
             deleted_at::text AS "deletedAt",
             archived_at::text AS "archivedAt"
      FROM parts
      WHERE module = ${mod} AND deleted_at IS NOT NULL ${all ? sql`` : sql`AND archived_at IS NULL`}
      ORDER BY deleted_at DESC
    `);
    const items = (rows as any).rows ?? (rows as any);
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { id } — restore a trashed part
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store.partdelete");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [target] = await db.select({ sku: storeParts.sku, name: storeParts.name, module: storeParts.module }).from(storeParts)
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
    await ensureStoreSchema();
    await db.execute(sql`UPDATE parts SET deleted_at = NULL, archived_at = NULL WHERE id = ${id}`);
    await logActivity({
      user: guard, action: `store.${target.module}.part.restore`,
      summary: `restored store part "${target.sku ? `[${target.sku}] ` : ""}${target.name}" from trash`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/store/trash?id=42 — remove from the Trash for good. A part with stock in or out history is
// kept (hidden) so that history stays; one with none is deleted.
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store.partdelete");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const id = parseInt(idParam);
    const [target] = await db.select({ module: storeParts.module }).from(storeParts)
      .where(and(eq(storeParts.id, id), isNotNull(storeParts.deletedAt)));
    await ensureStoreSchema();
    const hist = ((await db.execute(sql`SELECT 1 FROM transactions WHERE part_id = ${id} LIMIT 1`)) as any);
    const hasHistory = ((hist.rows ?? hist) as any[]).length > 0;
    if (hasHistory) {
      await db.execute(sql`UPDATE parts SET archived_at = now() WHERE id = ${id} AND deleted_at IS NOT NULL AND archived_at IS NULL`);
    } else {
      await db.execute(sql`DELETE FROM parts WHERE id = ${id} AND deleted_at IS NOT NULL`);
    }
    await logActivity({
      user: guard, action: `store.${target?.module || "unknown"}.part.purge`,
      summary: hasHistory ? `removed store part #${id} from the Trash (its history is kept)` : `permanently deleted store part #${id} (it had no history)`,
    });
    return NextResponse.json({ ok: true, archived: hasHistory });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
