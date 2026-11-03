import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema } from "@/lib/store";

// The purchase order and invoice numbers of a stock in, and the batch number as written on its
// sticker, kept from the sticker window. Only these fields change; nothing about the quantity or
// the stock.

// PUT { id, poNo, invoiceNo, batchLabel? }   (batchLabel left out: unchanged; "" : back to the automatic one)
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const id = parseInt(b?.id);
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const poNo = String(b?.poNo ?? "").trim().slice(0, 60), invoiceNo = String(b?.invoiceNo ?? "").trim().slice(0, 60);
    const hasLabel = Object.prototype.hasOwnProperty.call(b, "batchLabel");
    const batchLabel = String(b?.batchLabel ?? "").trim().slice(0, 40);
    const res = await db.execute(sql`
      UPDATE transactions SET po_no = ${poNo}, invoice_no = ${invoiceNo},
             batch_label = ${hasLabel ? sql`${batchLabel}` : sql`batch_label`}
      WHERE id = ${id} AND type = 'in'
      RETURNING id, po_no AS "poNo", invoice_no AS "invoiceNo", batch_label AS "batchLabel"`);
    const row = ((res as any).rows ?? (res as any))[0];
    if (!row) return NextResponse.json({ error: "That stock in was not found" }, { status: 404 });
    await logActivity({ user: guard, action: "store.consumables.txn.details", summary: `set PO "${poNo || "—"}" and invoice "${invoiceNo || "—"}" on a stock in` });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
