import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchaseOrders, grns } from "@/lib/schema";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables, docNoLabel, fmtDate } from "@/lib/procurement";
import { karachiNow } from "@/lib/gateTime";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function loadPo(raw: string) {
  const id = parseInt(raw);
  if (isNaN(id)) return null;
  const [p] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
  return p ?? null;
}

// POST /api/procurement/pos/[id]/receive { date } — the goods of this PO have physically arrived (the GRR
// follows). From then on the PO can be picked on a new GRR. The date can't be in the future or before the PO.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("po.receive");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const p = await loadPo((await ctx.params).id);
  if (!p) return NextResponse.json({ error: "PO not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const today = karachiNow().date;
  const date = String(b.date || today);
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "Give the date the goods arrived." }, { status: 400 });
  if (date > today) return NextResponse.json({ error: "The date can't be in the future." }, { status: 400 });
  const poDate = String(p.date).slice(0, 10);
  if (date < poDate) return NextResponse.json({ error: `The PO is dated ${fmtDate(poDate)} — the goods can't have arrived before it.` }, { status: 400 });
  if (p.status === "closed") return NextResponse.json({ error: "This PO is closed." }, { status: 400 });
  await db.update(purchaseOrders).set({ receivedAt: date, receivedBy: guard.name, receivedMarkedAt: new Date() }).where(eq(purchaseOrders.id, p.id));
  await logActivity({ user: guard, action: "po.receive", summary: `marked PO #${docNoLabel(p.poNo, p.registered)}${p.supplierName ? ` (${p.supplierName})` : ""} received on ${fmtDate(date)} — its GRR can be made now` });
  return NextResponse.json({ ok: true });
}

// DELETE — undo a mistaken Mark received, only while no GRR has been made against the PO.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("po.receive");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const p = await loadPo((await ctx.params).id);
  if (!p) return NextResponse.json({ error: "PO not found" }, { status: 404 });
  if (!p.receivedAt) return NextResponse.json({ error: "It isn't marked received." }, { status: 400 });
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(grns).where(eq(grns.poId, p.id));
  if (Number(n) > 0) return NextResponse.json({ error: "A GRR has been made against this PO — it can't go back to pending." }, { status: 400 });
  await db.update(purchaseOrders).set({ receivedAt: null, receivedBy: null, receivedMarkedAt: null }).where(eq(purchaseOrders.id, p.id));
  await logActivity({ user: guard, action: "po.receive.undo", summary: `took PO #${docNoLabel(p.poNo, p.registered)} back to pending (was marked received ${fmtDate(String(p.receivedAt).slice(0, 10))})` });
  return NextResponse.json({ ok: true });
}
