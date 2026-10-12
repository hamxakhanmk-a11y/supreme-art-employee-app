import { db } from "./db";
import { sql } from "drizzle-orm";
import { ensureFleetSchema, VEHICLE_TYPE_LABEL } from "./fleet";

// The monthly fleet sheet (Fleet Management — Log Book Details): per vehicle,
// what was on its PSO card at the start of the month, what was loaded, what
// was drawn, what is left, and how far it went.
//
// The money follows the same rule as the live balance (lib/cardBalance.ts):
// from a card's opening, count what was entered after it. Each entry then
// lands in a month — a top-up by the date written on it, a fill by the day it
// was entered. A fill's own "collection date" is when the card was handed
// out, which can be weeks before the fuel was drawn, so it can't place a fill.
// For the current month the closing figure is the balance PSO Cards shows.

export type FleetMonthRow = {
  vehicleId: number | null;     // null: a card with no vehicle
  vehicleNo: string;
  vehicleType: string;
  opening: number | null;       // null until the card's opening balance is set
  topup: number;
  consumption: number;
  km: number;
  closing: number | null;
  openedOn: string | null;      // when the opening was set inside this month
};
export type FleetMonth = {
  month: string;
  rows: FleetMonthRow[];
  totals: { opening: number; topup: number; consumption: number; km: number; closing: number };
};

const rowsOf = (res: unknown): any[] => (res as any).rows ?? (res as any);
const money = (n: number) => Math.round(n * 100) / 100;

function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export async function fleetMonth(month: string): Promise<FleetMonth> {
  await ensureFleetSchema();
  const start = `${month}-01`;
  const end = nextMonthStart(month);   // exclusive

  const [vehicleRes, cardRes, moneyRes, fillRes, kmRes] = await Promise.all([
    db.execute(sql`SELECT id, vehicle_no AS "vehicleNo", COALESCE(name, '') AS name, type, active FROM vehicles ORDER BY vehicle_no`),
    db.execute(sql`SELECT id, sn, vehicle_id AS "vehicleId" FROM pso_cards ORDER BY sn`),
    db.execute(sql`
      SELECT card_id AS "cardId", kind, date::text AS day, amount, EXTRACT(EPOCH FROM created_at) AS at
      FROM pso_card_topups WHERE date < ${end}::date
    `),
    db.execute(sql`
      SELECT card_id AS "cardId", amount, (created_at AT TIME ZONE 'Asia/Karachi')::date::text AS day,
             EXTRACT(EPOCH FROM created_at) AS at
      FROM pso_card_issues
      WHERE amount IS NOT NULL AND (created_at AT TIME ZONE 'Asia/Karachi')::date < ${end}::date
    `),
    db.execute(sql`
      SELECT vehicle_id AS "vehicleId", COALESCE(SUM(km_covered), 0) AS km
      FROM fleet_trips WHERE date >= ${start}::date AND date < ${end}::date
      GROUP BY vehicle_id
    `),
  ]);

  type Entry = { cardId: number; day: string; amount: number; at: number };
  const entries = rowsOf(moneyRes).map(r => ({ cardId: Number(r.cardId), kind: String(r.kind), day: String(r.day), amount: Number(r.amount), at: Number(r.at) }));
  const openings = entries.filter(e => e.kind === "opening");
  const topups: Entry[] = entries.filter(e => e.kind === "topup");
  const fills: Entry[] = rowsOf(fillRes).map(r => ({ cardId: Number(r.cardId), day: String(r.day), amount: Number(r.amount), at: Number(r.at) }));
  const kmBy = new Map(rowsOf(kmRes).map(r => [Number(r.vehicleId), Number(r.km)]));

  // One card's month.
  const cardMonth = (cardId: number) => {
    const sum = (list: Entry[], keep: (e: Entry) => boolean) =>
      list.filter(e => e.cardId === cardId && keep(e)).reduce((s, e) => s + e.amount, 0);
    const inMonth = (e: Entry) => e.day >= start;
    // The opening in force: the one entered last, of those dated by month end.
    const o = openings.filter(e => e.cardId === cardId).sort((a, b) => b.at - a.at)[0];
    if (!o) {
      return { opening: null, topup: sum(topups, inMonth), consumption: sum(fills, inMonth), closing: null, openedOn: null };
    }
    const after = (e: Entry) => e.at > o.at;
    const openedHere = o.day >= start;
    const opening = openedHere
      ? o.amount
      : o.amount + sum(topups, e => after(e) && e.day < start) - sum(fills, e => after(e) && e.day < start);
    const topup = sum(topups, e => after(e) && inMonth(e));
    const consumption = sum(fills, e => after(e) && inMonth(e));
    return { opening, topup, consumption, closing: opening + topup - consumption, openedOn: openedHere ? o.day : null };
  };

  const cards = rowsOf(cardRes).map(r => ({ id: Number(r.id), sn: String(r.sn), vehicleId: r.vehicleId === null ? null : Number(r.vehicleId) }));
  const rows: FleetMonthRow[] = [];

  for (const v of rowsOf(vehicleRes)) {
    const id = Number(v.id);
    const parts = cards.filter(c => c.vehicleId === id).map(c => cardMonth(c.id));
    const km = kmBy.get(id) ?? 0;
    const topup = parts.reduce((s, p) => s + p.topup, 0);
    const consumption = parts.reduce((s, p) => s + p.consumption, 0);
    // A retired vehicle only appears in a month it was used in.
    if (!v.active && !km && !topup && !consumption) continue;
    // Known only when every card on the vehicle has its opening set.
    const known = parts.length > 0 && parts.every(p => p.opening !== null);
    rows.push({
      vehicleId: id,
      vehicleNo: String(v.vehicleNo),
      vehicleType: String(v.name).trim() || VEHICLE_TYPE_LABEL[String(v.type)] || String(v.type),
      opening: known ? money(parts.reduce((s, p) => s + (p.opening ?? 0), 0)) : null,
      topup: money(topup),
      consumption: money(consumption),
      km,
      closing: known ? money(parts.reduce((s, p) => s + (p.closing ?? 0), 0)) : null,
      openedOn: parts.map(p => p.openedOn).filter(Boolean).sort().pop() ?? null,
    });
  }

  // A card on no vehicle still holds money; it gets a row once it has any.
  for (const c of cards.filter(c => c.vehicleId === null)) {
    const p = cardMonth(c.id);
    if (p.opening === null && !p.topup && !p.consumption) continue;
    rows.push({
      vehicleId: null, vehicleNo: c.sn, vehicleType: "No vehicle",
      opening: p.opening === null ? null : money(p.opening),
      topup: money(p.topup), consumption: money(p.consumption), km: 0,
      closing: p.closing === null ? null : money(p.closing),
      openedOn: p.openedOn,
    });
  }

  const total = (pick: (r: FleetMonthRow) => number | null) => money(rows.reduce((s, r) => s + (pick(r) ?? 0), 0));
  return {
    month,
    rows,
    totals: {
      opening: total(r => r.opening), topup: total(r => r.topup), consumption: total(r => r.consumption),
      km: rows.reduce((s, r) => s + r.km, 0), closing: total(r => r.closing),
    },
  };
}
