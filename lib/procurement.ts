// Shared helpers for the Procurement module (Demand → PO → GRN).
// Line items live as JSON in each form's `items` column.
import { sql, eq, ilike } from "drizzle-orm";
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
export interface GrnItem { srNo: number; item: string; quantity: string; remarks?: string; poSrNo?: number }

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

// Each form prints one page per copy, named at the foot of the page.
export const FORM_COPIES: Record<Stage, string[]> = {
  demand: ["Store Copy", "Procurement Copy"],
  po: ["Procurement Copy", "Supplier Copy", "Finance Copy"],
  grn: ["Finance Copy", "Store Copy"],
  inspection: [],
};

// Document-control block printed at the top of each form.
export const FORM_META = {
  demand: { code: "PUR/QR/005", title: "MATERIAL DEMAND FORM", issue: "01", issueDate: "21-07-2026" },
  po:     { code: "PUR/QR/006", title: "PURCHASE ORDER", issue: "01", issueDate: "21-07-2026" },
  grn:    { code: "PUR/QR/006", title: "GOODS RECEIPTS REPORT (Store)", issue: "01", issueDate: "21-07-2026" },
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
  -- Columns added after their tables already existed.
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_address text;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_contact varchar(160);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_phone varchar(60);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS specification text;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms text;
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount double precision DEFAULT 0;
  ALTER TABLE grns ADD COLUMN IF NOT EXISTS gate_pass_no varchar(60);
  ALTER TABLE grns ADD COLUMN IF NOT EXISTS inv_no varchar(60);
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS registered boolean;
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS registered boolean;
END $$;`);
  ensured = true;
}
