import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeParts, storeTransactions } from "@/lib/schema";
import { and, asc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const MODULES = new Set(["machinery", "consumables"]);
function normalizeModule(m: string | null | undefined): "machinery" | "consumables" {
  return m === "consumables" ? "consumables" : "machinery";
}

// GET /api/store/parts?module=machinery
// Active parts (not soft-deleted) for the given module.
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const mod = normalizeModule(req.nextUrl.searchParams.get("module"));
    const rows = await db.select({
      id: storeParts.id,
      sku: storeParts.sku,
      name: storeParts.name,
      category: storeParts.category,
      machine: storeParts.machine,
      brand: storeParts.brand,
      supplier: storeParts.supplier,
      rackNo: storeParts.rackNo,
      module: storeParts.module,
      unit: storeParts.unit,
      qty: storeParts.qty,
      minQty: storeParts.minQty,
      desc: storeParts.description,
      imageUrl: storeParts.imageUrl,
    }).from(storeParts)
      .where(and(eq(storeParts.module, mod), isNull(storeParts.deletedAt)))
      .orderBy(asc(storeParts.id));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — create a part
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const mod = normalizeModule(b?.module);
    const name = String(b?.name || "").trim();
    const category = String(b?.category || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category required" }, { status: 400 });
    const skuTrim = String(b?.sku || "").trim();
    const skuVal = skuTrim || null;

    if (skuVal) {
      // Case-insensitive dup check among active parts
      const dup = await db.execute(sql`
        SELECT id, sku, name, category, module, unit, qty,
               min_qty AS "minQty", description AS "desc"
        FROM parts
        WHERE LOWER(sku) = LOWER(${skuVal}) AND deleted_at IS NULL
        LIMIT 1
      `);
      const rows: any[] = (dup as any).rows ?? (dup as any);
      if (rows.length > 0) {
        return NextResponse.json({ error: `SKU "${rows[0].sku}" already exists`, existing: rows[0] }, { status: 409 });
      }
    }

    try {
      const [row] = await db.insert(storeParts).values({
        sku: skuVal,
        name, category,
        machine: (b?.machine || "").toString(),
        brand: (b?.brand || "").toString(),
        supplier: (b?.supplier || "").toString(),
        rackNo: (b?.rackNo || "").toString(),
        module: mod,
        unit: (b?.unit || "pcs").toString(),
        qty: 0,
        minQty: Number(b?.minQty || 0),
        description: (b?.desc || "").toString(),
        imageUrl: b?.imageUrl || null,
      }).returning({
        id: storeParts.id, sku: storeParts.sku, name: storeParts.name,
        category: storeParts.category, machine: storeParts.machine,
        brand: storeParts.brand, supplier: storeParts.supplier, rackNo: storeParts.rackNo,
        module: storeParts.module,
        unit: storeParts.unit, qty: storeParts.qty, minQty: storeParts.minQty,
        desc: storeParts.description, imageUrl: storeParts.imageUrl,
      });
      await logActivity({ user: guard, action: `store.${mod}.part.add`, summary: `added store part "${skuVal ? `[${skuVal}] ` : ""}${name}" (${mod})` });
      return NextResponse.json(row);
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("parts_sku") || e?.code === "23505") {
        return NextResponse.json({ error: `SKU "${skuTrim}" already exists` }, { status: 409 });
      }
      throw e;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — edit a part. If `qty` is included, it OVERWRITES the running total
// (matches the live store's behaviour), logs the delta, AND records an
// adjustment transaction for it — without that, the transaction log's
// running "Balance" column (computed client-side purely from transaction
// history) would silently drift away from the real qty on hand the moment
// anyone corrected a count here, with nothing in Stock In/Out to explain
// the gap.
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const name = String(b?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const skuTrim = String(b?.sku || "").trim();
    const skuVal = skuTrim || null;
    const imageProvided = Object.prototype.hasOwnProperty.call(b, "imageUrl");
    const imageVal = b?.imageUrl || null;
    const qtyRaw = b?.qty;
    const qtyVal = qtyRaw === undefined || qtyRaw === null || qtyRaw === ""
      ? null
      : Math.max(0, parseInt(qtyRaw) || 0);

    let beforeQty: number | null = null;
    let partInfo: any = null;
    if (qtyVal !== null) {
      const [existing] = await db.select({
        id: storeParts.id, name: storeParts.name, sku: storeParts.sku,
        unit: storeParts.unit, module: storeParts.module, qty: storeParts.qty,
      }).from(storeParts).where(eq(storeParts.id, id));
      if (existing) { partInfo = existing; beforeQty = existing.qty; }
    }

    const updateFields: Record<string, unknown> = {
      sku: skuVal,
      name,
      category: String(b?.category || ""),
      machine: (b?.machine || "").toString(),
      brand: (b?.brand || "").toString(),
      supplier: (b?.supplier || "").toString(),
      rackNo: (b?.rackNo || "").toString(),
      unit: String(b?.unit || "pcs"),
      minQty: Number(b?.minQty || 0),
      description: (b?.desc || "").toString(),
    };
    if (qtyVal !== null) updateFields.qty = qtyVal;
    if (imageProvided) updateFields.imageUrl = imageVal;

    try {
      await db.update(storeParts).set(updateFields).where(eq(storeParts.id, id));
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("parts_sku") || e?.code === "23505") {
        return NextResponse.json({ error: `SKU "${skuTrim}" already exists` }, { status: 409 });
      }
      throw e;
    }

    let adjustmentTxn: unknown = null;
    if (partInfo && qtyVal !== null && beforeQty !== qtyVal) {
      const diff = qtyVal - (beforeQty ?? 0);
      const sign = diff > 0 ? "+" : "";
      // Adjustment transaction so the Stock In/Out log — and its computed
      // running balance — stays truthful, instead of only the part's own
      // qty column changing with no visible record of why. Returned to the
      // caller (not just written) so the store UI — which keeps its own
      // in-memory transaction list rather than re-fetching after every
      // action — can append it and have the balance actually reflect the
      // edit immediately, instead of only after a full page reload.
      // Set on all four ref/notes/issuedTo/purpose columns (not just the pair
      // for this direction) since Stock In reads ref+notes while Stock Out
      // and the combined Issuance log read issuedTo+purpose — a decrease
      // only filling issuedTo left the "why" (the before→after detail)
      // invisible wherever the table actually reads purpose instead of notes.
      const label = `Qty Edit (${diff > 0 ? "increase" : "decrease"})`;
      const detail = `Qty corrected via Edit: ${beforeQty} → ${qtyVal} ${partInfo.unit}`;
      const [txn] = await db.insert(storeTransactions).values({
        type: diff > 0 ? "in" : "out",
        partId: id,
        qty: Math.abs(diff),
        date: new Date().toISOString().slice(0, 10),
        ref: label,
        notes: detail,
        issuedTo: label,
        purpose: detail,
      }).returning({
        id: storeTransactions.id, type: storeTransactions.type, partId: storeTransactions.partId,
        qty: storeTransactions.qty, date: sql<string>`${storeTransactions.date}::text`.as("date"),
        ref: storeTransactions.ref, notes: storeTransactions.notes,
        issuedTo: storeTransactions.issuedTo, purpose: storeTransactions.purpose,
      });
      adjustmentTxn = txn;
      await logActivity({
        user: guard, action: `store.${partInfo.module}.part.qty_edit`,
        summary: `edited qty of "${partInfo.sku ? `[${partInfo.sku}] ` : ""}${partInfo.name}": ${beforeQty} → ${qtyVal} ${partInfo.unit} (${sign}${diff})`,
      });
    }
    return NextResponse.json({ ok: true, adjustmentTxn });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/store/parts?id=42 — SOFT delete (moves to trash, purged after 7 days)
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const id = parseInt(idParam);
    const [existing] = await db.select({ name: storeParts.name, sku: storeParts.sku, module: storeParts.module }).from(storeParts).where(eq(storeParts.id, id));
    await db.update(storeParts).set({ deletedAt: new Date() }).where(eq(storeParts.id, id));
    await logActivity({
      user: guard, action: `store.${existing?.module || "unknown"}.part.trash`,
      summary: `moved store part "${existing?.sku ? `[${existing.sku}] ` : ""}${existing?.name || `#${id}`}" to trash`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
