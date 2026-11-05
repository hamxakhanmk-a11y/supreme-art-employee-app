// PO rate increases, for the owner's dashboard: a product ordered again at a higher rate than the last
// time it was ordered. Procurement (POs) only — purchase requisitions are not looked at. No database
// access here (lib/ownerDashboard.ts loads the POs), which keeps it testable on its own.
//
// A product is its description, typed however: case, spaces and punctuation are ignored, and "20*36",
// "20 x 36" and "20×36" read alike, so "Bleach Card 20*36 300 Gsm" and "bleach card 20x36 300gsm" are one
// product. Each order is compared with that product's order just before it on another PO (by PO date,
// then PO number), from any supplier. The unit has to agree — 200 a kg and 250 a drum are not a rise —
// unless one of the two orders has none ("Kg" / "kgs" / "KG." agree). The rate is the PO line's rate
// before tax and discounts.
import { parseItems, qtyToNum, docNoLabel, lineUnit, type PoItem } from "./procurement";

export interface RatePo {
  id: number; poNo: number; registered: boolean | null; date: string | null; supplierName: string | null; items: string | null;
}
export interface RateOrder { poId: number; po: string; date: string; supplier: string; rate: number; uom: string }
export interface RateIncrease { product: string; uom: string; before: RateOrder; now: RateOrder; rise: number; pct: number }

// The product as a key: lower case, "×" and "*" read as "x", a weight after a number written one way
// ("50 gm" = "50gm" = "50 gram" = "50g"; "5 kgs" = "5 kg"), and everything but letters and digits dropped.
// "300gsm" stays as it is.
export const productKey = (s: string) => s.toLowerCase()
  .replace(/[×*]/g, "x")
  .replace(/(\d)\s*(?:grams?|grms?|gms?|gm|gr|g)(?![a-z])/g, "$1g")
  .replace(/(\d)\s*(?:kilograms?|kilos?|kgs?)(?![a-z])/g, "$1kg")
  .replace(/[^a-z0-9]/g, "");
// A unit as a key: "Kgs." → "kg", "Reams" → "ream", "PCS" → "pc".
export const unitKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(?<=[a-z]{2})s$/, "");

// Increases on POs dated from–to (inclusive, "YYYY-MM-DD"), biggest rise (in %) first.
export function rateIncreases(pos: RatePo[], from: string, to: string): RateIncrease[] {
  type Line = RateOrder & { product: string; poNo: number; sr: number };
  const byProduct = new Map<string, Line[]>();
  for (const po of pos) {
    const date = po.date ? String(po.date).slice(0, 10) : "";
    if (!date) continue;
    for (const it of parseItems<PoItem>(po.items)) {
      const product = String(it.description || it.item || "").trim();
      const rate = qtyToNum(it.rate);
      if (!product || rate == null || !(rate > 0)) continue;
      const key = productKey(product);
      if (!key) continue;
      const list = byProduct.get(key) ?? [];
      list.push({
        product, poId: po.id, poNo: po.poNo, sr: Number(it.srNo) || 0, po: `PO ${docNoLabel(po.poNo, po.registered)}`,
        date, supplier: (po.supplierName || "").trim(), rate, uom: lineUnit(it),
      });
      byProduct.set(key, list);
    }
  }
  const out: RateIncrease[] = [];
  for (const lines of byProduct.values()) {
    lines.sort((a, b) => a.date.localeCompare(b.date) || a.poNo - b.poNo || a.poId - b.poId || a.sr - b.sr);
    for (let i = 0; i < lines.length; i++) {
      const now = lines[i];
      if (now.date < from || now.date > to) continue;
      // The latest earlier order of it, on another PO, in a unit that agrees.
      let before: Line | undefined;
      for (let j = i - 1; j >= 0; j--) {
        const b = lines[j];
        if (b.poId === now.poId) continue;
        if (unitKey(b.uom) && unitKey(now.uom) && unitKey(b.uom) !== unitKey(now.uom)) continue;
        before = b; break;
      }
      if (!before || now.rate - before.rate < 0.005) continue;
      const strip = ({ poId, po, date, supplier, rate, uom }: Line): RateOrder => ({ poId, po, date, supplier, rate, uom });
      out.push({
        product: now.product, uom: now.uom || before.uom, before: strip(before), now: strip(now),
        rise: now.rate - before.rate, pct: (now.rate - before.rate) / before.rate * 100,
      });
    }
  }
  return out.sort((a, b) => b.pct - a.pct || b.now.date.localeCompare(a.now.date));
}
