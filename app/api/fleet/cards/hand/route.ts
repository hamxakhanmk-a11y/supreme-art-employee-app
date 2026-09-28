import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, psoCardIssues, psoCards } from "@/lib/schema";
import { and, eq, isNull } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";

// POST /api/fleet/cards/hand { cardId, action: "take" | "return", holderId?, holderName? }
//
// Custody only. A card changes hands independently of the fuel drawn on it —
// it stays with a driver across many fills — so handing it over and recording
// a fill are two different things and touch two different rows.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const cardId = Number(b?.cardId);
    const action = b?.action === "return" ? "return" : "take";
    if (!cardId) return NextResponse.json({ error: "Pick a card" }, { status: 400 });

    const [card] = await db.select().from(psoCards).where(eq(psoCards.id, cardId));
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    if (action === "return") {
      if (!card.heldByName) return NextResponse.json({ error: `Card ${card.sn} is already in the drawer` }, { status: 409 });
      await db.update(psoCards)
        .set({ heldById: null, heldByName: null, heldSince: null })
        .where(eq(psoCards.id, cardId));

      // Every fill drawn while the card was out is submitted the moment it
      // comes back — that is when the slips are handed over, so a record
      // cannot be "submitted" while the card is still in a pocket.
      const now = new Date();
      const stamped = await db.update(psoCardIssues).set({
        submittedDate: now.toISOString().slice(0, 10),
        submittedTime: now.toTimeString().slice(0, 5),
      }).where(and(eq(psoCardIssues.cardId, cardId), isNull(psoCardIssues.submittedDate))).returning({ id: psoCardIssues.id });
      await logActivity({
        user: guard, action: "station.card.in",
        summary: `took PSO card ${card.sn} back from ${card.heldByName}`
          + (stamped.length ? ` — ${stamped.length} fuel record${stamped.length === 1 ? "" : "s"} submitted` : ""),
      });
      return NextResponse.json({ ok: true, action });
    }

    if (card.status === "blocked" || card.status === "lost") {
      return NextResponse.json({ error: `Card ${card.sn} is marked ${card.status}` }, { status: 400 });
    }
    if (card.heldByName) {
      return NextResponse.json({ error: `Card ${card.sn} is already with ${card.heldByName}` }, { status: 409 });
    }

    // An employee's name is read from their record rather than trusted from the
    // caller, so it reads the same here as everywhere else it appears.
    const holderId = b?.holderId ? Number(b.holderId) : null;
    let holderName = String(b?.holderName || "").trim();
    if (holderId) {
      const [e] = await db.select({ first: employees.firstName, last: employees.lastName })
        .from(employees).where(eq(employees.id, holderId));
      if (e) holderName = `${e.first} ${e.last}`.trim();
    }
    if (!holderName) return NextResponse.json({ error: "Who is taking the card?" }, { status: 400 });

    await db.update(psoCards).set({
      heldById: holderId,
      heldByName: holderName,
      heldSince: new Date().toISOString().slice(0, 10),
    }).where(eq(psoCards.id, cardId));

    await logActivity({
      user: guard, action: "station.card.out", employeeId: holderId ?? undefined, employeeName: holderName,
      summary: `gave PSO card ${card.sn} to ${holderName}`,
    });
    return NextResponse.json({ ok: true, action, holderName });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
