import { db } from "./db";
import { sql } from "drizzle-orm";
import { ensureFleetSchema } from "./fleet";

// A card's balance: its newest opening, plus the top-ups and minus the fuel
// records entered after it. Worked out on every read rather than kept as a
// running total, so correcting or deleting a fill in the Cards Logbook, or a
// top-up on PSO Cards, corrects the balance with it. "After" is by when a row
// was entered (created_at): fuel typed in before the opening was counted is
// already inside the opening figure.

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
      SELECT DISTINCT ON (card_id) card_id, amount, created_at
      FROM pso_card_topups
      WHERE kind = 'opening' ${only}
      ORDER BY card_id, created_at DESC, id DESC
    )
    SELECT o.card_id AS "cardId",
           o.amount
           + COALESCE((SELECT SUM(t.amount) FROM pso_card_topups t
                       WHERE t.card_id = o.card_id AND t.kind = 'topup' AND t.created_at > o.created_at), 0)
           - COALESCE((SELECT SUM(i.amount) FROM pso_card_issues i
                       WHERE i.card_id = o.card_id AND i.amount IS NOT NULL AND i.created_at > o.created_at), 0)
           AS balance
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
