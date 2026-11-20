import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apInvoices } from "@/lib/schema";
import { guardWrite } from "@/lib/auth";
import { roleCanEdit } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { ensureApTables, loadCase, apInvoiceRow } from "@/lib/payablesServer";
import { addDays, needsNote, fmtRs, DEFAULT_CREDIT_DAYS } from "@/lib/payables";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const money = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// POST /api/payables/[grnId] { action, ... } — move one case along.
//  check    { invoiceDate, invoiceAmount, payableAmount, creditDays, supplier?, note?, approve? }  (Payables edit)
//           the invoice checked against the PO and the GRR; with approve (and the Approve grant) approved too
//  hold     { reason }    (Payables edit)   release  (Payables edit)
//  approve               (Payables · Approve)
//  reopen   { reason? }  (Payables · Approve, or Payables edit while not yet approved) — back to Invoice check;
//           not once anything has been paid against it
export async function POST(req: Request, { params }: { params: Promise<{ grnId: string }> }) {
  const { grnId: raw } = await params;
  const grnId = parseInt(raw);
  if (isNaN(grnId)) return bad("Invalid GRR");
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");

  const needsApprove = action === "approve" || (action === "check" && !!b.approve);
  const guard = await guardWrite(needsApprove ? "payables.approve" : "payables");
  if (guard instanceof NextResponse) return guard;
  await ensureApTables();

  const c = await loadCase(grnId);
  if (!c) return bad("That GRR isn't in Payables (no GRR, or it is from before the date Payables starts).", 404);
  if (!c.invNo) return bad("Put the supplier's invoice number on the GRR first.");
  const ref = `GRR ${c.grr} (invoice ${c.invNo})`;
  const existing = await apInvoiceRow(grnId);
  const now = new Date();

  if (action === "check") {
    if (c.inv?.approvedAt) return bad("It is already approved. Send it back to Invoice check first to change it.");
    const invoiceDate = String(b.invoiceDate || "");
    if (!DATE_RE.test(invoiceDate)) return bad("Give the invoice date.");
    const invoiceAmount = money(b.invoiceAmount), payableAmount = money(b.payableAmount);
    if (invoiceAmount == null || Number.isNaN(invoiceAmount) || invoiceAmount < 0) return bad("Give the invoice amount.");
    if (payableAmount == null || Number.isNaN(payableAmount) || payableAmount < 0) return bad("Give the amount to pay.");
    const creditDays = b.creditDays === "" || b.creditDays == null ? DEFAULT_CREDIT_DAYS : Math.round(Number(b.creditDays));
    if (!Number.isFinite(creditDays) || creditDays < 0 || creditDays > 365) return bad("Credit days should be 0 to 365.");
    const supplier = String(b.supplier ?? "").trim().slice(0, 200);
    if (!c.supplier && !supplier) return bad("This GRR has no PO to take the supplier from — type the supplier's name.");
    const note = String(b.note ?? "").trim();
    if (needsNote(c.expected, payableAmount, invoiceAmount) && !note) {
      return bad(`The amount to pay (${fmtRs(payableAmount)}) isn't what the PO and GRR come to (${fmtRs(c.expected)}) — write why (short supply, rejected goods, rate difference…).`);
    }
    const vals = {
      supplier: supplier || null, invoiceDate, invoiceAmount, payableAmount, creditDays,
      dueDate: addDays(invoiceDate, creditDays), note: note || null,
      holdReason: null, heldBy: null, heldAt: null,
      verifiedBy: guard.name, verifiedAt: now,
      approvedBy: b.approve ? guard.name : null, approvedAt: b.approve ? now : null,
      updatedAt: now,
    };
    if (existing) await db.update(apInvoices).set(vals).where(eq(apInvoices.grnId, grnId));
    else await db.insert(apInvoices).values({ grnId, ...vals });
    await logActivity({ user: guard, action: "payables.check", summary: `checked ${ref}: invoice ${fmtRs(invoiceAmount)}, to pay ${fmtRs(payableAmount)}${b.approve ? ", and approved it" : ""}` });
    return NextResponse.json({ ok: true });
  }

  if (action === "hold") {
    const reason = String(b.reason ?? "").trim();
    if (!reason) return bad("Say why it is on hold.");
    if (c.inv?.approvedAt && c.paid > 0) return bad("Something has been paid against it already — it can't go on hold.");
    if (existing) await db.update(apInvoices).set({ holdReason: reason, heldBy: guard.name, heldAt: now, updatedAt: now }).where(eq(apInvoices.grnId, grnId));
    else await db.insert(apInvoices).values({ grnId, holdReason: reason, heldBy: guard.name, heldAt: now });
    await logActivity({ user: guard, action: "payables.hold", summary: `put ${ref} on hold: ${reason}` });
    return NextResponse.json({ ok: true });
  }

  if (action === "release") {
    if (!existing?.holdReason) return bad("It isn't on hold.");
    await db.update(apInvoices).set({ holdReason: null, heldBy: null, heldAt: null, updatedAt: now }).where(eq(apInvoices.grnId, grnId));
    await logActivity({ user: guard, action: "payables.release", summary: `took ${ref} off hold` });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    if (c.stage !== "approve") return bad(c.stage === "check" ? "Check the invoice first." : "It isn't waiting for approval.");
    await db.update(apInvoices).set({ approvedBy: guard.name, approvedAt: now, updatedAt: now }).where(eq(apInvoices.grnId, grnId));
    await logActivity({ user: guard, action: "payables.approve", summary: `approved ${ref} for payment: ${fmtRs(c.inv?.payableAmount)}` });
    return NextResponse.json({ ok: true });
  }

  if (action === "reopen") {
    if (!existing?.verifiedAt) return bad("It hasn't been checked yet.");
    if (c.paid > 0) return bad("Something has been paid against it — void that payment first.");
    if (existing.approvedAt && !(await roleCanEdit(guard.role, "payables.approve"))) return bad("Only someone who can approve can send back an approved invoice.", 403);
    const reason = String(b.reason ?? "").trim();
    await db.update(apInvoices).set({ verifiedBy: null, verifiedAt: null, approvedBy: null, approvedAt: null, updatedAt: now }).where(eq(apInvoices.grnId, grnId));
    await logActivity({ user: guard, action: "payables.reopen", summary: `sent ${ref} back to Invoice check${reason ? `: ${reason}` : ""}` });
    return NextResponse.json({ ok: true });
  }

  return bad("Unknown action");
}
