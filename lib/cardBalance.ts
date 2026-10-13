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
  return new Map(rowsOf(res).map(r => [Number(r.cardId), Number(r.balance)]));
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
