// Accounts Payable — what happens to a GRR after the goods are in: the supplier's invoice is checked against
// the PO and the GRR (the three-way match), approved for payment, paid (once or in parts, one payment can
// settle several invoices of the same supplier), and then it is complete.
//
// A case is one GRR. It enters Payables once its invoice number is on the GRR, and moves along by itself:
//   Invoice check → (On hold) → To approve → Ready to pay → Completed
// Pure data and arithmetic only (used on the server and in the browser); the database side is
// lib/payablesServer.ts.

export type ApStage = "noinvoice" | "check" | "hold" | "approve" | "pay" | "done";

export const AP_STAGES: { key: ApStage; label: string; hint: string; color: string; bg: string }[] = [
  { key: "noinvoice", label: "Awaiting invoice", hint: "Goods are in (GRR made) but the supplier's invoice number isn't on the GRR yet", color: "#64748B", bg: "#F1F5F9" },
  { key: "check", label: "Invoice check", hint: "Invoice is in — check it against the PO and the GRR, and say what is to be paid", color: "#B45309", bg: "#FEF3C7" },
  { key: "hold", label: "On hold", hint: "Something doesn't match or is missing — waiting on the supplier or procurement", color: "#B91C1C", bg: "#FEE2E2" },
  { key: "approve", label: "To approve", hint: "Checked by finance — waiting for approval to pay", color: "#6D28D9", bg: "#EDE9FE" },
  { key: "pay", label: "Ready to pay", hint: "Approved — record the payment when it is made (in full or in parts)", color: "#1D4ED8", bg: "#DBEAFE" },
  { key: "done", label: "Completed", hint: "Paid in full", color: "#166534", bg: "#DCFCE7" },
];
export const stageMeta = (s: ApStage) => AP_STAGES.find(x => x.key === s)!;

export const PAY_METHODS = [
  { key: "cheque", label: "Cheque" },
  { key: "bank", label: "Bank transfer" },
  { key: "online", label: "Online / IBFT" },
  { key: "cash", label: "Cash" },
] as const;
export type PayMethod = typeof PAY_METHODS[number]["key"];
export const payMethodLabel = (k: string | null | undefined) => PAY_METHODS.find(m => m.key === k)?.label ?? (k || "—");

export const DEFAULT_CREDIT_DAYS = 30;

// What finance has written against a case (one row of ap_invoices).
export interface ApInvoice {
  supplier: string | null;       // typed in when the GRR has no PO to take it from
  invoiceDate: string | null;    // yyyy-mm-dd
  invoiceAmount: number | null;  // what the supplier's invoice says, tax included
  payableAmount: number | null;  // what we agree to pay (the invoice, less anything not accepted)
  creditDays: number | null;
  dueDate: string | null;        // invoice date + credit days
  note: string | null;           // why the payable differs from what the PO and GRR come to
  holdReason: string | null;
  heldBy: string | null;
  heldAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface ApPaymentRef { id: number; pvNo: number; date: string; amount: number; method: string; reference: string }

export interface ApCase {
  grnId: number;
  grr: string;                   // "15004" / "15004u"
  grnDate: string;
  po: string | null;             // "10234"
  poId: number | null;
  poDate: string | null;
  supplier: string;
  invNo: string;
  dcNo: string;
  gatePassNo: string;
  itemsText: string;             // the items, for the list and the search
  // The three-way match: what the GRR comes to at the PO's rates (null when it can't be worked out).
  expected: number | null;
  expectedCalc: string[];        // how each line was valued
  expectedSkipped: string[];     // lines that couldn't be valued, and why
  qtyMismatch: number;           // GRR lines whose invoice quantity differs from what was received
  qc: string;                    // inspection result: "", accepted, partial, rejected
  inv: ApInvoice | null;
  paid: number;                  // settled by payments (tax withheld included), voided ones left out
  balance: number | null;        // payable − paid, once checked
  stage: ApStage;
  payments: ApPaymentRef[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// Rounding and small differences are let through: Rs 10 or half a percent, whichever is more.
export function matchTolerance(expected: number): number { return Math.max(10, Math.abs(expected) * 0.005); }

// Does the invoice agree with what the PO and the GRR come to?
export function matchResult(expected: number | null, invoiceAmount: number | null): { status: "ok" | "over" | "under" | "unknown"; diff: number } {
  if (expected == null || invoiceAmount == null) return { status: "unknown", diff: 0 };
  const diff = r2(invoiceAmount - expected);
  if (Math.abs(diff) <= matchTolerance(expected)) return { status: "ok", diff };
  return { status: diff > 0 ? "over" : "under", diff };
}

// What to pay, before anyone changes it: the invoice when it agrees, else the lower of the invoice and
// what was received at the PO's rates (big systems never pay more than was ordered and received).
export function suggestPayable(expected: number | null, invoiceAmount: number | null): number | null {
  if (invoiceAmount == null) return expected;
  const m = matchResult(expected, invoiceAmount);
  if (m.status === "over" && expected != null) return r2(expected);
  return r2(invoiceAmount);
}

// A payable that differs from what the documents come to needs a reason written down.
export function needsNote(expected: number | null, payable: number | null, invoiceAmount: number | null): boolean {
  if (payable == null) return false;
  if (expected != null && Math.abs(payable - expected) > matchTolerance(expected)) return true;
  if (invoiceAmount != null && expected == null && Math.abs(payable - invoiceAmount) > 0.5) return true;
  return false;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

// Where a case stands. Payments only follow approval, so anything with money still owing is "pay".
export function stageOf(c: { invNo: string; inv: ApInvoice | null; balance: number | null }): ApStage {
  const inv = c.inv;
  if (inv?.holdReason) return "hold";
  if (inv?.approvedAt) return (c.balance ?? 0) > 0.005 ? "pay" : "done";
  if (inv?.verifiedAt) return "approve";
  if (!c.invNo.trim()) return "noinvoice";
  return "check";
}

// Due / overdue, for the cases that still owe money.
export function dueInfo(dueDate: string | null, today: string): { days: number | null; label: string; tone: "late" | "soon" | "ok" | "none" } {
  if (!dueDate) return { days: null, label: "—", tone: "none" };
  const days = daysBetween(today, dueDate);
  if (days < 0) return { days, label: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "late" };
  if (days === 0) return { days, label: "Due today", tone: "soon" };
  if (days <= 7) return { days, label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "soon" };
  return { days, label: `Due in ${days} days`, tone: "ok" };
}

// Aging of what is owed, by how far past its due date it is (the usual 0-30 / 31-60 / 61-90 / 90+).
export const AGING_BUCKETS = ["Not due", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;
export function agingBucket(dueDate: string | null, today: string): number {
  if (!dueDate) return 0;
  const late = daysBetween(dueDate, today);
  if (late <= 0) return 0;
  if (late <= 30) return 1;
  if (late <= 60) return 2;
  if (late <= 90) return 3;
  return 4;
}

// What one payment settles: each invoice's share, which can't be more than it still owes.
export interface Allocation { grnId: number; amount: number }
export function checkAllocations(allocs: Allocation[], balances: Map<number, number>): string | null {
  if (!allocs.length) return "Pick at least one invoice to pay.";
  for (const a of allocs) {
    if (!(a.amount > 0)) return "Each amount has to be more than 0.";
    const bal = balances.get(a.grnId);
    if (bal == null) return "One of the invoices isn't ready to pay (it has to be approved first).";
    if (a.amount > bal + 0.5) return `That is more than is still owed on one of the invoices (Rs ${bal.toLocaleString("en-US", { maximumFractionDigits: 2 })}).`;
  }
  if (new Set(allocs.map(a => a.grnId)).size !== allocs.length) return "An invoice is listed twice.";
  return null;
}

export const fmtRs = (n: number | null | undefined) =>
  n == null ? "—" : "Rs " + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const pvLabel = (n: number) => `PV-${String(n).padStart(4, "0")}`;

// Rupees in words for the payment voucher, the Pakistani way (lakh, crore): 125000.5 →
// "One Lakh Twenty Five Thousand Rupees and Fifty Paisa Only".
export function rupeesInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`);
  const three = (n: number) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : "", two(n % 100)].filter(Boolean).join(" ");
  const words = (n: number): string => {
    if (n === 0) return "Zero";
    const parts: string[] = [];
    const crore = Math.floor(n / 10000000), lakh = Math.floor((n % 10000000) / 100000), thousand = Math.floor((n % 100000) / 1000), rest = n % 1000;
    if (crore) parts.push(`${words(crore)} Crore`);
    if (lakh) parts.push(`${two(lakh)} Lakh`);
    if (thousand) parts.push(`${two(thousand)} Thousand`);
    if (rest) parts.push(three(rest));
    return parts.join(" ");
  };
  const abs = Math.abs(Math.round(amount * 100) / 100);
  const rupees = Math.floor(abs), paisa = Math.round((abs - rupees) * 100);
  return `${words(rupees)} Rupees${paisa ? ` and ${two(paisa)} Paisa` : ""} Only`;
}
