# PSO Card Top-ups and Balances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record money loaded onto each PSO card, show every card's balance (opening + top-ups − fuel), and warn at the station when a card runs low.

**Architecture:** One new table of top-ups (opening balances and recharges) and one key/value settings table, both created in the existing self-migrating `ensureFleetSchema()`. Balances are computed on read by a single SQL query in a new server module `lib/cardBalance.ts`; a client-safe `lib/pso.ts` holds the colouring rule. Office entry lives on PSO Cards → All cards; the station terminal only reads balances.

**Tech Stack:** Next.js 16 app router (route handlers + client components), Drizzle ORM over Neon Postgres, raw `sql` for the balance query. Tests run against PGlite (in-memory Postgres) through an esbuild bundle in the session scratchpad — the repo has no test runner.

**Spec:** `docs/superpowers/specs/2026-10-12-pso-card-topups-design.md`

## Global Constraints

- Balance = current opening amount + Σ top-ups entered after it − Σ fuel records (`pso_card_issues.amount`) entered after it; "after" is by `created_at`.
- A card with no opening row has no balance (`null`, shown "—"); a `topup` on such a card is refused with 409.
- Low level: one value for all cards, key `pso_low_balance`, default **5000** when unset.
- Colour: `balance ≤ 0` red, `0 < balance < low` amber, otherwise normal; `null` grey.
- The station never blocks a fill or a hand-over because of the balance.
- Top-ups are entered only on Station → PSO Cards → All cards (permission `station`); deleting one needs `station.delete`.
- Schema changes go in `ensureFleetSchema()`: new tables via `CREATE TABLE IF NOT EXISTS`; any column on an existing table via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`; everything inside the one `DO $$ … END $$` block (Neon HTTP refuses multi-statement queries).
- Money shown as `Rs 12,400` (`toLocaleString("en-PK")`).

## Review Focus

1. **Opening entered twice (a recount)** — the newest opening wins; fuel and top-ups before it stop counting. Test in Task 1.
2. **Fuel record edited or deleted in the Cards Logbook after the opening** — balance moves by the difference immediately. Test in Task 1.
3. **Zero or negative amount typed** — a top-up must be > 0, an opening ≥ 0; anything else 400. Test in Task 2.
4. **Deleting a card that has top-ups but no fuel records** — refused, like a card with fuel records, so its money history isn't lost silently. Test in Task 2.
5. **Station lookup for a vehicle whose card has no opening** — terminal shows no balance line and still works. Test in Task 4.

---

## Test harness (used by Tasks 1, 2 and 4)

Lives in the session scratchpad, not the repo:
`S=C:/Users/DELLXP~1/AppData/Local/Temp/claude/C--Users-Dell-XPS-supreme-art-apps-supreme-art-employee/d2c608d1-7ff4-4616-acca-2b770458ad33/scratchpad/pg`

Already present there: `node_modules/@electric-sql/pglite`, `db-shim.ts` (exports `pg` and a Drizzle `db` over PGlite), `auth-shim.ts` (`guardWrite`, `guardAuth` return a superadmin), `activity-shim.ts` (no-op `logActivity`), and `build.js`, which bundles `$S/test.ts` with `@/lib/db`, `@/lib/auth`, `@/lib/activity` (and their relative imports) swapped for the shims.

Run a test file: copy it to `$S/test.ts`, then

```bash
cd "$S" && timeout 100 node build.js </dev/null && timeout 100 node test.js </dev/null
```

Each test file starts with this preamble (referred to below as **PREAMBLE** — paste it verbatim):

```ts
import { NextRequest } from "next/server";
import { pg } from "@/lib/db";
import { ensureFleetSchema } from "@/lib/fleet";
let fails = 0;
const check = (label: string, cond: boolean, extra?: unknown) => {
  console.log((cond ? "PASS " : "FAIL ") + label, cond ? "" : JSON.stringify(extra));
  if (!cond) fails++;
};
const q = async (s: string) => (await pg.query(s)).rows as any[];
const req = (url: string, method: string, body?: unknown) =>
  new NextRequest("http://x" + url, { method, body: body ? JSON.stringify(body) : undefined, headers: { "Content-Type": "application/json" } });
async function setup() {
  await pg.exec(`CREATE TABLE employees (id serial PRIMARY KEY, employee_id text, first_name text, last_name text, status text DEFAULT 'active', station_pin text);
                 INSERT INTO employees (employee_id, first_name, last_name) VALUES ('SAPL-1','Fazal','Rabi');`);
  await ensureFleetSchema();
  await pg.exec(`INSERT INTO vehicles (vehicle_no, name, type, pin) VALUES ('JA-9370','Changan','car','9370');
                 INSERT INTO pso_cards (sn, vehicle_id) VALUES ('JA9370', 1), ('SPARE', NULL);`);
}
const done = () => { console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0); };
```

`created_at` ordering matters to the balance rule, so tests that need "before/after" set it explicitly with `UPDATE … SET created_at = now() - interval '…'`.

---

### Task 1: Tables and the balance rule

**Files:**
- Modify: `lib/fleet.ts` (inside the `DO $$` block, after the `pso_card_custody` statements)
- Modify: `lib/schema.ts` (after `psoCardIssues`)
- Create: `lib/cardBalance.ts`
- Create: `lib/pso.ts`
- Test: `$S/test.ts` (scratchpad)

**Interfaces:**
- Produces (server, `lib/cardBalance.ts`):
  - `cardBalances(cardIds?: number[]): Promise<Map<number, number>>` — only cards that have an opening appear in the map.
  - `cardBalance(cardId: number): Promise<number | null>`
  - `lowBalanceLevel(): Promise<number>`
  - `setLowBalanceLevel(n: number): Promise<void>`
- Produces (client-safe, `lib/pso.ts`):
  - `type BalanceState = "none" | "red" | "amber" | "ok"`
  - `balanceState(balance: number | null | undefined, low: number): BalanceState`
  - `BALANCE_COLOR: Record<BalanceState, string>`
  - `rs(n: number): string` → `"Rs 12,400"`
- Produces (schema): `psoCardTopups`, `fleetSettings` Drizzle tables.

- [ ] **Step 1: Write the failing test** — `$S/test.ts`:

```ts
// PREAMBLE here
import { cardBalances, cardBalance, lowBalanceLevel, setLowBalanceLevel } from "@/lib/cardBalance";
import { balanceState } from "@/lib/pso";
(async () => {
  await setup();
  await ensureFleetSchema();   // second run must be a no-op
  // A fill before any opening: no balance yet.
  await pg.exec(`INSERT INTO pso_card_issues (card_id, driver_name, collected_date, amount, created_at)
                 VALUES (1, 'Fazal Rabi', '2026-10-01', 3000, now() - interval '3 days');`);
  check("no opening → no balance", (await cardBalance(1)) === null);
  check("map leaves out cards with no opening", !(await cardBalances()).has(1));

  await pg.exec(`INSERT INTO pso_card_topups (card_id, kind, date, amount, created_at)
                 VALUES (1, 'opening', '2026-10-10', 20000, now() - interval '2 days');`);
  check("opening only; earlier fill ignored", (await cardBalance(1)) === 20000, await cardBalance(1));

  await pg.exec(`INSERT INTO pso_card_topups (card_id, kind, date, amount, created_at)
                 VALUES (1, 'topup', '2026-10-11', 10000, now() - interval '1 day');
                 INSERT INTO pso_card_issues (card_id, driver_name, collected_date, amount)
                 VALUES (1, 'Fazal Rabi', '2026-10-11', 6000), (1, 'Fazal Rabi', '2026-10-11', 2500);`);
  check("opening + top-up − later fills", (await cardBalance(1)) === 21500, await cardBalance(1));

  await pg.exec(`UPDATE pso_card_issues SET amount = 1500 WHERE amount = 2500;`);
  check("edited fill moves the balance", (await cardBalance(1)) === 22500, await cardBalance(1));
  await pg.exec(`DELETE FROM pso_card_issues WHERE amount = 1500;`);
  check("deleted fill moves the balance", (await cardBalance(1)) === 24000, await cardBalance(1));

  // A recount: a newer opening replaces everything before it.
  await pg.exec(`INSERT INTO pso_card_topups (card_id, kind, date, amount) VALUES (1, 'opening', '2026-10-12', 9000);`);
  check("newest opening wins", (await cardBalance(1)) === 9000, await cardBalance(1));

  check("default low level is 5000", (await lowBalanceLevel()) === 5000);
  await setLowBalanceLevel(8000);
  check("low level saved", (await lowBalanceLevel()) === 8000);
  await setLowBalanceLevel(7000);
  check("low level overwritten", (await lowBalanceLevel()) === 7000);

  check("state none", balanceState(null, 5000) === "none");
  check("state red at 0", balanceState(0, 5000) === "red");
  check("state red below 0", balanceState(-10, 5000) === "red");
  check("state amber", balanceState(4999, 5000) === "amber");
  check("state ok at level", balanceState(5000, 5000) === "ok");
  done();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: the harness command above. Expected: build error `Could not resolve "@/lib/cardBalance"`.

- [ ] **Step 3: Add the tables to `ensureFleetSchema()`** — in `lib/fleet.ts`, directly after the `UPDATE pso_card_issues i SET custody_id …` statements and before `ALTER TABLE vehicle_drivers ALTER COLUMN vehicle_id DROP NOT NULL;`:

```sql
  -- Money loaded onto a card. 'opening' is the balance typed in when a card's
  -- money is first (or again) counted; 'topup' is a recharge. A card's balance
  -- runs from its newest opening — see lib/cardBalance.ts.
  CREATE TABLE IF NOT EXISTS pso_card_topups (
    id serial PRIMARY KEY,
    card_id integer NOT NULL REFERENCES pso_cards(id) ON DELETE CASCADE,
    kind varchar(10) NOT NULL,
    date date NOT NULL,
    amount double precision NOT NULL,
    ref_no varchar(60),
    created_by varchar(120),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS pso_card_topups_card_idx ON pso_card_topups (card_id, created_at);
  -- Settings for the fleet screens, one row per key. pso_low_balance: the
  -- balance under which a card is flagged at the station.
  CREATE TABLE IF NOT EXISTS fleet_settings (
    key varchar(60) PRIMARY KEY,
    value text NOT NULL
  );
```

- [ ] **Step 4: Add the Drizzle tables** — in `lib/schema.ts`, after the `psoCardIssues` table:

```ts
// Money loaded onto a PSO card: an opening balance or a recharge. The card's
// balance is worked out from these and its fuel records (lib/cardBalance.ts),
// never stored.
export const psoCardTopups = pgTable("pso_card_topups", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => psoCards.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 10 }).notNull(),            // opening | topup
  date: date("date").notNull(),
  amount: doublePrecision("amount").notNull(),
  refNo: varchar("ref_no", { length: 60 }),
  createdBy: varchar("created_by", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Fleet screen settings, key → value. pso_low_balance: rupees.
export const fleetSettings = pgTable("fleet_settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: text("value").notNull(),
});
```

- [ ] **Step 5: Write `lib/pso.ts`** (client-safe — no db import):

```ts
// What a PSO card's balance means at a glance. Shared by the PSO Cards page
// and the station terminal, so a card reads the same colour in both.

export type BalanceState = "none" | "red" | "amber" | "ok";

export function balanceState(balance: number | null | undefined, low: number): BalanceState {
  if (balance === null || balance === undefined) return "none";
  if (balance <= 0) return "red";
  if (balance < low) return "amber";
  return "ok";
}

export const BALANCE_COLOR: Record<BalanceState, string> = {
  none: "var(--text3)",
  red: "#DC2626",
  amber: "#B45309",
  ok: "var(--text)",
};

export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
```

- [ ] **Step 6: Write `lib/cardBalance.ts`:**

```ts
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
```

- [ ] **Step 7: Run the test to verify it passes**

Run: the harness command. Expected: every line `PASS`, last line `ALL PASSED`.

- [ ] **Step 8: Type-check and commit**

```bash
npx tsc --noEmit -p .
git add lib/fleet.ts lib/schema.ts lib/cardBalance.ts lib/pso.ts
git commit -m "PSO cards: top-ups table, settings, and the balance rule"
```

---

### Task 2: Top-up and settings APIs; balances on the cards list

**Files:**
- Create: `app/api/fleet/topups/route.ts`
- Create: `app/api/fleet/settings/route.ts`
- Modify: `app/api/fleet/cards/route.ts` (GET adds `balance` + `lowLevel`; DELETE refuses a card with top-ups)
- Modify: `app/api/fleet/card-issues/route.ts` (POST response adds `balance`, `lowLevel`)
- Test: `$S/test.ts`

**Interfaces:**
- Consumes: `cardBalances`, `cardBalance`, `lowBalanceLevel`, `setLowBalanceLevel` (Task 1); `psoCardTopups` (Task 1).
- Produces:
  - `GET /api/fleet/cards` → `{ cards: Card[], lowLevel: number }` where each card also has `balance: number | null`. **Shape change** — the body was a bare array; callers updated in Task 3 (`CardsPanel.tsx`, `PsoCardsClient.tsx`).
  - `GET /api/fleet/topups?cardId=N` → `Topup[]`, newest first; `Topup = { id, cardId, kind: "opening"|"topup", date: string, amount: number, refNo: string, createdBy: string, createdAt: string }`.
  - `POST /api/fleet/topups` `{ cardId, kind, date, amount, refNo? }` → `{ topup: Topup, balance: number | null }`.
  - `PUT /api/fleet/topups` `{ id, date?, amount?, refNo? }` → `{ ok: true, balance }`.
  - `DELETE /api/fleet/topups?id=N` → `{ ok: true, balance }` (guard `station.delete`).
  - `PUT /api/fleet/settings` `{ lowBalance }` → `{ ok: true, lowLevel }`.
  - `POST /api/fleet/card-issues` → existing row fields plus `balance: number | null`, `lowLevel: number`.

- [ ] **Step 1: Write the failing test** — `$S/test.ts`:

```ts
// PREAMBLE here
import * as topups from "@/app/api/fleet/topups/route";
import * as settings from "@/app/api/fleet/settings/route";
import * as cards from "@/app/api/fleet/cards/route";
import * as issues from "@/app/api/fleet/card-issues/route";
const json = async (r: Response) => ({ status: r.status, body: await r.json() });
(async () => {
  await setup();
  const early = await json(await topups.POST(req("/api/fleet/topups", "POST", { cardId: 1, kind: "topup", date: "2026-10-12", amount: 5000 })));
  check("top-up refused before an opening", early.status === 409, early);

  const bad = await json(await topups.POST(req("/api/fleet/topups", "POST", { cardId: 1, kind: "opening", date: "2026-10-12", amount: -1 })));
  check("negative opening refused", bad.status === 400, bad);
  const zeroTop = await json(await topups.POST(req("/api/fleet/topups", "POST", { cardId: 1, kind: "topup", date: "2026-10-12", amount: 0 })));
  check("zero top-up refused", zeroTop.status === 400 || zeroTop.status === 409, zeroTop);

  const open = await json(await topups.POST(req("/api/fleet/topups", "POST", { cardId: 1, kind: "opening", date: "2026-10-12", amount: 20000, refNo: "count" })));
  check("opening saved", open.status === 200 && open.body.balance === 20000, open);
  await pg.exec(`UPDATE pso_card_topups SET created_at = now() - interval '1 hour'`);

  const top = await json(await topups.POST(req("/api/fleet/topups", "POST", { cardId: 1, kind: "topup", date: "2026-10-12", amount: 10000, refNo: "R-77" })));
  check("top-up saved, balance up", top.status === 200 && top.body.balance === 30000 && top.body.topup.refNo === "R-77", top);

  const fill = await json(await issues.POST(req("/api/fleet/card-issues", "POST", { cardId: 1, collectedDate: "2026-10-12", amount: "6000" })));
  check("fill response carries the new balance", fill.status === 200 && fill.body.balance === 24000 && fill.body.lowLevel === 5000, fill);

  const fix = await json(await topups.PUT(req("/api/fleet/topups", "PUT", { id: top.body.topup.id, amount: 12000 })));
  check("top-up corrected", fix.status === 200 && fix.body.balance === 26000, fix);

  const hist = await json(await topups.GET(req("/api/fleet/topups?cardId=1", "GET")));
  check("history newest first", hist.status === 200 && hist.body.length === 2 && hist.body[0].kind === "topup", hist);

  const low = await json(await settings.PUT(req("/api/fleet/settings", "PUT", { lowBalance: 30000 })));
  check("low level saved", low.status === 200 && low.body.lowLevel === 30000, low);
  const badLow = await json(await settings.PUT(req("/api/fleet/settings", "PUT", { lowBalance: "abc" })));
  check("bad low level refused", badLow.status === 400, badLow);

  const list = await json(await cards.GET());
  const c1 = list.body.cards.find((c: any) => c.id === 1), c2 = list.body.cards.find((c: any) => c.id === 2);
  check("cards list has balances + low level", c1.balance === 26000 && c2.balance === null && list.body.lowLevel === 30000, list.body);

  const del = await json(await topups.DELETE(req(`/api/fleet/topups?id=${top.body.topup.id}`, "DELETE")));
  check("top-up deleted, balance down", del.status === 200 && del.body.balance === 14000, del);

  // A card with only top-ups (no fuel) still can't be deleted.
  await pg.exec(`INSERT INTO pso_card_topups (card_id, kind, date, amount) VALUES (2, 'opening', '2026-10-12', 1000)`);
  const delCard = await json(await cards.DELETE(req("/api/fleet/cards?id=2", "DELETE")));
  check("card with top-ups not deleted", delCard.status === 400, delCard);
  done();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Expected: build error `Could not resolve "@/app/api/fleet/topups/route"`.

- [ ] **Step 3: Write `app/api/fleet/topups/route.ts`:**

```ts
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
```

- [ ] **Step 4: Write `app/api/fleet/settings/route.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { setLowBalanceLevel } from "@/lib/cardBalance";

// PUT { lowBalance } — the balance under which a PSO card is flagged.
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const n = Number(b?.lowBalance);
    if (b?.lowBalance === "" || b?.lowBalance === null || !Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Enter the low-balance amount in rupees" }, { status: 400 });
    }
    const level = Math.round(n);
    await setLowBalanceLevel(level);
    await logActivity({ user: guard, action: "station.card.lowlevel", summary: `set the PSO card low-balance warning to Rs ${level}` });
    return NextResponse.json({ ok: true, lowLevel: level });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Cards list carries balances** — in `app/api/fleet/cards/route.ts` add the import `import { cardBalances, lowBalanceLevel } from "@/lib/cardBalance";` and `psoCardTopups` to the schema import, then replace the GET's `return NextResponse.json(rows.map(r => ({ … })));` with:

```ts
    const [balances, lowLevel] = await Promise.all([cardBalances(), lowBalanceLevel()]);
    return NextResponse.json({
      lowLevel,
      cards: rows.map(r => ({
        ...r,
        vehicleNo: r.vehicleNo ?? null,
        vehiclePin: r.vehiclePin ?? null,
        balance: balances.get(r.id) ?? null,
        out: r.heldByName ? { driver: r.heldByName, since: r.heldSince } : null,
      })),
    });
```

In its DELETE, after the `used` check, add:

```ts
    // Money loaded onto it is history too.
    const [loaded] = await db.select({ id: psoCardTopups.id }).from(psoCardTopups)
      .where(eq(psoCardTopups.cardId, id)).limit(1);
    if (loaded) {
      return NextResponse.json({
        error: "This card has top-ups recorded. Mark it blocked or lost instead of deleting it.",
      }, { status: 400 });
    }
```

- [ ] **Step 6: Fill response carries the balance** — in `app/api/fleet/card-issues/route.ts` add `import { cardBalance, lowBalanceLevel } from "@/lib/cardBalance";` and replace the POST's final `return NextResponse.json(row);` with:

```ts
    // The terminal shows what is left on the card once the fill is in.
    const [balance, lowLevel] = await Promise.all([cardBalance(cardId), lowBalanceLevel()]);
    return NextResponse.json({ ...row, balance, lowLevel });
```

- [ ] **Step 7: Run the test** — expected `ALL PASSED`.

- [ ] **Step 8: Type-check and commit**

```bash
npx tsc --noEmit -p .
git add app/api/fleet/topups app/api/fleet/settings app/api/fleet/cards/route.ts app/api/fleet/card-issues/route.ts
git commit -m "PSO cards: top-up and low-balance APIs, balances on the cards list"
```

(Type-check will flag `CardsPanel.tsx` / `PsoCardsClient.tsx` only at runtime, not compile time, since they parse JSON untyped — Task 3 updates them before anything ships.)

---

### Task 3: All cards — balance column, low level, top-up form, history

**Files:**
- Modify: `app/station/pso/CardsPanel.tsx`
- Modify: `app/station/pso/PsoCardsClient.tsx` (its `load()` reads the new `{ cards, lowLevel }` shape)
- Create: `app/station/pso/TopupHistory.tsx`
- Test: browser harness in `$T=…/scratchpad/tabs` (mocked `fetch`)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/fleet/topups`, `PUT /api/fleet/settings`, `GET /api/fleet/cards` → `{ cards, lowLevel }` (Task 2); `balanceState`, `BALANCE_COLOR`, `rs` (Task 1); `EditCell` (`app/station/EditCell.tsx`: `value`, `onSave(next) => Promise<boolean>`, `type`, `minWidth`, `align`, `readOnly`).
- Produces: `TopupHistory` component `({ cardId: number; readOnly: boolean; canDelete: boolean; onChanged: () => void })`.

- [ ] **Step 1: Point `PsoCardsClient.load()` at the new shape** — replace `setCards(j); setErr("");` with `setCards(j.cards); setErr("");`.

- [ ] **Step 2: Write `app/station/pso/TopupHistory.tsx`:**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import EditCell from "../EditCell";
import { rs } from "@/lib/pso";

type Topup = { id: number; kind: "opening" | "topup"; date: string; amount: number; refNo: string; createdBy: string; createdAt: string };

// One card's money history, opened from its balance on All cards. Each entry
// can be corrected where it stands; the balance follows, since it is worked
// out from these rows rather than kept.
export default function TopupHistory({ cardId, readOnly, canDelete, onChanged }: {
  cardId: number; readOnly: boolean; canDelete: boolean; onChanged: () => void;
}) {
  const [rows, setRows] = useState<Topup[] | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/fleet/topups?cardId=${cardId}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load the history");
      setRows(j); setErr("");
    } catch (e: any) { setErr(e.message); }
  }, [cardId]);
  useEffect(() => { load(); }, [load]);

  const save = async (id: number, patch: Record<string, unknown>): Promise<boolean> => {
    setErr("");
    try {
      const res = await fetch("/api/fleet/topups", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      onChanged();
      return true;
    } catch (e: any) { setErr(e.message); return false; }
  };

  const remove = async (t: Topup) => {
    if (!confirm(`Delete this ${t.kind === "opening" ? "opening balance" : "top-up"} of ${rs(t.amount)}?`)) return;
    setErr("");
    const res = await fetch(`/api/fleet/topups?id=${t.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) { setErr(j.error || "Could not delete"); return; }
    await load(); onChanged();
  };

  if (rows === null) return <div style={{ fontSize: 12, color: "var(--text3)", padding: 8 }}>{err || "Loading…"}</div>;
  return (
    <div style={{ padding: "6px 0" }}>
      {err && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 6 }}>{err}</div>}
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text3)" }}>No money recorded on this card yet.</div>
      ) : (
        <table style={{ fontSize: 12, width: "auto", background: "transparent" }}>
          <thead>
            <tr><th>Date</th><th>Entry</th><th className="num">Amount</th><th>Ref / receipt</th><th>Entered by</th>{!readOnly && canDelete && <th />}</tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id}>
                <td><EditCell type="date" value={t.date} minWidth={130} readOnly={readOnly} onSave={v => save(t.id, { date: v })} /></td>
                <td style={{ fontWeight: 600, color: t.kind === "opening" ? "var(--brand)" : "#15803D" }}>
                  {t.kind === "opening" ? "Opening balance" : "Top-up"}
                </td>
                <td className="num">
                  <EditCell type="number" value={String(t.amount)} minWidth={100} align="right" bold readOnly={readOnly}
                    onSave={v => save(t.id, { amount: v })} />
                </td>
                <td><EditCell value={t.refNo} minWidth={120} placeholder="—" readOnly={readOnly} onSave={v => save(t.id, { refNo: v })} /></td>
                <td style={{ color: "var(--text2)" }}>{t.createdBy || "—"}</td>
                {!readOnly && canDelete && (
                  <td><button className="btn btn-xs" style={{ color: "#A32D2D" }} onClick={() => remove(t)}>Delete</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Extend `CardsPanel`.** Change its props to `({ vehicles, readOnly, canDelete = false, onChanged })` with `canDelete?: boolean`; add `balance: number | null` to its `Card` type; add imports:

```tsx
import { Fragment } from "react";
import TopupHistory from "./TopupHistory";
import { balanceState, BALANCE_COLOR, rs } from "@/lib/pso";
```

New state, next to the existing `useState` calls:

```tsx
  const [lowLevel, setLowLevel] = useState(5000);
  const [lowDraft, setLowDraft] = useState("");
  // The card whose money form is open, and whether it is a first count.
  const [money, setMoney] = useState<{ cardId: number; kind: "opening" | "topup"; date: string; amount: string; refNo: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
```

In `load()`, replace `setList(j); setErr("");` with:

```tsx
      setList(j.cards); setLowLevel(j.lowLevel); setLowDraft(String(j.lowLevel)); setErr("");
```

Add the handlers below `remove`:

```tsx
  const today = () => new Date().toLocaleDateString("en-CA");
  const openMoney = (c: Card) => {
    setErr(""); setHistoryFor(null);
    setMoney({ cardId: c.id, kind: c.balance === null ? "opening" : "topup", date: today(), amount: "", refNo: "" });
  };
  const saveMoney = async () => {
    if (!money) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/topups", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(money),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setMoney(null);
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const saveLow = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lowBalance: lowDraft }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setLowLevel(j.lowLevel);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
```

Directly above the table's `<div className="card" style={{ padding: 0, overflow: "auto" }}>`, add the low-level setting:

```tsx
      <div className="toolbar-row">
        <span style={{ fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>Warn when a card is under</span>
        <input type="number" min={0} step={500} value={lowDraft} disabled={readOnly || busy}
          onChange={e => setLowDraft(e.target.value)} style={{ width: 110 }} />
        {!readOnly && Number(lowDraft) !== lowLevel && (
          <button className="btn btn-xs btn-primary" disabled={busy} onClick={saveLow}>Save</button>
        )}
      </div>
```

In the table header, insert `<th className="num">Balance</th>` after `<th>Status</th>`, and change both `colSpan={readOnly ? 6 : 7}` to `colSpan={readOnly ? 7 : 8}`.

In the row map, wrap each card's `<tr>` in a `<Fragment key={c.id}>` (drop the `key` from the `<tr>`), and after the Status `<td>` add the balance cell:

```tsx
                  <td className="num">
                    {(() => {
                      const st = balanceState(c.balance, lowLevel);
                      return (
                        <button type="button" onClick={() => { setMoney(null); setHistoryFor(historyFor === c.id ? null : c.id); }}
                          title="Show this card's top-ups"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit",
                                   fontWeight: 700, color: BALANCE_COLOR[st], textDecoration: "underline dotted" }}>
                          {c.balance === null ? "—" : rs(c.balance)}
                        </button>
                      );
                    })()}
                  </td>
```

In the Actions cell, before the Edit button:

```tsx
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => openMoney(c)}>
                          {c.balance === null ? "Set opening balance" : "⊕ Top up"}
                        </button>
```

After the card's `</tr>`, still inside the `Fragment`:

```tsx
                {money?.cardId === c.id && !readOnly && (
                  <tr>
                    <td colSpan={8} style={{ background: "var(--bg2)" }}>
                      <div className="toolbar-row" style={{ marginBottom: 0 }}>
                        <strong style={{ fontSize: 13 }}>
                          {money.kind === "opening" ? `Opening balance on ${c.sn}` : `Top up ${c.sn}`}
                        </strong>
                        <input type="date" value={money.date} max={today()} onChange={e => setMoney({ ...money, date: e.target.value })} style={{ width: 150 }} />
                        <input type="number" min={0} step="any" value={money.amount} placeholder={money.kind === "opening" ? "Balance on the card (Rs)" : "Amount loaded (Rs)"}
                          onChange={e => setMoney({ ...money, amount: e.target.value })} style={{ width: 190 }} />
                        <input value={money.refNo} placeholder="Ref / receipt no." onChange={e => setMoney({ ...money, refNo: e.target.value })} style={{ width: 170 }} />
                        <button className="btn btn-sm btn-primary" disabled={busy || money.amount === ""} onClick={saveMoney}>{busy ? "Saving…" : "Save"}</button>
                        <button className="btn btn-sm" onClick={() => setMoney(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
                {historyFor === c.id && (
                  <tr>
                    <td colSpan={8} style={{ background: "var(--bg2)" }}>
                      <TopupHistory cardId={c.id} readOnly={readOnly} canDelete={canDelete} onChanged={load} />
                    </td>
                  </tr>
                )}
```

Finally, in `PsoCardsClient.tsx`, pass `canDelete` through: `<CardsPanel vehicles={vehicles} readOnly={readOnly} canDelete={canDelete} onChanged={load} />`.

- [ ] **Step 4: Browser check (mocked API).** In `$T`, add an `entry3.tsx` that renders `<CardsPanel vehicles={[…]} readOnly={false} canDelete />` with `window.fetch` mocked to answer:
  - `GET /api/fleet/cards` → `{ lowLevel: 5000, cards: [ {id:1, sn:"JA9370", balance: 3200, …}, {id:2, sn:"AEX668", balance: 22000, …}, {id:3, sn:"NEW1", balance: null, …}, {id:4, sn:"EMPTY", balance: -150, …} ] }`
  - `GET /api/fleet/topups?cardId=1` → two entries;
  - `POST/PUT` → `{ ok: true, balance: 1 }` and record the body in `window.calls`.

  Bundle with the same esbuild command used for `entry.tsx`, serve, and assert in the page:
  - balance cells read `Rs 3,200` (amber `rgb(180, 83, 9)`), `Rs 22,000` (normal), `—` (grey), `Rs -150` (red `rgb(220, 38, 38)`);
  - card 3's action reads "Set opening balance", the others "⊕ Top up";
  - opening card 3's form, typing 15000 and saving POSTs `{ cardId: 3, kind: "opening", amount: "15000", … }`;
  - clicking `Rs 3,200` shows the history table with 2 rows;
  - changing the low level to 4000 shows Save, and saving PUTs `{ lowBalance: "4000" }`.
  Take one screenshot of the All cards tab.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit -p .
npx eslint app/station/pso
git add app/station/pso
git commit -m "PSO Cards: balance column, top-up and opening forms, history, low-balance setting"
```

---

### Task 4: Station terminal shows the balance

**Files:**
- Modify: `app/api/fleet/lookup/route.ts`
- Modify: `app/station/CardForms.tsx` (types; card select; card box)
- Modify: `app/station/VehicleTerminal.tsx` (`Found` type; pass `lowLevel`; flash text)
- Test: `$S/test.ts` (lookup) + browser harness `$T` (terminal)

**Interfaces:**
- Consumes: `cardBalances`, `lowBalanceLevel` (Task 1); `balanceState`, `BALANCE_COLOR`, `rs` (Task 1); `POST /api/fleet/card-issues` → `balance`, `lowLevel` (Task 2).
- Produces: lookup response adds `lowLevel: number`, `openCard.balance: number | null`, each `cards[i].balance: number | null`. `CardForms` types `DrawerCard` and `OpenCard` gain `balance?: number | null`; `TakeCardOut` and `ReturnCard` take a new prop `lowLevel: number`.

- [ ] **Step 1: Failing lookup test** — `$S/test.ts`:

```ts
// PREAMBLE here
import { POST as lookup } from "@/app/api/fleet/lookup/route";
(async () => {
  await setup();
  let r = await lookup(req("/api/fleet/lookup", "POST", { pin: "9370" }));
  let j: any = await r.json();
  check("lookup works with no opening", r.status === 200 && j.cards.every((c: any) => c.balance === null) && j.lowLevel === 5000, j);
  await pg.exec(`INSERT INTO pso_card_topups (card_id, kind, date, amount) VALUES (1, 'opening', '2026-10-12', 4200)`);
  j = await (await lookup(req("/api/fleet/lookup", "POST", { pin: "9370" }))).json();
  check("drawer card carries its balance", j.cards.find((c: any) => c.id === 1)?.balance === 4200, j.cards);
  await pg.exec(`UPDATE pso_cards SET held_by_id = 1, held_by_name = 'Fazal Rabi', held_since = '2026-10-12' WHERE id = 1;
                 INSERT INTO pso_card_custody (card_id, holder_id, holder_name, taken_date, taken_time) VALUES (1, 1, 'Fazal Rabi', '2026-10-12', '09:00');`);
  j = await (await lookup(req("/api/fleet/lookup", "POST", { pin: "9370" }))).json();
  check("open card carries its balance", j.openCard?.balance === 4200, j.openCard);
  done();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it** — expected FAIL on "lookup works with no opening" (`lowLevel` undefined).

- [ ] **Step 3: Lookup adds balances** — in `app/api/fleet/lookup/route.ts`, import `import { cardBalances, lowBalanceLevel } from "@/lib/cardBalance";` and replace the final `return NextResponse.json({ … })` with:

```ts
    // What is left on each card, for the terminal to show (never to stop anyone).
    const ids = [...cards.map(c => c.id), ...(openCard ? [openCard.cardId] : [])];
    const [balances, lowLevel] = await Promise.all([cardBalances(ids), lowBalanceLevel()]);

    return NextResponse.json({
      vehicle: v,
      drivers,
      openTrip,
      lastMeter: last?.km ?? null,
      openCard: openCard ? { ...openCard, balance: balances.get(openCard.cardId) ?? null } : null,
      cards: cards.map(c => ({ ...c, balance: balances.get(c.id) ?? null })),
      lowLevel,
    });
```

- [ ] **Step 4: Run the lookup test** — expected `ALL PASSED`.

- [ ] **Step 5: Terminal forms show it** — in `app/station/CardForms.tsx`:
  - add `import { balanceState, BALANCE_COLOR, rs } from "@/lib/pso";`
  - `DrawerCard` → `{ id: number; sn: string; vehicleNo: string | null; own: boolean; balance?: number | null }`; `OpenCard` gains `balance?: number | null;`
  - add this helper above `TakeCardOut`:

```tsx
// What is left on a card, coloured by how low it is. Shown, never enforced:
// the slip is what PSO actually charged.
function BalanceLine({ balance, low }: { balance?: number | null; low: number }) {
  if (balance === null || balance === undefined) return null;
  const st = balanceState(balance, low);
  return (
    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: BALANCE_COLOR[st] }}>
      Balance {rs(balance)}{st === "red" ? " — empty" : st === "amber" ? " — running low" : ""}
    </div>
  );
}
```

  - `TakeCardOut`: add prop `lowLevel: number`; change each `<option>` text to append `{c.balance !== null && c.balance !== undefined ? ` · ${rs(c.balance)}` : ""}`; directly below the card `<select>` add `<BalanceLine balance={cards.find(c => c.id === cardId)?.balance} low={lowLevel} />`.
  - `ReturnCard`: add prop `lowLevel: number`; inside the card box, after the "With … · collected …" line, add `<BalanceLine balance={card.balance} low={lowLevel} />`.

- [ ] **Step 6: Terminal passes it through** — in `app/station/VehicleTerminal.tsx`:
  - `Found` gains `lowLevel: number;`
  - every `<ReturnCard … />` and `<TakeCardOut … />` gets `lowLevel={data.lowLevel}`;
  - `postFuel` returns the parsed body: change its last lines to

```ts
    const fj = await fr.json();
    if (!fr.ok) throw new Error(fj.error || "Could not save the fuel record");
    return fj as { balance: number | null; lowLevel: number };
```

  - add above `recordFuel`:

```ts
  // "· balance Rs 6,400", coloured amber/red in the message when low.
  const afterFill = (r: { balance: number | null; lowLevel: number } | undefined) => {
    if (!r || r.balance === null) return { text: "", low: false };
    const st = balanceState(r.balance, r.lowLevel);
    return { text: ` · balance ${rs(r.balance)}${st === "red" ? " (empty)" : st === "amber" ? " (low)" : ""}`, low: st === "red" || st === "amber" };
  };
```

  - `recordFuel`: `const r = await postFuel(data.openCard, fuel); const a = afterFill(r);` then `onDone(\`Rs ${fuel.amount} on card ${data.openCard.sn} · card still with ${data.openCard.takenBy}${a.text}\`, a.low ? "#DC2626" : "#B45309");`
  - `returnCard`: keep the returned value — `let after = { text: "", low: false };` before the `if (fuel && …)` block, and inside it `after = afterFill(await postFuel(data.openCard, fuel));` (replacing the bare `await postFuel(…)`); the final `onDone` text becomes `` `Card ${data.openCard.sn} back in${fuel ? ` · Rs ${fuel.amount} recorded${after.text}` : ""}` ``.
  - add `import { balanceState, rs } from "@/lib/pso";`

- [ ] **Step 7: Browser check** — reuse the fuel harness (`…/scratchpad/fuel/entry.tsx`): add `balance: 6200` to the mocked `openCard`, `lowLevel: 5000` to the lookup answer, and make the `card-issues` mock answer `{ id, balance: 3700, lowLevel: 5000 }`. Assert: the Record-fuel form shows "Balance Rs 6,200"; saving a 2500 fill flashes a message ending "· balance Rs 3,700 (low)"; a lookup answer with `openCard.balance: null` shows no balance line and the form still saves.

- [ ] **Step 8: Type-check, lint, commit**

```bash
npx tsc --noEmit -p .
npx eslint app/station/CardForms.tsx app/station/VehicleTerminal.tsx app/api/fleet/lookup
git add app/api/fleet/lookup/route.ts app/station/CardForms.tsx app/station/VehicleTerminal.tsx
git commit -m "Station: show a PSO card's balance, and warn when it runs low"
```

---

### Task 5: Ship

- [ ] **Step 1:** `npx tsc --noEmit -p .` — no output.
- [ ] **Step 2:** Re-run the Task 1 and Task 2 PGlite tests once more against the final code — both `ALL PASSED`.
- [ ] **Step 3:** `git push origin main`, then `git status -sb` shows `## main...origin/main` with nothing ahead.
