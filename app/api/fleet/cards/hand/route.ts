import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, psoCardCustody, psoCardIssues, psoCards } from "@/lib/schema";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";
import { gateWhen, localKey } from "@/lib/gateTime";

// POST /api/fleet/cards/hand { cardId, action: "take" | "return", holderId?, holderName?, date?, at? }
//
// Custody only. A card changes hands independently of the fuel drawn on it —
// it stays with a driver across many fills — so handing it over and recording
// a fill are two different things and touch two different rows.
//
// date / at let an entry be made after the fact; left out, they are now, in
// Karachi. (They used to be read off the server's own clock, which runs in UTC
// — so every card time saved before this was five hours behind the gate.)
export async function POST(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const cardId = Number(b?.cardId);
    const action = b?.action === "return" ? "return" : "take";
    if (!cardId) return NextResponse.json({ error: "Pick a card" }, { status: 400 });

    const when = gateWhen(b);
    if (when.error) return NextResponse.json({ error: when.error }, { status: 400 });

    const [card] = await db.select().from(psoCards).where(eq(psoCards.id, cardId));
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    if (action === "return") {
      if (!card.heldByName) return NextResponse.json({ error: `Card ${card.sn} is already in the drawer` }, { status: 409 });

      // A card can't come back before it went out.
      const [spell] = await db.select().from(psoCardCustody)
        .where(and(eq(psoCardCustody.cardId, cardId), isNull(psoCardCustody.returnedDate))).limit(1);
      if (spell && localKey(when.date, when.time) < localKey(spell.takenDate, spell.takenTime)) {
        return NextResponse.json({
          error: `${card.heldByName} took it on ${spell.takenDate}${spell.takenTime ? ` at ${spell.takenTime}` : ""} — it can't be back before then.`,
        }, { status: 400 });
      }

      await db.update(psoCards)
        .set({ heldById: null, heldByName: null, heldSince: null })
        .where(eq(psoCards.id, cardId));
      // Closes the spell rather than deleting it: the point of the table is
      // that last month's holder is still answerable for last month.
      await db.update(psoCardCustody).set({
        returnedDate: when.date, returnedTime: when.time,
      }).where(and(eq(psoCardCustody.cardId, cardId), isNull(psoCardCustody.returnedDate)));

      // Every fill drawn while the card was out is submitted when it comes back
      // — that is when the slips are handed over, so a record cannot be
      // "submitted" while the card is still in a pocket.
      const stamped = await db.update(psoCardIssues).set({
        submittedDate: when.date, submittedTime: when.time,
      }).where(and(eq(psoCardIssues.cardId, cardId), isNull(psoCardIssues.submittedDate))).returning({ id: psoCardIssues.id });

      await logActivity({
        user: guard, action: "station.card.in",
        summary: `took PSO card ${card.sn} back from ${card.heldByName}`
          + (when.manual ? ` (entered for ${when.date} ${when.time})` : "")
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

    // Written up after the fact, it must still come after the card's last
    // return — two people can't have held one card at once, and history that
    // says they did can't answer "who had it that day".
    const [last] = await db.select().from(psoCardCustody)
      .where(and(eq(psoCardCustody.cardId, cardId), isNotNull(psoCardCustody.returnedDate)))
      .orderBy(desc(psoCardCustody.returnedDate), desc(psoCardCustody.returnedTime)).limit(1);
    if (last?.returnedDate && localKey(when.date, when.time) < localKey(last.returnedDate, last.returnedTime)) {
      return NextResponse.json({
        error: `This card was with ${last.holderName} until ${last.returnedDate}${last.returnedTime ? ` ${last.returnedTime}` : ""} — it can't have gone out again before then.`,
      }, { status: 400 });
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
      heldSince: when.date,
    }).where(eq(psoCards.id, cardId));
    // The card carries where it is; this carries where it has been.
    await db.insert(psoCardCustody).values({
      cardId, holderId, holderName,
      takenDate: when.date, takenTime: when.time,
    });

    await logActivity({
      user: guard, action: "station.card.out", employeeId: holderId ?? undefined, employeeName: holderName,
      summary: `gave PSO card ${card.sn} to ${holderName}`
        + (when.manual ? ` (entered for ${when.date} ${when.time})` : ""),
    });
    return NextResponse.json({ ok: true, action, holderName });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
