// Spending for the Super Admin's dashboard, over a date range:
//  - Purchase: every requisition line's own value and category, on the requisition's date.
//    A requisition the HOD did not approve, or HR rejected, was never spent and is left out.
//  - Procurement: what actually arrived on a GRR (its received quantity), valued at the
//    linked PO line's rate plus tax, less that PO's discount in proportion. On the GRR's
//    date, under the GRR's categories (split equally when it has several). A PO line never
//    costs more than it was ordered for: the GRRs against it are taken in date order and
//    whatever goes past the ordered quantity is not valued again (a GRR typed in another
//    unit, sheets against a PO in packets, would otherwise multiply the money).
// Anything that can't be counted is not guessed at: it goes into `skipped` with the reason,
// so the dashboard can say what was left out. No database access here (see
// lib/ownerDashboard.ts), which keeps the arithmetic testable on its own.
import { parsePrItems } from "./purchase";
import {
  parseItems, parseInspection, withValueCategories, checklistCategory, qtyToNum, docNoLabel,
  type PoItem, type GrnItem, type GrrChecklist,
} from "./procurement";

export type ExpenseSource = "purchase" | "procurement";

export interface ExpenseLine {
  source: ExpenseSource;
  date: string;          // yyyy-mm-dd
  category: string;
  amount: number;        // PKR, not rounded
  calc?: string;         // how a procurement amount was worked out, shown beside it
  po?: string;           // procurement: the PO it was valued from, "PO 10234"
  poDate?: string;       // and that PO's date ("" when unknown)
  ref: string;           // "PR 121", "GRR 15004u"
  description: string;
  href: string;
}

export interface SkippedLine {
  source: ExpenseSource;
  reason: string;
  date: string;          // "" when the document has none
  ref: string;
  description: string;
  href: string;
}

export interface PrInput {
  id: number; prNo: number | null; date: string | null; category: string | null;
  items: string | null; itemName: string | null; quantity: number | null; uom: string | null; value: number | null;
  hodApproval: string | null; hrApproval: string | null;
}
export interface PoInput { id: number; poNo: number; registered: boolean | null; items: string | null; discount: number | null; date?: string | null }
export interface GrnInput {
  id: number; grnNo: number; registered: boolean | null; date: string; poId: number | null; poNo: number | null;
  items: string | null; inspection: string | null;
}

export const UNCATEGORISED = "Uncategorised";

export const SKIP = {
  prRejected: "Requisition not approved / rejected",
  prNoDate: "Requisition has no date",
  prNoValue: "Requisition line has no value",
  grrRejected: "GRR rejected at inspection",
  grrNoPo: "GRR not linked to a PO",
  grrNotOnPo: "GRR line not found on its PO",
  grrBadQty: "GRR quantity is not a number",
  grrNoRate: "PO line has no rate",
  grrPastPo: "Already received in full on earlier GRRs",
} as const;

const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
// A PO line's money, reading its numbers the way the Supplier Directory does: "1,450" is 1450, "18%" is 18.
function lineMoney(qty: number, it: Pick<PoItem, "rate" | "tax">) {
  const rate = qtyToNum(it.rate) ?? 0, taxPct = qtyToNum(it.tax) ?? 0;
  const gross = qty * rate;
  return { rate, taxPct, net: gross + gross * taxPct / 100 };
}
const normDesc = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function isRejectedPr(pr: Pick<PrInput, "hodApproval" | "hrApproval">): boolean {
  return pr.hodApproval === "Not Approved" || pr.hrApproval === "Rejected";
}

export function purchaseExpenses(prs: PrInput[], from: string, to: string, lines: ExpenseLine[], skipped: SkippedLine[]) {
  for (const pr of prs) {
    const ref = pr.prNo != null ? `PR ${pr.prNo}` : `PR (no number)`;
    const href = `/purchase?open=${pr.id}`;
    const date = pr.date || "";
    // A requisition with no date belongs to no period; it is reported whatever the range.
    if (date && !inRange(date, from, to)) continue;
    const items = parsePrItems(pr).filter(it => it.itemName || it.value != null);
    if (!items.length) continue;
    const rejected = isRejectedPr(pr);
    if (rejected && !date) continue;   // neither spent nor in any period: nothing to say about it
    for (const it of items) {
      const description = it.itemName || "";
      if (rejected) { skipped.push({ source: "purchase", reason: SKIP.prRejected, date, ref, description, href }); continue; }
      if (!date) { skipped.push({ source: "purchase", reason: SKIP.prNoDate, date, ref, description, href }); continue; }
      if (it.value == null || !Number.isFinite(it.value)) { skipped.push({ source: "purchase", reason: SKIP.prNoValue, date, ref, description, href }); continue; }
      lines.push({ source: "purchase", date, category: it.category || pr.category?.trim() || UNCATEGORISED, amount: it.value, ref, description, href });
    }
  }
}

export function procurementExpenses(
  grns: GrnInput[], pos: PoInput[], checklist: GrrChecklist, from: string, to: string,
  lines: ExpenseLine[], skipped: SkippedLine[],
) {
  const byId = new Map(pos.map(p => [p.id, p]));
  // Old GRRs may carry only the PO number. It is reused across the registered and unregistered series,
  // so it only identifies a PO together with the tax status, and only when that pair is unique.
  const byNo = new Map<string, PoInput | null>();
  for (const p of pos) {
    const k = `${p.poNo}|${p.registered}`;
    byNo.set(k, byNo.has(k) ? null : p);
  }

  // How much of each PO line earlier GRRs have received, so a later one is only valued up to what is left.
  // Every GRR of the PO is passed in, earlier ones too; only those in the range are counted.
  const receivedSoFar = new Map<string, number>();
  const ordered = [...grns].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  for (const g of ordered) {
    const counted = inRange(g.date, from, to);
    const ref = `GRR ${docNoLabel(g.grnNo, g.registered)}`;
    const href = `/procurement/grn/${g.id}`;
    const items = parseItems<GrnItem>(g.items).filter(it => String(it.item ?? "").trim() || String(it.quantity ?? "").trim());
    if (!items.length) continue;
    const skip = (reason: string, description: string) => {
      if (counted) skipped.push({ source: "procurement", reason, date: g.date, ref, description, href });
    };

    const ins = withValueCategories(parseInspection(g.inspection));
    if (ins.result === "rejected") { for (const it of items) skip(SKIP.grrRejected, it.item || ""); continue; }

    const po = (g.poId != null ? byId.get(g.poId) : undefined)
      ?? (g.poId == null && g.poNo != null ? byNo.get(`${g.poNo}|${g.registered}`) ?? undefined : undefined);
    if (!po) { for (const it of items) skip(SKIP.grrNoPo, it.item || ""); continue; }

    const poItems = parseItems<PoItem>(po.items);
    // The discount is on the whole PO; each received line bears its share of it.
    const poNet = poItems.reduce((s, it) => s + lineMoney(qtyToNum(it.quantity) ?? 0, it).net, 0);
    const discount = Number(po.discount) || 0;
    const factor = poNet > 0 ? Math.max(0, poNet - discount) / poNet : 1;
    const bySr = new Map(poItems.map(p => [p.srNo, p]));
    const byDesc = new Map<string, PoItem>();
    for (const p of poItems) {
      const d = normDesc(p.description || p.item || "");
      if (d && !byDesc.has(d)) byDesc.set(d, p);
    }

    const labels = ins.categories.map(id => checklistCategory(checklist, id)?.label ?? id);
    const cats = labels.length ? labels : [UNCATEGORISED];

    for (const it of items) {
      const description = it.item || "";
      const pl = (it.poSrNo != null ? bySr.get(it.poSrNo) : undefined) ?? byDesc.get(normDesc(description));
      if (!pl) { skip(SKIP.grrNotOnPo, description); continue; }
      const qty = qtyToNum(it.quantity);
      if (qty == null) { skip(SKIP.grrBadQty, description); continue; }
      const orderedQty = qtyToNum(pl.quantity);
      const key = `${po.id}|${pl.srNo}`;
      const before = receivedSoFar.get(key) ?? 0;
      receivedSoFar.set(key, before + qty);
      // Without a number for the ordered quantity there is nothing to hold it to.
      const valued = orderedQty == null || orderedQty <= 0 ? qty : Math.max(0, Math.min(qty, orderedQty - before));
      if (!counted) continue;
      const m = lineMoney(valued, pl);
      if (!(m.rate > 0)) { skip(SKIP.grrNoRate, description); continue; }
      if (valued <= 0) { skip(SKIP.grrPastPo, description); continue; }
      const amount = m.net * factor;
      const n = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 3 });
      const calc = `${n(valued)} × ${n(m.rate)}${m.taxPct ? ` + ${n(m.taxPct)}%` : ""}${factor < 1 ? " − discount share" : ""}`
        + (valued < qty ? ` (GRR says ${n(qty)}; PO ordered ${n(orderedQty!)}${before > 0 ? `, ${n(Math.min(before, orderedQty!))} received before` : ""})` : "")
        + (cats.length > 1 ? ` ÷ ${cats.length} categories` : "");
      for (const category of cats) {
        lines.push({ source: "procurement", date: g.date, category, amount: amount / cats.length, calc, po: `PO ${docNoLabel(po.poNo, po.registered)}`, poDate: po.date ? String(po.date).slice(0, 10) : "", ref, description: description || pl.description || pl.item || "", href });
      }
    }
  }
}

export interface CategoryTotal { category: string; purchase: number; procurement: number; total: number; lines: ExpenseLine[] }
export interface ExpenseSummary {
  from: string; to: string;
  purchase: number; procurement: number; total: number;
  // The part of procurement received against POs dated before the period. The Supplier Directory counts a PO
  // by its own date, so this is what it shows in an earlier month while it arrives in this one.
  procurementEarlierPos: number;
  categories: CategoryTotal[];   // highest total first
  skipped: SkippedLine[];
}

export function summarizeExpenses(
  input: { prs: PrInput[]; grns: GrnInput[]; pos: PoInput[]; checklist: GrrChecklist },
  from: string, to: string,
): ExpenseSummary {
  const lines: ExpenseLine[] = [];
  const skipped: SkippedLine[] = [];
  purchaseExpenses(input.prs, from, to, lines, skipped);
  procurementExpenses(input.grns, input.pos, input.checklist, from, to, lines, skipped);
  const map = new Map<string, CategoryTotal>();
  let purchase = 0, procurement = 0, procurementEarlierPos = 0;
  for (const l of lines) {
    // Same name typed with different case or spacing is one category.
    const key = l.category.trim().replace(/\s+/g, " ").toLowerCase();
    let c = map.get(key);
    if (!c) { c = { category: l.category.trim().replace(/\s+/g, " "), purchase: 0, procurement: 0, total: 0, lines: [] }; map.set(key, c); }
    c[l.source] += l.amount;
    c.total += l.amount;
    c.lines.push(l);
    if (l.source === "purchase") purchase += l.amount;
    else { procurement += l.amount; if (l.poDate && l.poDate < from) procurementEarlierPos += l.amount; }
  }
  const categories = [...map.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  for (const c of categories) c.lines.sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date));
  return { from, to, purchase, procurement, procurementEarlierPos, total: purchase + procurement, categories, skipped };
}
