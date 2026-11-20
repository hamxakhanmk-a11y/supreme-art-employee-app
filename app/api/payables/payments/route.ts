import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureApTables, loadPayables } from "@/lib/payablesServer";
import { checkAllocations, PAY_METHODS, fmtRs, pvLabel, type Allocation } from "@/lib/payables";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const rowsOf = (res: unknown): Record<string, unknown>[] => ((res as { rows?: unknown[] }).rows ?? res) as Record<string, unknown>[];

// POST /api/payables/payments { date, method, reference, bank, wht, notes, allocations: [{ grnId, amount }] }
// One payment to one supplier, settling one or more of that supplier's approved invoices, in full or in part.
// `amount` per invoice is what it settles (tax withheld included); the supplier receives the total less `wht`.
export async function POST(req: Request) {
  const guard = await guardWrite("payables.pay");
  if (guard instanceof NextResponse) return guard;
  await ensureApTables();
  const b = await req.json().catch(() => ({}));

  const date = String(b.date || "");
  if (!DATE_RE.test(date)) return bad("Give the payment date.");
  const method = String(b.method || "");
  if (!PAY_METHODS.some(m => m.key === method)) return bad("Choose how it was paid.");
  const reference = String(b.reference ?? "").trim().slice(0, 80);
  if ((method === "cheque" || method === "bank" || method === "online") && !reference) {
    return bad(method === "cheque" ? "Give the cheque number." : "Give the transaction / reference number.");
  }
  const bank = String(b.bank ?? "").trim().slice(0, 120);
  const notes = String(b.notes ?? "").trim();
  const allocs: Allocation[] = (Array.isArray(b.allocations) ? b.allocations : []).map((a: { grnId?: unknown; amount?: unknown }) => ({
    grnId: Number(a?.grnId), amount: Math.round(Number(String(a?.amount ?? "").replace(/,/g, "")) * 100) / 100,
  }));

  const data = await loadPayables();
  const ready = data.cases.filter(c => c.stage === "pay");
  const balances = new Map(ready.map(c => [c.grnId, c.balance ?? 0]));
  const problem = checkAllocations(allocs, balances);
  if (problem) return bad(problem);
  const picked = allocs.map(a => ready.find(c => c.grnId === a.grnId)!);
  const suppliers = new Set(picked.map(c => c.supplier.trim().toLowerCase()));
  if (suppliers.size > 1) return bad("One payment is to one supplier — these invoices are from different suppliers.");
  const supplier = picked[0].supplier;

  const total = Math.round(allocs.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const wht = b.wht === "" || b.wht == null ? 0 : Math.round(Number(String(b.wht).replace(/,/g, "")) * 100) / 100;
  if (!Number.isFinite(wht) || wht < 0) return bad("Tax withheld should be a number (0 if none).");
  if (wht >= total) return bad("Tax withheld can't be the whole payment.");

  // The payment and what it settles in one statement, so it is all saved or none of it.
  const res = rowsOf(await db.execute(sql`
    WITH p AS (
      INSERT INTO ap_payments (pv_no, supplier, pay_date, method, reference, bank, wht, notes, created_by_name)
      VALUES ((SELECT COALESCE(MAX(pv_no), 0) + 1 FROM ap_payments), ${supplier}, ${date}, ${method},
              ${reference || null}, ${bank || null}, ${wht}, ${notes || null}, ${guard.name})
      RETURNING id, pv_no
    ), a AS (
      INSERT INTO ap_allocations (payment_id, grn_id, amount)
      SELECT p.id, x.grn_id, x.amount FROM p, json_to_recordset(${JSON.stringify(allocs.map(a => ({ grn_id: a.grnId, amount: a.amount })))}::json)
        AS x(grn_id integer, amount double precision)
      RETURNING 1
    )
    SELECT id, pv_no FROM p
  `));
  const pv = Number(res[0]?.pv_no);
  await logActivity({
    user: guard, action: "payables.pay",
    summary: `paid ${supplier} ${fmtRs(total - wht)}${wht ? ` (+ ${fmtRs(wht)} tax withheld)` : ""} by ${PAY_METHODS.find(m => m.key === method)?.label}${reference ? ` ${reference}` : ""} — ${pvLabel(pv)} for ${picked.map(c => `GRR ${c.grr}`).join(", ")}`,
  });
  return NextResponse.json({ ok: true, id: Number(res[0]?.id), pvNo: pv });
}
