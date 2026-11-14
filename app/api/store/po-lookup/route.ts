import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardWrite } from "@/lib/auth";
import { ensureStoreSchema } from "@/lib/store";
import { ensureProcurementTables, parseItems, qtyToNum, docNoLabel, lineUnit, type PoItem } from "@/lib/procurement";
import { storeModuleDenied } from "@/lib/storeAccess";
import { productKey } from "@/lib/rateChanges";

// GET /api/store/po-lookup?poNo=10501&module=consumables — the Procurement PO(s) with that number, for booking
// Store orders from them (Orders → New Order): supplier, dates and every line, each matched to the Store item it
// is (green on the form) or marked new (red). The PO number is shared by the registered and unregistered series,
// so there may be two. Lines already booked as Store orders say so.

const rowsOf = (r: unknown): Record<string, unknown>[] => ((r as { rows?: unknown[] }).rows ?? r) as Record<string, unknown>[];

export async function GET(req: NextRequest) {
  const guard = await guardWrite("store.orders");
  if (guard instanceof NextResponse) return guard;
  const mod = req.nextUrl.searchParams.get("module") === "machinery" ? "machinery" : "consumables";
  const no = await storeModuleDenied(guard, mod);
  if (no) return no;
  const poNo = parseInt(String(req.nextUrl.searchParams.get("poNo") || "").replace(/[^0-9]/g, ""), 10);
  if (!poNo) return NextResponse.json({ pos: [] });
  try {
    await ensureProcurementTables();
    await ensureStoreSchema();
    const pos = rowsOf(await db.execute(sql`
      SELECT id, po_no AS "poNo", registered, date::text AS date, expected_date::text AS "expectedDate",
             supplier_name AS "supplierName", supplier_brand AS "supplierBrand", items
      FROM purchase_orders WHERE po_no = ${poNo} ORDER BY id DESC`));
    if (!pos.length) return NextResponse.json({ pos: [] });
    const parts = rowsOf(await db.execute(sql`
      SELECT id, name, sku, unit, supplier, brand FROM parts WHERE module = ${mod} AND deleted_at IS NULL`));
    const booked = rowsOf(await db.execute(sql`
      SELECT po_id AS "poId", po_sr AS "poSr", SUM(qty) AS qty FROM store_orders
      WHERE po_id IN (${sql.join(pos.map(p => sql`${p.id}`), sql`, `)}) AND cancelled_at IS NULL GROUP BY po_id, po_sr`));
    const key = (s: unknown) => productKey(String(s || ""));
    const byKey = new Map<string, Record<string, unknown>[]>();
    for (const p of parts) {
      for (const k of new Set([key(p.name), key(`${p.sku || ""} ${p.name}`)])) {
        if (!k) continue;
        byKey.set(k, [...(byKey.get(k) ?? []), p]);
      }
    }
    // The Store item a PO line is: the same name (case, spaces, punctuation ignored), else one whose name the
    // line's description holds (or the other way round, for names of 6+ letters). Of several brands, the one
    // from this PO's supplier.
    const matchFor = (desc: string, supplier: string) => {
      const k = key(desc);
      if (!k) return null;
      let cands = byKey.get(k) ?? [];
      let how = "same name";
      if (!cands.length) {
        cands = parts.filter(p => { const pk = key(p.name); return pk.length >= 6 && (k.includes(pk) || pk.includes(k)); });
        how = "close name";
      }
      if (!cands.length) return null;
      const sk = key(supplier);
      const best = cands.find(p => sk && key(p.supplier) === sk) ?? cands[0];
      return { partId: Number(best.id), how, others: cands.length - 1 };
    };
    return NextResponse.json({
      pos: pos.map(po => ({
        id: po.id, poNo: po.poNo, label: docNoLabel(Number(po.poNo), po.registered as boolean | null), registered: po.registered,
        date: po.date, expectedDate: po.expectedDate, supplierName: po.supplierName || "", supplierBrand: po.supplierBrand || "",
        items: parseItems<PoItem>(po.items as string).filter(it => String(it.description || it.item || "").trim()).map(it => {
          const description = String(it.description || it.item || "").trim();
          const b = booked.find(x => Number(x.poId) === Number(po.id) && Number(x.poSr) === Number(it.srNo));
          return {
            srNo: it.srNo, description, quantity: qtyToNum(it.quantity) ?? 0, uom: lineUnit(it), rate: qtyToNum(it.rate),
            match: matchFor(description, String(po.supplierName || "")), booked: b ? Number(b.qty) : 0,
          };
        }),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
