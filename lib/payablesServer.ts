// Accounts Payable — the database side (server only). The rules are in lib/payables.ts.
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { grns, purchaseOrders, apInvoices, apPayments, apAllocations } from "./schema";
import { ensureProcurementTables, loadChecklist, parseItems, parseInspection, docNoLabel, type GrnItem } from "./procurement";
import { procurementExpenses, type ExpenseLine, type SkippedLine } from "./expenses";
import { karachiNow } from "./gateTime";
import { stageOf, type ApCase, type ApInvoice, type ApPaymentRef } from "./payables";

let ensured = false;
export async function ensureApTables() {
  if (ensured) return;
  await ensureProcurementTables();
  // One round-trip, like the procurement tables (each separate statement costs a trip to Neon).
  await db.execute(sql`
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS ap_invoices (
    id serial PRIMARY KEY,
    grn_id integer NOT NULL UNIQUE,
    supplier varchar(200),
    invoice_date date,
    invoice_amount double precision,
    payable_amount double precision,
    credit_days integer,
    due_date date,
    note text,
    hold_reason text,
    held_by varchar(120),
    held_at timestamp,
    verified_by varchar(120),
    verified_at timestamp,
    approved_by varchar(120),
    approved_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS ap_payments (
    id serial PRIMARY KEY,
    pv_no integer NOT NULL UNIQUE,
    supplier varchar(200) NOT NULL,
    pay_date date NOT NULL,
    method varchar(20) NOT NULL,
    reference varchar(80),
    bank varchar(120),
    wht double precision NOT NULL DEFAULT 0,
    notes text,
    voided_at timestamp,
    voided_by varchar(120),
    void_reason text,
    created_by_name varchar(120),
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS ap_allocations (
    id serial PRIMARY KEY,
    payment_id integer NOT NULL REFERENCES ap_payments(id) ON DELETE CASCADE,
    grn_id integer NOT NULL,
    amount double precision NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ap_allocations_grn_idx ON ap_allocations (grn_id);
  -- Payables starts from the month it arrived: GRRs before then were paid the old way and stay out of it.
  -- Changed under Payables → Settings.
  INSERT INTO procurement_settings (key, value)
    VALUES ('ap_start', to_char(date_trunc('month', now() AT TIME ZONE 'Asia/Karachi'), 'YYYY-MM-DD'))
    ON CONFLICT (key) DO NOTHING;
END $$;
  `);
  ensured = true;
}

const rowsOf = (res: unknown): Record<string, unknown>[] => ((res as { rows?: unknown[] }).rows ?? res) as Record<string, unknown>[];

export async function apStartDate(): Promise<string> {
  const res = rowsOf(await db.execute(sql`SELECT value FROM procurement_settings WHERE key = 'ap_start'`));
  const v = String(res[0]?.value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "2000-01-01";
}

export async function setApStartDate(iso: string) {
  await db.execute(sql`INSERT INTO procurement_settings (key, value) VALUES ('ap_start', ${iso})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
}

const iso = (d: unknown) => (d == null ? null : d instanceof Date ? d.toISOString() : String(d));
const day = (d: unknown) => (d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

export interface ApPaymentRow {
  id: number; pvNo: number; supplier: string; date: string; method: string; reference: string; bank: string;
  total: number; wht: number; notes: string; voidedAt: string | null; voidedBy: string | null; voidReason: string | null;
  createdBy: string; createdAt: string;
  lines: { grnId: number; grr: string; invNo: string; amount: number }[];
}

export interface PayablesData {
  today: string;
  startDate: string;
  cases: ApCase[];
  payments: ApPaymentRow[];
}

// Every case from the start date on, with where it stands, plus every payment.
export async function loadPayables(): Promise<PayablesData> {
  await ensureApTables();
  const [startDate, checklist, grnRows, poRows, invRows, payRows, allocRows] = await Promise.all([
    apStartDate(),
    loadChecklist(),
    db.select({
      id: grns.id, grnNo: grns.grnNo, registered: grns.registered, date: grns.date, poId: grns.poId, poNo: grns.poNo,
      items: grns.items, inspection: grns.inspection, invNo: grns.invNo, dcNo: grns.dcNo, gatePassNo: grns.gatePassNo,
    }).from(grns),
    db.select({
      id: purchaseOrders.id, poNo: purchaseOrders.poNo, registered: purchaseOrders.registered, items: purchaseOrders.items,
      discount: purchaseOrders.discount, date: purchaseOrders.date, supplierName: purchaseOrders.supplierName,
    }).from(purchaseOrders),
    db.select().from(apInvoices),
    db.select().from(apPayments),
    db.select().from(apAllocations),
  ]);
  const today = karachiNow().date;

  // What each GRR comes to at its PO's rates — the same valuation as the dashboard's Received view, so a
  // later GRR on the same PO line is only valued up to what is left of it. Every GRR is valued (earlier
  // ones count towards what is left, and one from before the start date can still be taken in hand).
  const lines: ExpenseLine[] = [], skipped: SkippedLine[] = [];
  procurementExpenses(grnRows, poRows, checklist, "0000-01-01", "9999-12-31", lines, skipped);
  const expected = new Map<number, { amount: number; calc: Set<string> }>();
  for (const l of lines) {
    const id = Number((l.lineId || "").split(":")[0]);
    const e = expected.get(id) ?? { amount: 0, calc: new Set<string>() };
    e.amount += l.amount;
    e.calc.add(`${l.description}: ${l.calc ?? ""}`);
    expected.set(id, e);
  }
  const skippedBy = new Map<number, string[]>();
  for (const s of skipped) {
    const id = Number(s.href.split("/").pop());
    skippedBy.set(id, [...(skippedBy.get(id) ?? []), `${s.description || "A line"}: ${s.reason}`]);
  }

  const poById = new Map(poRows.map(p => [p.id, p]));
  const invByGrn = new Map(invRows.map(r => [r.grnId, r]));
  const payById = new Map(payRows.map(p => [p.id, p]));
  const grnById = new Map(grnRows.map(g => [g.id, g]));

  const paidBy = new Map<number, number>();
  const paysBy = new Map<number, ApPaymentRef[]>();
  for (const a of allocRows) {
    const p = payById.get(a.paymentId);
    if (!p || p.voidedAt) continue;
    paidBy.set(a.grnId, (paidBy.get(a.grnId) ?? 0) + a.amount);
    paysBy.set(a.grnId, [...(paysBy.get(a.grnId) ?? []), { id: p.id, pvNo: p.pvNo, date: day(p.payDate)!, amount: a.amount, method: p.method, reference: p.reference || "" }]);
  }

  const cases: ApCase[] = [];
  for (const g of grnRows) {
    const gDate = day(g.date)!;
    const r = invByGrn.get(g.id);
    // Before the start date: only if finance has already taken it in hand.
    if (gDate < startDate && !r) continue;
    const po = g.poId != null ? poById.get(g.poId) : undefined;
    const items = parseItems<GrnItem>(g.items).filter(it => String(it.item ?? "").trim() || String(it.quantity ?? "").trim());
    const qtyMismatch = items.filter(it => {
      const a = Number(String(it.invoiceQty ?? "").replace(/,/g, "")), b = Number(String(it.quantity ?? "").replace(/,/g, ""));
      return String(it.invoiceQty ?? "").trim() !== "" && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-9;
    }).length;
    const inv: ApInvoice | null = r ? {
      supplier: r.supplier, invoiceDate: day(r.invoiceDate), invoiceAmount: r.invoiceAmount, payableAmount: r.payableAmount,
      creditDays: r.creditDays, dueDate: day(r.dueDate), note: r.note, holdReason: r.holdReason, heldBy: r.heldBy,
      heldAt: iso(r.heldAt), verifiedBy: r.verifiedBy, verifiedAt: iso(r.verifiedAt), approvedBy: r.approvedBy, approvedAt: iso(r.approvedAt),
    } : null;
    const paid = Math.round((paidBy.get(g.id) ?? 0) * 100) / 100;
    const balance = inv?.payableAmount != null ? Math.round((inv.payableAmount - paid) * 100) / 100 : null;
    const ex = expected.get(g.id);
    const invNo = (g.invNo || "").trim();
    cases.push({
      grnId: g.id,
      grr: docNoLabel(g.grnNo, g.registered),
      grnDate: gDate,
      po: g.poNo != null ? docNoLabel(g.poNo, g.registered) : null,
      poId: g.poId,
      poDate: po ? day(po.date) : null,
      supplier: (inv?.supplier || po?.supplierName || "").trim(),
      invNo,
      dcNo: (g.dcNo || "").trim(),
      gatePassNo: (g.gatePassNo || "").trim(),
      itemsText: items.map(it => `${it.item}${it.quantity ? ` (${it.quantity})` : ""}`).join(", "),
      expected: ex ? Math.round(ex.amount * 100) / 100 : null,
      expectedCalc: ex ? [...ex.calc] : [],
      expectedSkipped: skippedBy.get(g.id) ?? [],
      qtyMismatch,
      qc: parseInspection(g.inspection).result || "",
      inv, paid, balance,
      stage: stageOf({ invNo, inv, balance }),
      payments: paysBy.get(g.id) ?? [],
    });
  }
  cases.sort((a, b) => b.grnDate.localeCompare(a.grnDate) || b.grnId - a.grnId);

  const payments: ApPaymentRow[] = payRows.map(p => {
    const mine = allocRows.filter(a => a.paymentId === p.id);
    return {
      id: p.id, pvNo: p.pvNo, supplier: p.supplier, date: day(p.payDate)!, method: p.method, reference: p.reference || "",
      bank: p.bank || "", total: Math.round(mine.reduce((s, a) => s + a.amount, 0) * 100) / 100, wht: p.wht || 0,
      notes: p.notes || "", voidedAt: iso(p.voidedAt), voidedBy: p.voidedBy, voidReason: p.voidReason,
      createdBy: p.createdByName || "", createdAt: iso(p.createdAt)!,
      lines: mine.map(a => {
        const g = grnById.get(a.grnId);
        return { grnId: a.grnId, grr: g ? docNoLabel(g.grnNo, g.registered) : `#${a.grnId}`, invNo: (g?.invNo || "").trim(), amount: a.amount };
      }),
    };
  }).sort((a, b) => b.pvNo - a.pvNo);

  return { today, startDate, cases, payments };
}

// One case, fresh, for an action to check against (its stage and what it still owes).
export async function loadCase(grnId: number): Promise<ApCase | null> {
  const data = await loadPayables();
  return data.cases.find(c => c.grnId === grnId) ?? null;
}

export async function apInvoiceRow(grnId: number) {
  const [r] = await db.select().from(apInvoices).where(eq(apInvoices.grnId, grnId)).limit(1);
  return r ?? null;
}
