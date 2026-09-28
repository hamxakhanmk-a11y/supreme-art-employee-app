import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, fuelEntries, psoCardIssues, psoCards, vehicles } from "@/lib/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";

const MODULE = "station";

function hhmm(v: unknown): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  return /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, "0") : "";   // "" signals invalid
}
function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// Fuel drawn on a card is the same fuel the log book counts, so a submitted
// card writes the P.O.L. entry rather than being tallied separately. Rebuilt
// from the entry each time it changes — one place decides what the fuel row
// says, and it is this one.
async function syncFuelEntry(issueId: number) {
  const [i] = await db.select().from(psoCardIssues).where(eq(psoCardIssues.id, issueId));
  if (!i) return;

  const [existing] = await db.select({ id: fuelEntries.id }).from(fuelEntries)
    .where(eq(fuelEntries.cardIssueId, issueId)).limit(1);

  // Nothing to record until the card is back with an amount against it, and a
  // fuel entry needs a vehicle to belong to.
  const keep = i.submittedDate !== null && i.vehicleId !== null && (i.amount ?? 0) > 0;
  if (!keep) {
    if (existing) await db.delete(fuelEntries).where(eq(fuelEntries.id, existing.id));
    return;
  }

  const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, i.cardId));
  const litres = i.litres ?? 0;
  const values = {
    vehicleId: i.vehicleId!,
    date: i.submittedDate!,
    litres,
    // The slip states the rate; deriving it is only a fallback, and rupees
    // with no litres still record the cost — that month's km/litre average
    // simply doesn't count them.
    rate: i.rate ?? (litres > 0 ? Math.round((i.amount! / litres) * 100) / 100 : 0),
    amount: i.amount!,
    drawnById: i.driverId,
    vendor: `PSO card ${card?.sn ?? ""}`.trim(),
    notes: [i.slipNo ? `Slip ${i.slipNo}` : "", i.notes || ""].filter(Boolean).join(" · "),
    cardIssueId: issueId,
  };
  if (existing) await db.update(fuelEntries).set(values).where(eq(fuelEntries.id, existing.id));
  else await db.insert(fuelEntries).values(values);
}

// POST — a card goes out. { cardId, driverId?, driverName?, collectedDate,
// collectedTime?, notes? }
export async function POST(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const cardId = Number(b?.cardId);
    const collectedDate = String(b?.collectedDate || "");
    if (!cardId) return NextResponse.json({ error: "Pick a card" }, { status: 400 });
    if (!collectedDate) return NextResponse.json({ error: "Collection date is required" }, { status: 400 });
    const collectedTime = hhmm(b?.collectedTime);
    if (collectedTime === "") return NextResponse.json({ error: "Collection time must be HH:MM" }, { status: 400 });

    const [card] = await db.select().from(psoCards).where(eq(psoCards.id, cardId));
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    if (card.status === "blocked" || card.status === "lost") {
      return NextResponse.json({ error: `Card ${card.sn} is marked ${card.status}` }, { status: 400 });
    }

    const [out] = await db.select({ id: psoCardIssues.id }).from(psoCardIssues)
      .where(and(eq(psoCardIssues.cardId, cardId), isNull(psoCardIssues.submittedDate))).limit(1);
    if (out) return NextResponse.json({ error: `Card ${card.sn} is already out` }, { status: 409 });

    // Whose name goes on the row: an employee, or anything typed for someone
    // off the payroll — the same rule the vehicle's driver list follows.
    const driverId = b?.driverId ? Number(b.driverId) : null;
    let driverName = String(b?.driverName || "").trim();
    if (driverId) {
      const [e] = await db.select({ first: employees.firstName, last: employees.lastName })
        .from(employees).where(eq(employees.id, driverId));
      if (e) driverName = `${e.first} ${e.last}`.trim();
    }
    if (!driverName) return NextResponse.json({ error: "Who is taking the card?" }, { status: 400 });

    const [row] = await db.insert(psoCardIssues).values({
      cardId,
      // The card's own vehicle at the time it went out, so moving the card
      // later doesn't rewrite where this fuel was burned.
      vehicleId: b?.vehicleId ? Number(b.vehicleId) : card.vehicleId,
      driverId, driverName,
      collectedDate, collectedTime,
      notes: String(b?.notes || "").trim(),
    }).returning();

    await logActivity({
      user: guard, action: "station.card.out", employeeId: driverId ?? undefined, employeeName: driverName,
      summary: `took PSO card ${card.sn} on ${collectedDate}`,
    });
    return NextResponse.json(row);
  } catch (e: any) {
    if (String(e?.message || "").includes("pso_card_issues_open_key")) {
      return NextResponse.json({ error: "That card is already out" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — submit the card back, or correct a row. { id, submittedDate?,
// submittedTime?, amount?, litres?, ... }
export async function PUT(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const [before] = await db.select().from(psoCardIssues).where(eq(psoCardIssues.id, id));
    if (!before) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

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
      return NextResponse.json({ error: "A card can't be submitted before it was collected" }, { status: 400 });
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

    await db.update(psoCardIssues).set({
      vehicleId: b?.vehicleId !== undefined ? (b.vehicleId ? Number(b.vehicleId) : null) : before.vehicleId,
      driverId, driverName,
      collectedDate, collectedTime,
      submittedDate, submittedTime: submittedDate ? submittedTime : null,
      amount: b?.amount !== undefined ? num(b.amount) : before.amount,
      litres: b?.litres !== undefined ? num(b.litres) : before.litres,
      rate: b?.rate !== undefined ? num(b.rate) : before.rate,
      slipNo: b?.slipNo !== undefined ? String(b.slipNo).trim().slice(0, 40) : before.slipNo,
      notes: b?.notes !== undefined ? String(b.notes).trim() : before.notes,
    }).where(eq(psoCardIssues.id, id));

    await syncFuelEntry(id);

    const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, before.cardId));
    const submittedNow = !before.submittedDate && submittedDate;
    await logActivity({
      user: guard, action: submittedNow ? "station.card.in" : "station.card.edit",
      employeeId: driverId ?? undefined,
      summary: submittedNow
        ? `submitted PSO card ${card?.sn ?? ""} on ${submittedDate}${b?.amount ? ` — Rs ${num(b.amount)}` : ""}`.trim()
        : `edited a PSO card entry for ${card?.sn ?? ""}`.trim(),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/fleet/card-issues?id=4 — the fuel entry it created goes with it.
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await ensureFleetSchema();
    const id = Number(idParam);
    const [row] = await db.select().from(psoCardIssues).where(eq(psoCardIssues.id, id));
    if (!row) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    const [card] = await db.select({ sn: psoCards.sn }).from(psoCards).where(eq(psoCards.id, row.cardId));
    await db.delete(psoCardIssues).where(eq(psoCardIssues.id, id));
    await logActivity({
      user: guard, action: "station.card.delete",
      summary: `deleted a PSO card entry for ${card?.sn ?? ""} dated ${row.collectedDate}`.trim(),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
