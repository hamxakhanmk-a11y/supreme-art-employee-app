import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { psoCardIssues, psoCards, vehicles } from "@/lib/schema";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureFleetSchema } from "@/lib/fleet";

const MODULE = "station";
const STATUSES = new Set(["in_use", "spare", "blocked", "lost"]);

function normalizeStatus(v: unknown): string {
  const s = String(v || "in_use");
  return STATUSES.has(s) ? s : "in_use";
}

// GET /api/fleet/cards — every card, with the vehicle it belongs to and
// whether it's out with someone right now.
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const rows = await db.select({
      id: psoCards.id, sn: psoCards.sn, vehicleId: psoCards.vehicleId,
      status: psoCards.status, notes: psoCards.notes,
      vehicleNo: vehicles.vehicleNo,
    }).from(psoCards)
      .leftJoin(vehicles, eq(vehicles.id, psoCards.vehicleId))
      .orderBy(asc(psoCards.sn));

    const open = await db.select({
      cardId: psoCardIssues.cardId,
      driverName: psoCardIssues.driverName,
      collectedDate: psoCardIssues.collectedDate,
    }).from(psoCardIssues).where(isNull(psoCardIssues.submittedDate));
    const openBy = new Map(open.map(o => [o.cardId, o]));

    return NextResponse.json(rows.map(r => ({
      ...r,
      vehicleNo: r.vehicleNo ?? null,
      out: openBy.get(r.id)
        ? { driver: openBy.get(r.id)!.driverName || "—", since: openBy.get(r.id)!.collectedDate }
        : null,
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const sn = String(b?.sn || "").trim();
    if (!sn) return NextResponse.json({ error: "Card SN is required" }, { status: 400 });

    const dup = await db.execute(sql`SELECT sn FROM pso_cards WHERE LOWER(sn) = LOWER(${sn}) LIMIT 1`);
    const dups: any[] = (dup as any).rows ?? (dup as any);
    if (dups.length) return NextResponse.json({ error: `Card ${dups[0].sn} is already on the list` }, { status: 409 });

    const [row] = await db.insert(psoCards).values({
      sn,
      vehicleId: b?.vehicleId ? Number(b.vehicleId) : null,
      status: normalizeStatus(b?.status),
      notes: String(b?.notes || "").trim(),
    }).returning();
    await logActivity({ user: guard, action: "station.card.add", summary: `added PSO card ${sn}` });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardWrite(MODULE);
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureFleetSchema();
    const b = await req.json().catch(() => ({}));
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const sn = String(b?.sn || "").trim();
    if (!sn) return NextResponse.json({ error: "Card SN is required" }, { status: 400 });

    const [before] = await db.select().from(psoCards).where(eq(psoCards.id, id));
    if (!before) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    const dup = await db.execute(sql`
      SELECT id FROM pso_cards WHERE LOWER(sn) = LOWER(${sn}) AND id <> ${id} LIMIT 1
    `);
    const dups: any[] = (dup as any).rows ?? (dup as any);
    if (dups.length) return NextResponse.json({ error: `Another card is already ${sn}` }, { status: 409 });

    const vehicleId = b?.vehicleId ? Number(b.vehicleId) : null;
    const status = normalizeStatus(b?.status);

    // A card in someone's hands can't be moved or written off underneath them
    // — the open entry would end up pointing at the wrong vehicle.
    if ((vehicleId !== before.vehicleId || status !== before.status)) {
      const [out] = await db.select({ id: psoCardIssues.id }).from(psoCardIssues)
        .where(sql`${psoCardIssues.cardId} = ${id} AND ${psoCardIssues.submittedDate} IS NULL`).limit(1);
      if (out) {
        return NextResponse.json({
          error: "This card is out with a driver — take it back in on the PSO Cards tab first.",
        }, { status: 400 });
      }
    }

    await db.update(psoCards).set({
      sn, vehicleId, status, notes: String(b?.notes || "").trim(),
    }).where(eq(psoCards.id, id));

    const moved = vehicleId !== before.vehicleId;
    await logActivity({
      user: guard, action: "station.card.edit",
      summary: moved ? `moved PSO card ${sn} to another vehicle` : `edited PSO card ${sn}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/fleet/cards?id=4 — only a card with no history behind it.
// Anything that has been out is marked lost or blocked instead, so the
// register it appears in keeps making sense.
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("station.delete");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await ensureFleetSchema();
    const id = Number(idParam);
    const [card] = await db.select().from(psoCards).where(eq(psoCards.id, id));
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    const [used] = await db.select({ id: psoCardIssues.id }).from(psoCardIssues)
      .where(eq(psoCardIssues.cardId, id)).limit(1);
    if (used) {
      return NextResponse.json({
        error: "This card has entries in the register. Mark it blocked or lost instead of deleting it.",
      }, { status: 400 });
    }

    await db.delete(psoCards).where(eq(psoCards.id, id));
    await logActivity({ user: guard, action: "station.card.delete", summary: `deleted PSO card ${card.sn}` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
