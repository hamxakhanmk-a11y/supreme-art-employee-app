import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, psoCardCustody, psoCardIssues, psoCards } from "@/lib/schema";
import { and, eq, isNull } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";
import { localKey } from "@/lib/gateTime";

// One row here is one fuel record: the driver drew fuel on a card, and the
// slip came in. It says nothing about where the card is — that lives on the
// card itself, because a card stays with a driver across many fills.

const MODULE = "station";

function hhmm(v: unknown): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  return /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, "0") : "";   // "" signals invalid
}
function money(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// POST — record fuel drawn. { cardId, vehicleId?, driverId?, driverName?,
// collectedDate?, collectedTime?, submittedDate?, submittedTime?, slipNo?,
// amount?, notes? }
//
// On a card that is out, the collection date and time are left out and taken
// from the hand-over: they are when the card was collected, which the station
// already knows — asking again only invites a second, different answer.
export async function POST(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const cardId = Number(b?.cardId);
    if (!cardId) return NextResponse.json({ error: "Pick a card" }, { status: 400 });

    const [spell] = await db.select().from(psoCardCustody)
      .where(and(eq(psoCardCustody.cardId, cardId), isNull(psoCardCustody.returnedDate))).limit(1);
    const collectedDate = String(b?.collectedDate || spell?.takenDate || "");
    if (!collectedDate) return NextResponse.json({ error: "Collection date is required" }, { status: 400 });

    const collectedTime = b?.collectedDate ? hhmm(b?.collectedTime) : (spell?.takenTime ?? null);
    const submittedTime = hhmm(b?.submittedTime);
    if (collectedTime === "" || submittedTime === "") {
      return NextResponse.json({ error: "Times must be HH:MM" }, { status: 400 });
    }
    const submittedDate = b?.submittedDate ? String(b.submittedDate) : null;
    if (submittedDate && submittedDate < collectedDate) {
      return NextResponse.json({ error: "The slip can't come in before the fuel was drawn" }, { status: 400 });
    }

    const [card] = await db.select().from(psoCards).where(eq(psoCards.id, cardId));
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    // Whoever drew the fuel. Defaults to whoever is holding the card, since
    // that is who it will be nearly every time.
    const driverId = b?.driverId ? Number(b.driverId) : (card.heldById ?? null);
    let driverName = String(b?.driverName || "").trim() || (card.heldByName || "");
    if (driverId) {
      const [e] = await db.select({ first: employees.firstName, last: employees.lastName })
        .from(employees).where(eq(employees.id, driverId));
      if (e) driverName = `${e.first} ${e.last}`.trim();
    }

    const [row] = await db.insert(psoCardIssues).values({
      cardId,
      // The card's vehicle at the time, so moving the card later doesn't
      // rewrite where this fuel was burned.
      vehicleId: b?.vehicleId ? Number(b.vehicleId) : card.vehicleId,
      driverId, driverName,
      collectedDate, collectedTime,
      // Left open while the card is still out: it is submitted when the card
      // comes back. A record entered after the card is already in is a slip
      // arriving now.
      submittedDate: submittedDate ?? (card.heldByName ? null : collectedDate),
      submittedTime: submittedDate ? submittedTime : null,
      slipNo: String(b?.slipNo || "").trim().slice(0, 40),
      amount: money(b?.amount),
      notes: String(b?.notes || "").trim(),
      custodyId: spell?.id ?? null,
    }).returning();

    await logActivity({
      user: guard, action: "station.card.fuel",
      employeeId: driverId ?? undefined, employeeName: driverName || undefined,
      summary: `fuel on PSO card ${card.sn} — ${row.amount ? `Rs ${row.amount}` : "amount not given"} on ${collectedDate}`,
    });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — correct a record. { id, ... }
export async function PUT(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [before] = await db.select().from(psoCardIssues).where(eq(psoCardIssues.id, id));
    if (!before) return NextResponse.json({ error: "Record not found" }, { status: 404 });

    const collectedTime = b?.collectedTime !== undefined ? hhmm(b.collectedTime) : before.collectedTime;
    const submittedTime = b?.submittedTime !== undefined ? hhmm(b.submittedTime) : before.submittedTime;
    if (collectedTime === "" || submittedTime === "") {
      return NextResponse.json({ error: "Times must be HH:MM" }, { status: 400 });
    }

    const collectedDate = String(b?.collectedDate || before.collectedDate);
    const submittedDate = b?.submittedDate === "" || b?.submittedDate === null
      ? null
      : (b?.submittedDate ? String(b.submittedDate) : before.submittedDate);
    if (submittedDate && submittedDate < collectedDate) {
      return NextResponse.json({ error: "The slip can't come in before the fuel was drawn" }, { status: 400 });
    }

    const driverId = b?.driverId === "" || b?.driverId === null
      ? null
      : (b?.driverId !== undefined ? Number(b.driverId) : before.driverId);
    let driverName = b?.driverName !== undefined ? String(b.driverName).trim() : (before.driverName || "");
    if (driverId) {
      const [e] = await db.select({ first: employees.firstName, last: employees.lastName })
        .from(employees).where(eq(employees.id, driverId));
      if (e) driverName = `${e.first} ${e.last}`.trim();
    }

    // Collection, return and holder belong to the hand-over, not to this one
    // record: correct them here and the hand-over is corrected too — so the
    // station checks a return against the fixed time, PSO Cards shows it, and
    // every other fill drawn under the same hand-over reads the same.
    const [spell] = before.custodyId
      ? await db.select().from(psoCardCustody).where(eq(psoCardCustody.id, before.custodyId))
      : [];
    const takenChanged = !!spell && (b?.collectedDate !== undefined || b?.collectedTime !== undefined);
    const backChanged = !!spell && !!spell.returnedDate && !!submittedDate
      && (b?.submittedDate !== undefined || b?.submittedTime !== undefined);
    const holderChanged = !!spell && !!driverName && (b?.driverId !== undefined || b?.driverName !== undefined);
    if (spell) {
      const out = localKey(collectedDate, collectedTime);
      const back = backChanged ? localKey(submittedDate!, submittedTime) : spell.returnedDate ? localKey(spell.returnedDate, spell.returnedTime) : null;
      if (back && out > back) {
        return NextResponse.json({ error: "The card can't come back before it was collected" }, { status: 400 });
      }
    }

    await db.update(psoCardIssues).set({
      vehicleId: b?.vehicleId !== undefined ? (b.vehicleId ? Number(b.vehicleId) : null) : before.vehicleId,
      driverId, driverName,
      collectedDate, collectedTime,
      submittedDate, submittedTime: submittedDate ? submittedTime : null,
      slipNo: b?.slipNo !== undefined ? String(b.slipNo).trim().slice(0, 40) : before.slipNo,
      amount: b?.amount !== undefined ? money(b.amount) : before.amount,
      notes: b?.notes !== undefined ? String(b.notes).trim() : before.notes,
    }).where(eq(psoCardIssues.id, id));

    if (spell && takenChanged) {
      await db.update(psoCardCustody).set({ takenDate: collectedDate, takenTime: collectedTime })
        .where(eq(psoCardCustody.id, spell.id));
      await db.update(psoCardIssues).set({ collectedDate, collectedTime })
        .where(eq(psoCardIssues.custodyId, spell.id));
      if (!spell.returnedDate) {
        await db.update(psoCards).set({ heldSince: collectedDate }).where(eq(psoCards.id, before.cardId));
      }
    }
    if (spell && backChanged) {
      await db.update(psoCardCustody).set({ returnedDate: submittedDate, returnedTime: submittedTime })
        .where(eq(psoCardCustody.id, spell.id));
      await db.update(psoCardIssues).set({ submittedDate, submittedTime })
        .where(eq(psoCardIssues.custodyId, spell.id));
    }
    if (spell && holderChanged) {
      await db.update(psoCardCustody).set({ holderId: driverId, holderName: driverName })
        .where(eq(psoCardCustody.id, spell.id));
      await db.update(psoCardIssues).set({ driverId, driverName })
        .where(eq(psoCardIssues.custodyId, spell.id));
      if (!spell.returnedDate) {
        await db.update(psoCards).set({ heldById: driverId, heldByName: driverName }).where(eq(psoCards.id, before.cardId));
      }
    }

    const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, before.cardId));
    await logActivity({
      user: guard, action: "station.card.edit",
      summary: `edited a fuel record on PSO card ${card?.sn ?? ""}`.trim(),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await ensureFleetSchema();
    const id = Number(idParam);
    const [row] = await db.select().from(psoCardIssues).where(eq(psoCardIssues.id, id));
    if (!row) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, row.cardId));
    await db.delete(psoCardIssues).where(eq(psoCardIssues.id, id));
    await logActivity({
      user: guard, action: "station.card.delete",
      summary: `deleted a fuel record on PSO card ${card?.sn ?? ""} dated ${row.collectedDate}`.trim(),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
