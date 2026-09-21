import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supplierProductRates } from "@/lib/schema";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables } from "@/lib/procurement";

export const dynamic = "force-dynamic";

// POST { product, supplier, rate, tax } — note a reference rate against a
// product + supplier in the Supplier Directory.
//
// This is only ever a note. The directory shows the rate off that product's
// most recent PO until a row exists here, at which point the noted value is
// shown instead — but nothing here is written back to any purchase order, so
// the POs and their printed copies keep saying exactly what they said.
// Clearing both fields removes the note and the PO's own rate shows again.
export async function POST(req: Request) {
  const guard = await guardWrite("suppliers");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();

  const b = await req.json().catch(() => ({}));
  const product = String(b?.product ?? "").trim();
  const supplier = String(b?.supplier ?? "").trim();
  if (!product || !supplier) {
    return NextResponse.json({ error: "product and supplier are required" }, { status: 400 });
  }

  // Blank means "no note for this field" — not zero.
  const parseField = (v: unknown, label: string): number | null | { error: string } => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = Number(v);
    if (!isFinite(n) || n < 0) return { error: `${label} must be a positive number.` };
    return n;
  };
  const rate = parseField(b?.rate, "Rate");
  if (rate !== null && typeof rate !== "number") return NextResponse.json({ error: rate.error }, { status: 400 });
  const taxPct = parseField(b?.tax, "Tax %");
  if (taxPct !== null && typeof taxPct !== "number") return NextResponse.json({ error: taxPct.error }, { status: 400 });

  const where = and(eq(supplierProductRates.product, product), eq(supplierProductRates.supplier, supplier));

  // Nothing noted on either field → drop the note entirely so the row falls
  // back to the PO rate rather than sitting there as an empty override.
  if (rate === null && taxPct === null) {
    await db.delete(supplierProductRates).where(where);
    await logActivity({
      user: guard, action: "suppliers.rate-note.clear",
      summary: `cleared the reference rate on "${product}" from ${supplier}`,
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const [existing] = await db.select({ id: supplierProductRates.id }).from(supplierProductRates).where(where);
  if (existing) {
    await db.update(supplierProductRates)
      .set({ rate, taxPct, updatedBy: guard.name, updatedAt: new Date() })
      .where(eq(supplierProductRates.id, existing.id));
  } else {
    await db.insert(supplierProductRates).values({ product, supplier, rate, taxPct, updatedBy: guard.name });
  }

  await logActivity({
    user: guard, action: "suppliers.rate-note.set",
    summary: `noted reference rate on "${product}" from ${supplier}: ${rate ?? "—"} @ ${taxPct ?? "—"}% tax`,
  });
  return NextResponse.json({ ok: true });
}
