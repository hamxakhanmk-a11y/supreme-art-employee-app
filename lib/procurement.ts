// Shared helpers for the Procurement module (Demand → PO → GRN).
// Line items live as JSON in each form's `items` column.
import { sql, eq, ilike, max } from "drizzle-orm";
import { db } from "./db";
import { grns, purchaseOrders, suppliers } from "./schema";

export type Stage = "demand" | "po" | "grn" | "inspection";

// Fixed observation rows on the incoming-material inspection form (QC/QR/004).
export const INSPECTION_PARAMS = [
  "Purity",
  "Physical appearance",
  "Solubility",
  "Cleanliness",
  "Expiry",
  "Packing",
  "According to Order placed",
] as const;

export interface InspectionRow { parameter: string; standard: string; samples: string[] }

export function blankInspectionRows(): InspectionRow[] {
  return INSPECTION_PARAMS.map(p => ({ parameter: p, standard: "", samples: ["", "", "", ""] }));
}

export interface DemandItem { srNo: number; material: string; requiredFor: string; quantity: string; remarks: string }
// PO line item. Gross / tax value / net are derived (never stored) from
// quantity × rate and the tax %. `item`/`specifications` are legacy fields kept
// optional so purchase orders saved before this change still render.
export interface PoItem {
  srNo: number;
  description: string;
  quantity: string;
  uom: string;
  rate: string;
  tax: string;              // percent, e.g. "18"
  item?: string;            // legacy — old POs stored the name here
  specifications?: string;  // legacy
}
// A received-goods line. `remarks` is a per-line note (condition, shortfall
// reason…). `poSrNo` links the line back to the PO line it fulfils so partial
// receipts add up correctly across multiple GRNs — both optional so GRNs saved
// before this change (and standalone GRNs) still parse.
// `invoiceQty` is what the supplier's invoice says, written in at inspection;
// against the received `quantity` it gives the difference the inspection shows.
export interface GrnItem { srNo: number; item: string; quantity: string; remarks?: string; poSrNo?: number; invoiceQty?: string }

// The incoming-material inspection, kept on the GRR itself (grns.inspection,
// JSON) — the paper inspection report the store fills when goods arrive. Its
// date stays empty until the inspector writes it in.
export type InspectionResult = "" | "accepted" | "partial" | "rejected";

// The inspection points, from the Incoming Material Inspection Checklist. The
// general ones apply to every item; the rest belong to a category of material,
// picked on the GRR. The list is kept in procurement_settings and edited under
// GRR → Settings; what follows is what it starts as. A point's key ("<group>.<n>")
// is what `checks` records a tick against, so rewording a point keeps its ticks.
export interface InspectionPoint { key: string; text: string }
export interface InspectionCategory { id: string; label: string; points: InspectionPoint[] }
export interface GrrChecklist { general: InspectionPoint[]; categories: InspectionCategory[] }
// The board's grammage is only asked for on a GRR whose category is this one.
export const BOARD_CATEGORY_ID = "board";
// UV varnish and water base coating are one category; its viscosity reading is asked for the same way.
export const COATING_CATEGORY_ID = "coating";
const pts = (group: string, texts: string[]): InspectionPoint[] => texts.map((text, i) => ({ key: `${group}.${i + 1}`, text }));
const DEFAULT_GENERAL: InspectionPoint[] = pts("g", [
  "Supplier, challan and invoice match the PO",
  "Item name, brand, type and specification match the PO",
  "Quantity matches the invoice (note any difference)",
  "Packing and container intact: sealed, no damage, leakage, dents, rust or wet",
]);
const DEFAULT_CATEGORIES: InspectionCategory[] = [
  { id: BOARD_CATEGORY_ID, label: "Board", points: pts(BOARD_CATEGORY_ID, [
    "Board type and size match the PO",
    "Surface clean and flat: no scratches, stains, spots or warping",
    "Shade and finish match the approved sample",
  ]) },
  { id: "die", label: "Cutting Die", points: pts("die", [
    "Matches the approved drawing or artwork (size, layout, design)",
    "Blades and rules sharp, straight, no rust",
    "Cutting and creasing rule positions correct",
  ]) },
  { id: "emboss", label: "Embossing Die (male and female)", points: pts("emboss", [
    "Design matches the approved artwork",
    "Depth and edge sharpness match the specification",
    "Male and female fit together properly",
  ]) },
  { id: "foil", label: "Hot Stamping Foil", points: pts("foil", [
    "Shade matches the approved sample",
    "Roll width, length and core size fit the machine",
    "No scratches, pinholes or uneven coating",
  ]) },
  { id: "ink", label: "Inks", points: pts("ink", [
    "Ink type (offset, UV) and shade are correct",
    "Colour matches the approved sample (drawdown test)",
  ]) },
  { id: COATING_CATEGORY_ID, label: "UV Varnish / Water Base Coating", points: pts(COATING_CATEGORY_ID, [
    "Clear and smooth: no gel, lumps or settled particles",
    "Trial coating on board gives good gloss and rub resistance",
  ]) },
  { id: "fount", label: "Fount Solution", points: pts("fount", [
    "Concentration and pH correct",
    "No contamination",
  ]) },
  { id: "uvcleaner", label: "UV Cleaner", points: pts("uvcleaner", [
    "Suitable for UV use",
    "No unusual smell, no contamination",
  ]) },
  { id: "blanco", label: "Blanco (Blanket Wash)", points: pts("blanco", [
    "Correct type for the machine and ink (UV or conventional)",
    "No unusual smell, no contamination",
  ]) },
  { id: "plate", label: "CTCP / CTP Plates", points: pts("plate", [
    "Type (CTCP or CTP), thickness and size fit the machine",
    "No scratches, dents, fingerprints or oxidation",
  ]) },
  { id: "developer", label: "Developer", points: pts("developer", [
    "Compatible with the plate type",
    "Clear, no crystals or sediment",
  ]) },
  { id: "platecleaner", label: "Plate Cleaner", points: pts("platecleaner", [
    "Suitable for the plate type",
    "Clear, no contamination",
  ]) },
  { id: "blanket", label: "Rubber Blanket", points: pts("blanket", [
    "Size, thickness and type (conventional or UV) match the machine",
    "Surface smooth: no cuts, bubbles, dents or uneven thickness",
  ]) },
  { id: "glue", label: "Glue", points: pts("glue", [
    "Type matches the use (pasting, lamination, pocket or window gluing)",
    "Consistency, colour and smell normal: no lumps, skin or separation",
  ]) },
];
export const DEFAULT_CHECKLIST: GrrChecklist = { general: DEFAULT_GENERAL, categories: DEFAULT_CATEGORIES };

/** Grammage belongs to board; a GRR that already has one written keeps showing it. */
export const showsGrammage = (ins: { categories: string[]; grammage: string }) => ins.categories.includes(BOARD_CATEGORY_ID) || !!ins.grammage.trim();

/** The viscosity reading belongs to the coating category; a GRR that already has one keeps showing it. */
export const showsViscosity = (ins: { categories: string[]; viscosity: string }) => ins.categories.includes(COATING_CATEGORY_ID) || !!ins.viscosity.trim();

/** The names of the categories a GRR is checked against, in the order given. */
export const checklistLabels = (cl: GrrChecklist, ids: string[]) =>
  ids.map(id => checklistCategory(cl, id)?.label).filter(Boolean).join(", ");

export const checklistCategory = (cl: GrrChecklist, id: string) => cl.categories.find(c => c.id === id) ?? null;

// Whatever was stored or sent, made into a well-formed checklist: trimmed text,
// no empty points or nameless categories, unique keys and ids. A point without a
// key (a new one) gets the next free number in its group; a new category an id
// made from its name.
export function cleanChecklist(v: unknown): GrrChecklist {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const text = (x: unknown, max: number) => String(x ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  const cleanPoints = (raw: unknown, group: string): InspectionPoint[] => {
    const list = (Array.isArray(raw) ? raw : []).slice(0, 40).map(p => {
      const q = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const key = String(q.key ?? "");
      return { key: key.startsWith(group + ".") && /^[a-z0-9]+\.\d{1,4}$/.test(key) ? key : "", text: text(q.text, 200) };
    }).filter(p => p.text);
    const used = new Set<string>();
    let next = 1 + Math.max(0, ...list.map(p => (p.key ? parseInt(p.key.split(".")[1], 10) : 0)));
    return list.map(p => {
      let key = p.key;
      if (!key || used.has(key)) key = `${group}.${next++}`;
      used.add(key);
      return { key, text: p.text };
    });
  };
  const ids = new Set<string>();
  const categories: InspectionCategory[] = [];
  for (const c of (Array.isArray(o.categories) ? o.categories : []).slice(0, 60)) {
    const q = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const label = text(q.label, 80);
    if (!label) continue;
    let id = /^[a-z0-9]{1,24}$/.test(String(q.id ?? "")) ? String(q.id) : "";
    if (!id || ids.has(id) || id === "g") {
      const base = label.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "cat";
      id = base; let n = 2;
      while (ids.has(id) || id === "g") id = `${base}${n++}`;
    }
    ids.add(id);
    categories.push({ id, label, points: cleanPoints(q.points, id) });
  }
  return { general: cleanPoints(o.general, "g"), categories };
}

// The checklist as set under GRR → Settings (the default until someone saves one).
export async function loadChecklist(): Promise<GrrChecklist> {
  await ensureProcurementTables();
  const res = await db.execute(sql`SELECT value FROM procurement_settings WHERE key = 'grr_checklist'`);
  const raw = (res.rows[0] as { value?: string } | undefined)?.value;
  if (!raw) return DEFAULT_CHECKLIST;
  try { return cleanChecklist(JSON.parse(raw)); } catch { return DEFAULT_CHECKLIST; }
}

export interface GrnInspection {
  date: string;
  categories: string[];       // ids of the checklist's categories this GRR is checked against (none, one or several)
  checks: Record<string, "ok" | "no">;   // per point key; absent = not checked yet
  grammage: string;           // board grammage, as written
  viscosity: string;          // viscosity of a coating, as measured and written
  result: InspectionResult;
  remarks: string;
  checkedBy: string;
}
export const INSPECTION_RESULTS: Record<Exclude<InspectionResult, "">, { label: string; color: string; bg: string; choice: string }> = {
  accepted: { choice: "Accepted",        label: "GOOD RECEIVED – ACCEPTED",        color: "#14532D", bg: "#dcfce7" },
  partial:  { choice: "Partly accepted", label: "GOOD RECEIVED – PARTLY ACCEPTED", color: "#92400E", bg: "#fef3c7" },
  rejected: { choice: "Rejected",        label: "GOOD RECEIVED – REJECTED",        color: "#991B1B", bg: "#fee2e2" },
};
const blankInspection = (): GrnInspection => ({
  date: "", categories: [], checks: {},
  grammage: "", viscosity: "", result: "", remarks: "", checkedBy: "",
});
// Only the known fields, each the right kind — whatever was stored or sent.
export function cleanInspection(v: unknown): GrnInspection {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const text = (x: unknown, max: number) => String(x ?? "").trim().slice(0, max);
  const date = text(o.date, 10);
  const result = String(o.result ?? "");
  // Several categories can apply to one GRR; `category` is how the first version saved the one it had.
  const idOk = (x: unknown) => /^[a-z0-9]{1,24}$/.test(String(x ?? ""));
  const categories = [...new Set([...(Array.isArray(o.categories) ? o.categories : []), o.category].filter(idOk).map(String))].slice(0, 20);
  // Each point's ok / no, by key. Which points exist is the checklist's say.
  const given = (o.checks && typeof o.checks === "object" ? o.checks : {}) as Record<string, unknown>;
  const checks: Record<string, "ok" | "no"> = {};
  for (const [k, v] of Object.entries(given).slice(0, 300)) {
    if (/^[a-z0-9]+\.\d{1,4}$/.test(k) && (v === "ok" || v === "no")) checks[k] = v;
  }
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    categories,
    checks,
    grammage: text(o.grammage, 60),
    viscosity: text(o.viscosity, 60),
    result: result in INSPECTION_RESULTS ? (result as InspectionResult) : "",
    remarks: text(o.remarks, 500),
    checkedBy: text(o.checkedBy, 120),
  };
}
export function parseInspection(raw: string | null | undefined): GrnInspection {
  if (!raw) return blankInspection();
  try { return cleanInspection(JSON.parse(raw)); } catch { return blankInspection(); }
}
// Received − invoiced: negative is a shortfall. Null unless both are numbers.
export function qtyDifference(invoiceQty: string | undefined, received: string | undefined): number | null {
  const a = String(invoiceQty ?? "").trim(), b = String(received ?? "").trim();
  if (!a || !b) return null;
  const inv = Number(a), rec = Number(b);
  return Number.isFinite(inv) && Number.isFinite(rec) ? Math.round((rec - inv) * 1000) / 1000 : null;
}

// Default sales-tax percentage seeded on every new PO line.
export const PO_DEFAULT_TAX = 18;

// Derived money for one PO line: gross = qty × rate, tax value = gross × tax%,
// net = gross + tax value. Tolerant of blanks (treated as 0).
export function poLineMoney(it: { quantity?: string; rate?: string; tax?: string }) {
  const qty = parseFloat(it.quantity ?? "") || 0;
  const rate = parseFloat(it.rate ?? "") || 0;
  const taxPct = parseFloat(it.tax ?? "") || 0;
  const gross = qty * rate;
  const taxValue = gross * taxPct / 100;
  const net = gross + taxValue;
  return { qty, rate, taxPct, gross, taxValue, net };
}

// Money formatter for the printed PO — thousands separators, 2 decimals, blank
// for zero so empty lines don't read "0.00".
export function fmtMoney(n: number, blankZero = true): string {
  if (blankZero && !n) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============ Unregistered-supplier yearly limit ============
// Purchases from an UNREGISTERED supplier (no sales-tax invoice) are capped at
// this amount per supplier, per financial year.
export const UNREGISTERED_YEAR_LIMIT = 75000;

// A PO's grand total = sum of line net values, less any discount.
export function poGrandTotal(items: PoItem[], discount: number | null | undefined = 0): number {
  const net = items.reduce((s, it) => s + poLineMoney(it).net, 0);
  return Math.max(0, net - (Number(discount) || 0));
}

// The financial year (1 Jul – 30 Jun) that contains date `d`. Dates are the
// "YYYY-MM-DD" strings the DB stores, so string comparison is safe.
export function financialYear(d: Date = new Date()): { start: string; end: string; label: string } {
  const y = d.getFullYear();
  const startY = d.getMonth() >= 6 ? y : y - 1; // Jul(=6)…Dec → this year; Jan…Jun → last year
  return { start: `${startY}-07-01`, end: `${startY + 1}-06-30`, label: `${startY}–${startY + 1}` };
}

// Normalise a supplier name for matching (POs store the name, not an id).
export function normSupplier(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Mirror a PO's registered/unregistered mark onto the saved supplier directory
// so the supplier lands in the right list. No-op for blank names / unmarked.
export async function tagSupplierRegistered(name: string | null | undefined, registered: boolean | null | undefined) {
  const n = (name || "").trim();
  if (!n || registered == null) return;
  await db.update(suppliers).set({ registered }).where(ilike(suppliers.name, n));
}

// When a PO is saved, push its supplier details (registered flag, NTN, STRN,
// address, contact) onto the matching directory row, so the next PO for that
// supplier auto-fills them. Only non-empty fields are written — a blank on one
// PO never wipes a value the directory already has.
export async function syncSupplierFromPo(
  name: string | null | undefined,
  d: {
    registered?: boolean | null; ntn?: string | null; strn?: string | null; address?: string | null;
    phone?: string | null; brand?: string | null; concernedPerson?: string | null;
  },
) {
  const n = (name || "").trim();
  if (!n) return;
  const set: Record<string, unknown> = {};
  if (d.registered != null) set.registered = d.registered;
  if (d.ntn && String(d.ntn).trim()) set.ntn = String(d.ntn).trim();
  if (d.strn && String(d.strn).trim()) set.strn = String(d.strn).trim();
  if (d.address && String(d.address).trim()) set.address = String(d.address).trim();
  if (d.phone && String(d.phone).trim()) set.contact = String(d.phone).trim();
  if (d.brand && String(d.brand).trim()) set.brand = String(d.brand).trim();
  if (d.concernedPerson && String(d.concernedPerson).trim()) set.concernedPerson = String(d.concernedPerson).trim();
  if (Object.keys(set).length === 0) return;
  await db.update(suppliers).set(set).where(ilike(suppliers.name, n));
}

// ============ Partial-receipt tracking (PO ↔ GRN) ============
// A PO's goods can arrive across several GRNs — one product now, another later,
// or half a quantity at a time. We reconcile every GRN line against its PO line
// to know what's still outstanding and whether the PO is fully received.

// Pull the leading number out of a quantity string ("5", "10.5", "20 kg",
// "1,200"). Returns null when there's no number to parse.
export function qtyToNum(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isNaN(n) ? null : n;
}

const normDesc = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface PoLineReceipt {
  srNo: number;
  description: string;
  uom: string;
  orderedRaw: string;        // original ordered qty text
  ordered: number | null;    // parsed ordered qty (null when not a number)
  received: number;          // total received across all GRNs
  hasReceipt: boolean;       // any GRN line matched this PO line
  remaining: number | null;  // ordered − received (null when ordered isn't a number)
  fulfilled: boolean;        // line considered fully received
}

// Reconcile PO lines against every GRN line raised for that PO.
export function computePoReceipts(poItems: PoItem[], grnItems: GrnItem[]): PoLineReceipt[] {
  const recBySr = new Map<number, number>();
  const hitBySr = new Map<number, boolean>();
  // Fallback matcher for legacy GRN lines that predate poSrNo: match by name.
  const srByDesc = new Map<string, number>();
  for (const p of poItems) {
    const d = normDesc(p.description || p.item || "");
    if (d && !srByDesc.has(d)) srByDesc.set(d, p.srNo);
  }
  for (const g of grnItems) {
    let sr = g.poSrNo;
    if (sr == null) sr = srByDesc.get(normDesc(g.item || ""));
    if (sr == null) continue; // standalone / unmatched receipt line
    hitBySr.set(sr, true);
    const n = qtyToNum(g.quantity);
    if (n != null) recBySr.set(sr, (recBySr.get(sr) || 0) + n);
  }
  return poItems.map(p => {
    const ordered = qtyToNum(p.quantity);
    const received = round3(recBySr.get(p.srNo) || 0);
    const hasReceipt = hitBySr.get(p.srNo) || false;
    const remaining = ordered == null ? null : Math.max(0, round3(ordered - received));
    const fulfilled = ordered == null ? hasReceipt : received >= ordered - 1e-9;
    return {
      srNo: p.srNo, description: p.description || p.item || "", uom: p.uom || "",
      orderedRaw: p.quantity || "", ordered, received, hasReceipt, remaining, fulfilled,
    };
  });
}

// Roll the per-line receipts up into a PO status.
export function poStatusFrom(receipts: PoLineReceipt[]): "open" | "partial" | "received" {
  if (!receipts.length) return "open";
  const anyReceipt = receipts.some(r => r.hasReceipt || r.received > 0);
  if (!anyReceipt) return "open";
  return receipts.every(r => r.fulfilled) ? "received" : "partial";
}

// Recompute and persist a PO's status from all GRNs currently pointing at it.
// Called after any GRN create / edit / delete. Leaves a manually "closed" PO
// alone.
export async function recomputePoStatus(poId: number | null | undefined) {
  if (!poId) return;
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po || po.status === "closed") return;
  const gs = await db.select({ items: grns.items }).from(grns).where(eq(grns.poId, poId));
  const poItems = parseItems<PoItem>(po.items);
  const grnItems = gs.flatMap(g => parseItems<GrnItem>(g.items));
  const status = poStatusFrom(computePoReceipts(poItems, grnItems));
  if (status !== po.status) {
    await db.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, poId));
  }
}

// Our organisation's details, printed in the header of every form.
export const COMPANY = {
  name: "SUPREME ART (PVT) Limited.",
  address: "Plot 148-B Industrial Estate Hayatabad, Peshawar.",
  ntn: "7226736-6",
  strn: "3277 8761 32353",
  email: "supremepesh@gmail.com",
  phone: "0092915602036",
} as const;

// Departments that can raise a demand. The chosen one also names the demand's
// first printed copy, so it goes to the department that asked for the material.
export const DEPARTMENTS = [
  "Accounts & Finance",
  "Production & Design",
  "Sales & Marketing",
  "HR & Admin",
  "Procurement",
  "Repair & Maintenance",
  "Warehouse / Inventory Mgt / Import & Export",
] as const;

// Each stage's running number starts at its own block, so a number identifies
// the document type at a glance. Numbering never goes backwards: if a stage
// already has higher numbers, it simply continues from there.
export const NUMBER_START: Record<Stage, number> = {
  demand: 5000,
  po: 10000,
  grn: 15000,
  inspection: 20000,
};

export function nextNumber(currentMax: number | null | undefined, start: number): number {
  return Math.max(Number(currentMax ?? 0), start - 1) + 1;
}

// Registered and unregistered documents run as two independent sequences. Both
// start at the same block (PO 10000, GRR 15000); the unregistered sequence is
// distinguished on paper by a "u" suffix (10000u, 15000u…) via docNoLabel().
// The next number is scoped to the matching tax status, so the two lists never
// share numbers and each stays gapless within itself.
export async function nextPoNo(registered: boolean): Promise<number> {
  const [{ n }] = await db.select({ n: max(purchaseOrders.poNo) }).from(purchaseOrders)
    .where(eq(purchaseOrders.registered, registered));
  return nextNumber(n, NUMBER_START.po);
}
export async function nextGrnNo(registered: boolean): Promise<number> {
  const [{ n }] = await db.select({ n: max(grns.grnNo) }).from(grns)
    .where(eq(grns.registered, registered));
  return nextNumber(n, NUMBER_START.grn);
}

// Display number for a PO / GRR: unregistered documents (registered === false)
// carry a "u" suffix so 10000 (registered) and 10000u (unregistered) are told
// apart at a glance. Registered and unmarked print the bare number.
export function docNoLabel(no: number | null | undefined, registered: boolean | null | undefined): string {
  if (no == null) return "";
  return `${no}${registered === false ? "u" : ""}`;
}

// Each form prints one page per copy, named at the foot of the page.
export const FORM_COPIES: Record<Stage, string[]> = {
  demand: ["Finance Copy", "Procurement Copy"],
  po: ["Procurement Copy", "Supplier Copy", "Finance Copy"],
  grn: ["Finance Copy", "Store Copy"],
  inspection: [],
};

// Document-control block printed at the top of each form.
export const FORM_META = {
  demand: { code: "PUR/QR/005", title: "MATERIAL DEMAND FORM", issue: "01", issueDate: "21-07-2026" },
  po:     { code: "PUR/QR/006", title: "PURCHASE ORDER", issue: "01", issueDate: "21-07-2026" },
  grn:    { code: "PUR/QR/007", title: "GOODS RECEIPTS REPORT (Store)", issue: "01", issueDate: "21-07-2026" },
  inspection: { code: "QC/QR/004", title: "INCOMING MATERIAL INSPECTION FORM", issue: "01", issueDate: "09-07-2026" },
} as const;

export const PO_DEFAULT_REMARKS =
  "Send us this order as soon as possible. Your quick response will be highly appreciated.";

// Standard PO terms — seeded into every new PO's terms textarea (still editable
// per PO). Sourced from "purchase order terms and condition.docx".
export const PO_DEFAULT_TERMS: string[] = [
  "All goods and services supplied must conform to the Buyer's specifications, approved samples, dimensions, tolerances, quality standards, and applicable regulatory requirements. Any variation in size, dimensions, thickness, GSM, shade, finish, or other specifications must be approved in writing by the Buyer. (Where applicable)",
  "Quantity variance shall not exceed ±10% of the ordered quantity unless otherwise stated in the PO or approved in writing by the Buyer.",
  "Delivery shall be made as specified in the PO. Time is of the essence. The Buyer reserves the right to reject, cancel, or claim losses arising from delayed deliveries.",
  "Goods must be supplied in properly sealed, secure, and suitable packaging to prevent damage, contamination, moisture absorption, humidity effects, water ingress, leakage, deterioration, or loss during transportation.",
  "Prices stated in the PO are firm unless otherwise agreed in writing; no additional charges shall be accepted without prior written approval from the Buyer.",
  "Payment shall be subject to receipt of acceptable goods, services, and complete supporting documentation.",
  "The Supplier shall provide a valid Real time sales tax invoice and all required supporting documents. For imported goods, where applicable, the Supplier shall provide Commercial Invoice, Packing List, Certificate of Origin, Bill of Lading/Air Waybill, compliance certificates, GD (Goods Declaration), COA & TDS and any other documents required for customs clearance.",
  "If the Supplier is exempt from any applicable tax, a valid exemption certificate or supporting legal documentation must be provided with the invoice; otherwise, applicable taxes may be deducted or withheld as required by law.",
  "Risk of loss shall remain with the Supplier until delivery, inspection, and acceptance by the Buyer.",
  "The Supplier shall comply with all applicable laws, tax regulations, import/export requirements and environmental standards.",
  "The Buyer reserves the right to reject goods, recover losses, cancel the PO, or terminate the agreement for non-compliance with these terms, quality failures, delivery delays, or breach of contractual obligations.",
];

export function parseItems<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : d;
}

// Idempotently create the three tables — lets production self-migrate on first
// use, since the prod DB URL isn't available locally.
let ensured = false;
export async function ensureProcurementTables() {
  if (ensured) return;
  // All of this runs in ONE round-trip. Issued as separate statements it cost
  // ~5s per request against Neon, which showed up as laggy buttons — every
  // procurement page and API call waits on it.
  await db.execute(sql`
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS demands (
    id serial PRIMARY KEY,
    demand_no integer NOT NULL,
    date date NOT NULL,
    required_by date,
    demand_by varchar(160),
    department varchar(120),
    prepared_by varchar(120),
    approved_by varchar(120),
    section_incharge varchar(120),
    items text NOT NULL DEFAULT '[]',
    status varchar(20) NOT NULL DEFAULT 'open',
    created_by_user_id integer,
    created_by_name varchar(120),
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id serial PRIMARY KEY,
    po_no integer NOT NULL,
    demand_id integer,
    demand_no integer,
    date date NOT NULL,
    demand_by_name varchar(160),
    supplier_name varchar(200),
    expected_date date,
    order_placed_by varchar(120),
    approved_by varchar(120),
    remarks text,
    items text NOT NULL DEFAULT '[]',
    status varchar(20) NOT NULL DEFAULT 'open',
    created_by_user_id integer,
    created_by_name varchar(120),
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS grns (
    id serial PRIMARY KEY,
    grn_no integer NOT NULL,
    po_id integer,
    po_no integer,
    date date NOT NULL,
    received_by varchar(120),
    verified_by varchar(120),
    items text NOT NULL DEFAULT '[]',
    created_by_user_id integer,
    created_by_name varchar(120),
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS inspections (
    id serial PRIMARY KEY,
    insp_no integer NOT NULL,
    po_id integer,
    po_no integer,
    date date NOT NULL,
    material_type varchar(160),
    supplier_name varchar(200),
    results text NOT NULL DEFAULT '[]',
    inspected_by varchar(120),
    created_by_user_id integer,
    created_by_name varchar(120),
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS suppliers (
    id serial PRIMARY KEY,
    name varchar(200) NOT NULL,
    address text,
    contact varchar(160),
    created_at timestamp NOT NULL DEFAULT now()
  );
  -- Reference rates noted by hand in the Supplier Directory, per product +
  -- supplier. Deliberately separate from the POs: the directory shows the
  -- rate off the latest PO until someone notes one here, and what's noted
  -- here never flows back into any purchase order.
  CREATE TABLE IF NOT EXISTS supplier_product_rates (
    id serial PRIMARY KEY,
    product text NOT NULL,
    supplier text NOT NULL,
    rate double precision,
    tax_pct double precision,
    updated_by varchar(120),
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS supplier_product_rates_key
    ON supplier_product_rates (product, supplier);
  -- Settings for the procurement screens, one row per key. grr_checklist: the
  -- inspection points on a GRR (general ones and per category), set under GRR → Settings.
  CREATE TABLE IF NOT EXISTS procurement_settings (
    key varchar(60) PRIMARY KEY,
    value text NOT NULL
  );
  -- Columns added after their tables already existed.
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_address text;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_contact varchar(160);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_phone varchar(60);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS specification text;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms text;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount double precision DEFAULT 0;
  ALTER TABLE grns ADD COLUMN IF NOT EXISTS gate_pass_no varchar(60);
  ALTER TABLE grns ADD COLUMN IF NOT EXISTS inv_no varchar(60);
  ALTER TABLE grns ADD COLUMN IF NOT EXISTS dc_no varchar(60);
  ALTER TABLE grns ADD COLUMN IF NOT EXISTS inspection text;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS registered boolean;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_ntn varchar(40);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_strn varchar(40);
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS registered boolean;
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ntn varchar(40);
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS strn varchar(40);
  ALTER TABLE grns ADD COLUMN IF NOT EXISTS registered boolean;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_brand varchar(160);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_concerned_person varchar(160);
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS brand varchar(160);
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS concerned_person varchar(160);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rate double precision;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rate_uom varchar(20);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rate_tax_pct double precision;

  -- One-time data migrations, keyed so each runs exactly once.
  CREATE TABLE IF NOT EXISTS procurement_migrations (
    key text PRIMARY KEY,
    applied_at timestamp NOT NULL DEFAULT now()
  );

  -- Each GRR inherits its PO's tax status (standalone GRRs stay unmarked).
  UPDATE grns g SET registered = p.registered
    FROM purchase_orders p
    WHERE g.po_id = p.id AND g.registered IS NULL AND p.registered IS NOT NULL;

  -- Split registered / unregistered into their own sequences. Registered POs
  -- keep the existing 10000 series; unregistered POs (and their GRRs) are
  -- renumbered into a fresh 10000 / 15000 series of their own, ordered by date.
  -- Registered and unregistered may now share an integer — the "u" suffix on
  -- unregistered documents keeps them distinct on paper.
  IF NOT EXISTS (SELECT 1 FROM procurement_migrations WHERE key = 'split_unreg_sequence_v1') THEN
    WITH ordered AS (
      SELECT id, 10000 + (row_number() OVER (ORDER BY date ASC, id ASC) - 1)::int AS newno
      FROM purchase_orders WHERE registered = false
    )
    UPDATE purchase_orders p SET po_no = o.newno FROM ordered o WHERE p.id = o.id;

    -- Keep each GRR's denormalised po_no pointing at its PO's new number.
    UPDATE grns g SET po_no = p.po_no
      FROM purchase_orders p WHERE g.po_id = p.id AND p.registered = false;

    WITH gordered AS (
      SELECT id, 15000 + (row_number() OVER (ORDER BY date ASC, id ASC) - 1)::int AS newno
      FROM grns WHERE registered = false
    )
    UPDATE grns g SET grn_no = o.newno FROM gordered o WHERE g.id = o.id;

    INSERT INTO procurement_migrations(key) VALUES ('split_unreg_sequence_v1');
  END IF;

  -- The registered/unregistered removal cleared every tax flag; that change has
  -- now been reverted. The unregistered POs/GRRs were deleted, so everything
  -- that remains is the registered set — re-mark it registered=true. This also
  -- restores correct two-sequence numbering (new registered docs continue from
  -- the current max; unregistered starts a fresh 10000u/15000u series).
  IF NOT EXISTS (SELECT 1 FROM procurement_migrations WHERE key = 'restore_registered_flag_v1') THEN
    UPDATE purchase_orders SET registered = true WHERE registered IS NULL;
    UPDATE grns SET registered = true WHERE registered IS NULL;
    INSERT INTO procurement_migrations(key) VALUES ('restore_registered_flag_v1');
  END IF;
END $$;`);
  ensured = true;
}
