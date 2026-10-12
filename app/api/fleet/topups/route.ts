import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { psoCards, psoCardTopups } from "@/lib/schema";
import { and, desc, eq } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";
import { cardBalance } from "@/lib/cardBalance";

// Money loaded onto a PSO card. Entered in the office, on PSO Cards → All
// cards: an 'opening' is the balance counted on a card (the first time, or a
// recount), a 'topup' a recharge on top of it.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function amountOf(v: unknown, kind: string): number | null {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isFinite(n)) return null;
  // A recharge adds money; an opening may honestly be zero.
  if (kind === "topup" ? n <= 0 : n < 0) return null;
  return Math.round(n * 100) / 100;
}

const shape = (t: typeof psoCardTopups.$inferSelect) => ({
  id: t.id, cardId: t.cardId, kind: t.kind, date: String(t.date), amount: t.amount,
  refNo: t.refNo || "", createdBy: t.createdBy || "", createdAt: new Date(t.createdAt).toISOString(),
});

// GET ?cardId= — one card's history, newest first.
export async function GET(req: NextRequest) {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const cardId = Number(req.nextUrl.searchParams.get("cardId"));
    if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });
    const rows = await db.select().from(psoCardTopups)
      .where(eq(psoCardTopups.cardId, cardId))
      .orderBy(desc(psoCardTopups.createdAt), desc(psoCardTopups.id));
    return NextResponse.json(rows.map(shape));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { cardId, kind, date, amount, refNo? }
export async function POST(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const cardId = Number(b?.cardId);
    const kind = b?.kind === "opening" ? "opening" : "topup";
    const date = String(b?.date || "");
    const amount = amountOf(b?.amount, kind);
    if (!cardId) return NextResponse.json({ error: "Pick a card" }, { status: 400 });
    if (!ISO.test(date)) return NextResponse.json({ error: "Give the date" }, { status: 400 });
    if (amount === null) {
      return NextResponse.json({ error: kind === "topup" ? "Enter the amount loaded" : "Enter the balance on the card" }, { status: 400 });
    }

    const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, cardId));
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    // A recharge needs a balance to add to: without an opening the card's
    // total would quietly start from zero and be wrong from the first day.
    if (kind === "topup") {
      const [opening] = await db.select({ id: psoCardTopups.id }).from(psoCardTopups)
        .where(and(eq(psoCardTopups.cardId, cardId), eq(psoCardTopups.kind, "opening"))).limit(1);
      if (!opening) {
        return NextResponse.json({ error: `Set card ${card.sn}'s opening balance first` }, { status: 409 });
      }
    }

    const [row] = await db.insert(psoCardTopups).values({
      cardId, kind, date, amount,
      refNo: String(b?.refNo || "").trim().slice(0, 60),
      createdBy: guard.name,
    }).returning();

    await logActivity({
      user: guard, action: kind === "opening" ? "station.card.opening" : "station.card.topup",
      summary: kind === "opening"
        ? `set PSO card ${card.sn}'s opening balance to Rs ${amount}`
        : `topped up PSO card ${card.sn} with Rs ${amount}${row.refNo ? ` (ref ${row.refNo})` : ""}`,
    });
    return NextResponse.json({ topup: shape(row), balance: await cardBalance(cardId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT { id, date?, amount?, refNo? } — fix an entry.
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [before] = await db.select().from(psoCardTopups).where(eq(psoCardTopups.id, id));
    if (!before) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const date = b?.date !== undefined ? String(b.date) : String(before.date);
    if (!ISO.test(date)) return NextResponse.json({ error: "Give the date" }, { status: 400 });
    const amount = b?.amount !== undefined ? amountOf(b.amount, before.kind) : before.amount;
    if (amount === null) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });

    await db.update(psoCardTopups).set({
      date, amount,
      refNo: b?.refNo !== undefined ? String(b.refNo).trim().slice(0, 60) : before.refNo,
    }).where(eq(psoCardTopups.id, id));

    const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, before.cardId));
    await logActivity({ user: guard, action: "station.card.topup.edit", summary: `corrected a top-up on PSO card ${card?.sn ?? ""}`.trim() });
    return NextResponse.json({ ok: true, balance: await cardBalance(before.cardId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [row] = await db.select().from(psoCardTopups).where(eq(psoCardTopups.id, id));
    if (!row) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    await db.delete(psoCardTopups).where(eq(psoCardTopups.id, id));
    const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, row.cardId));
    await logActivity({
      user: guard, action: "station.card.topup.delete",
      summary: `deleted a ${row.kind === "opening" ? "opening balance" : "top-up"} of Rs ${row.amount} on PSO card ${card?.sn ?? ""}`.trim(),
    });
    return NextResponse.json({ ok: true, balance: await cardBalance(row.cardId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
