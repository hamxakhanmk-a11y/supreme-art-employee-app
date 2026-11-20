import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apPayments } from "@/lib/schema";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureApTables } from "@/lib/payablesServer";
import { pvLabel } from "@/lib/payables";

export const dynamic = "force-dynamic";

// DELETE /api/payables/payments/[id] { reason } — void a payment recorded by mistake. It stays on the list,
// struck through, with who voided it and why; what it paid is owed again (the invoices go back to Ready to pay).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("payables.void");
  if (guard instanceof NextResponse) return guard;
  await ensureApTables();
  const { id: raw } = await params;
  const id = parseInt(raw);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const reason = String(b.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Say why it is being voided." }, { status: 400 });
  const [p] = await db.select().from(apPayments).where(eq(apPayments.id, id)).limit(1);
  if (!p) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (p.voidedAt) return NextResponse.json({ error: "It is already voided." }, { status: 400 });
  await db.update(apPayments).set({ voidedAt: new Date(), voidedBy: guard.name, voidReason: reason }).where(eq(apPayments.id, id));
  await logActivity({ user: guard, action: "payables.void", summary: `voided payment ${pvLabel(p.pvNo)} to ${p.supplier}: ${reason}` });
  return NextResponse.json({ ok: true });
}
