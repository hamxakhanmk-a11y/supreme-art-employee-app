import { db } from "./db";
import { sql } from "drizzle-orm";
import { ensureFleetSchema } from "./fleet";

// A card's balance: its latest opening, plus the top-ups and minus the fuel
// records from that opening's date on. Worked out on every read rather than
// kept as a running total, so correcting or deleting a fill in the Cards
// Logbook, or a top-up on PSO Cards, corrects the balance with it.
//
// An opening is the balance at the start of its date — "as at 1 Oct" — however
// late it is typed in. So a top-up counts if it is dated on or after that day,
// and a fill if it was entered on or after it (a fill's own collection date is
// the card's hand-over, which can be weeks earlier). Before this, "after" was
// by when the opening was typed, and an opening back-dated to the 1st dropped
// every fill recorded between the 1st and the day it was typed.

const LOW_KEY = "pso_low_balance";
const LOW_DEFAULT = 5000;

const rowsOf = (res: unknown): any[] => (res as any).rows ?? (res as any);

// A month's consumption typed on the Monthly Report replaces what the card's fuel records add up to for
// that vehicle and month (a CEO's car has none). The card's balance has to follow it, or the card keeps
// money the sheet says was spent and next month opens on the wrong figure. What the typed figure adds
// over the card's own fuel records is taken off the vehicle's first card (negative if it is less).
// Months before the card's opening don't count. Worked out on every read, like the balance itself.
export type TypedAdjustment = { month: string; amount: number };
export async function typedAdjustments(): Promise<Map<number, TypedAdjustment[]>> {
  await ensureFleetSchema();
  const [notes, cards, opens, fills] = (await Promise.all([
    db.execute(sql`SELECT vehicle_id AS "vehicleId", month, consumption FROM fleet_month_notes WHERE consumption IS NOT NULL`),
    db.execute(sql`SELECT id, vehicle_id AS "vehicleId" FROM pso_cards WHERE vehicle_id IS NOT NULL ORDER BY id`),
    db.execute(sql`
      SELECT DISTINCT ON (card_id) card_id AS "cardId", date::text AS day
      FROM pso_card_topups WHERE kind = 'opening'
      ORDER BY card_id, date DESC, created_at DESC, id DESC`),
    db.execute(sql`
      SELECT card_id AS "cardId", amount, (created_at AT TIME ZONE 'Asia/Karachi')::date::text AS day
      FROM pso_card_issues WHERE amount IS NOT NULL`),
  ])).map(rowsOf);
  const openDay = new Map(opens.map(r => [Number(r.cardId), String(r.day)]));
  const out = new Map<number, TypedAdjustment[]>();
  for (const n of notes) {
    const month = String(n.month);
    // The vehicle's cards that have an opening in force by this month.
    const mine = cards.filter(c => Number(c.vehicleId) === Number(n.vehicleId) && openDay.has(Number(c.id)) && month >= openDay.get(Number(c.id))!.slice(0, 7));
    if (!mine.length) continue;
    const ids = new Set(mine.map(c => Number(c.id)));
    const cardsOwn = fills
      .filter(f => ids.has(Number(f.cardId)) && String(f.day).slice(0, 7) === month && String(f.day) >= openDay.get(Number(f.cardId))!)
      .reduce((s, f) => s + Number(f.amount), 0);
    const first = Number(mine[0].id);
    const list = out.get(first) ?? [];
    list.push({ month, amount: Number(n.consumption) - cardsOwn });
    out.set(first, list);
  }
  return out;
}

/** Balances of the given cards (all when omitted). A card with no opening is left out. */
export async function cardBalances(cardIds?: number[]): Promise<Map<number, number>> {
  await ensureFleetSchema();
  if (cardIds && cardIds.length === 0) return new Map();
  const only = cardIds ? sql`AND card_id IN (${sql.join(cardIds.map(id => sql`${id}`), sql`, `)})` : sql``;
  const res = await db.execute(sql`
    WITH o AS (
      SELECT DISTINCT ON (card_id) card_id, amount, date
      FROM pso_card_topups
      WHERE kind = 'opening' ${only}
      ORDER BY card_id, date DESC, created_at DESC, id DESC
    )
    SELECT o.card_id AS "cardId",
           ROUND((o.amount
           + COALESCE((SELECT SUM(t.amount) FROM pso_card_topups t
                       WHERE t.card_id = o.card_id AND t.kind = 'topup' AND t.date >= o.date), 0)
           - COALESCE((SELECT SUM(i.amount) FROM pso_card_issues i
                       WHERE i.card_id = o.card_id AND i.amount IS NOT NULL
                         AND (i.created_at AT TIME ZONE 'Asia/Karachi')::date >= o.date), 0)
           )::numeric, 2) AS balance
    FROM o
  `);
  const adj = await typedAdjustments();
  return new Map(rowsOf(res).map(r => {
    const typed = (adj.get(Number(r.cardId)) ?? []).reduce((s, a) => s + a.amount, 0);
    return [Number(r.cardId), Math.round((Number(r.balance) - typed) * 100) / 100] as [number, number];
  }));
}

export async function cardBalance(cardId: number): Promise<number | null> {
  return (await cardBalances([cardId])).get(cardId) ?? null;
}

export async function lowBalanceLevel(): Promise<number> {
  await ensureFleetSchema();
  const res = await db.execute(sql`SELECT value FROM fleet_settings WHERE key = ${LOW_KEY}`);
  const n = Number(rowsOf(res)[0]?.value);
  return Number.isFinite(n) && n >= 0 ? n : LOW_DEFAULT;
}

export async function setLowBalanceLevel(n: number): Promise<void> {
  await ensureFleetSchema();
  await db.execute(sql`
    INSERT INTO fleet_settings (key, value) VALUES (${LOW_KEY}, ${String(n)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
}
