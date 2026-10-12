# PSO card top-ups and balances — design

Date: 2026-10-12
Status: approved in conversation, awaiting spec review

## Purpose

Each PSO card is recharged with its own money. Today the app records the fuel
drawn on a card (Cards Logbook) and who holds it, but not what was loaded onto
it, so nobody can see what is left on a card. This adds top-ups, a balance per
card, and a low-balance warning at the station.

## Decisions (from the owner)

- **Model:** money is loaded per card. Balance = loaded − fuel drawn.
- **Entry point:** top-ups are an office entry on Station → PSO Cards →
  **All cards**. The station terminal does not record top-ups.
- **Fields per top-up:** date, amount, reference / receipt no.
- **Starting point:** each card's current balance is typed once as an
  **opening balance** dated the day it is entered. Fuel recorded before it does
  not count against it.
- **Low balance:** one level for all cards (e.g. Rs 5,000), set on PSO Cards.
- **At the station:** show the balance, warn when low; never block a fill.

## Data

### `pso_card_topups` (new table)

| column      | type                    | notes                                   |
|-------------|-------------------------|-----------------------------------------|
| id          | serial PK               |                                         |
| card_id     | integer NOT NULL        | → pso_cards(id) ON DELETE CASCADE       |
| kind        | varchar(10) NOT NULL    | `opening` or `topup`                    |
| date        | date NOT NULL           | the day the money went on               |
| amount      | double precision NOT NULL | > 0 for a top-up; ≥ 0 for an opening  |
| ref_no      | varchar(60)             | receipt / PSO transaction no.           |
| created_by  | varchar(120)            | name of the user who entered it         |
| created_at  | timestamptz NOT NULL default now() |                              |

Created inside `ensureFleetSchema()` with `CREATE TABLE IF NOT EXISTS`; any
later column goes in as `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (see the
comment in `lib/fleet.ts`). Index on `(card_id, created_at)`.

A card has at most one **current** opening: the latest `opening` row by
`created_at`. Setting a new opening balance later (a recount) adds another
`opening` row; the earlier rows stay as history.

### `fleet_settings` (new table)

Key/value: `key varchar(60) PRIMARY KEY, value text NOT NULL`. One key for now:
`pso_low_balance` (rupees, default 5000 when the row is absent).

## Balance rule

For a card with a current opening row `O`:

```
balance = O.amount
        + Σ topups.amount       where kind = 'topup'  and created_at > O.created_at
        − Σ pso_card_issues.amount where card_id = card and created_at > O.created_at
```

- Cut-off is **when a row was entered** (`created_at`), not its collection
  date: a fill typed in today counts even if its hand-over began earlier.
- A card with no opening row has **no balance** (shown as "—", with a
  *Set opening balance* button). Top-ups on such a card are refused until an
  opening exists, so a balance never silently starts from zero.
- Computed on read in one SQL query (no stored total), so editing or deleting
  a fuel record or a top-up corrects the balance immediately.

States, with `L` = low level:
- `balance ≤ 0` → **red**
- `0 < balance < L` → **amber**
- otherwise normal.

## API

- `GET /api/fleet/cards` — each card gains `balance: number | null` and the
  response gains `lowLevel: number`.
- `GET /api/fleet/topups?cardId=` — a card's top-up history, newest first.
- `POST /api/fleet/topups` `{ cardId, kind, date, amount, refNo }` — guarded by
  `station` write; `kind=topup` refused (409) when the card has no opening.
- `PUT /api/fleet/topups` `{ id, date?, amount?, refNo? }` — fix an entry.
- `DELETE /api/fleet/topups?id=` — guarded by `station.delete`.
- `PUT /api/fleet/settings` `{ lowBalance }` — guarded by `station` write.
- `POST /api/fleet/lookup` (station) — `openCard` and each drawer card gain
  `balance` and the response gains `lowLevel`.
- Every write logs to the activity feed like the other card actions.

## Screens

### PSO Cards → All cards

- **Low balance** setting at the top: "Warn when a card is under Rs [5000]".
- **Balance** column after Status: amount, coloured by state; "—" if no opening.
- Per card (not read-only): **⊕ Top up** button, or **Set opening balance**
  when the card has none. Small inline form: date (today), amount, ref no.
- Clicking the balance expands the card's **top-up history** under its row,
  with inline correction and Delete (delete needs `station.delete`).

### Station terminal (vehicle PIN)

- Take-card-out form: each card option and the selected card show
  "Balance Rs 12,400", coloured by state.
- Record-fuel and take-card-back forms: the card box shows the balance.
- After a fill is saved, the green/amber message ends with the new balance
  ("… · balance Rs 6,400"); amber/red styling if now low.
- Nothing is ever blocked by the balance.

### Cards Logbook

Unchanged.

## Out of scope

- Top-ups at the station terminal.
- Per-card low levels.
- Reconciling against PSO statements, or a top-ups report / Excel export.

## Testing

- PGlite harness (as used for the custody-link change): migration runs twice
  cleanly; balance with opening only, with top-ups, with fills before and after
  the opening; top-up refused without an opening; editing/deleting a fill or
  top-up moves the balance; low/red thresholds.
- Browser harness with a mocked API: All cards balance column colours, top-up
  form, history expand/edit; station card box and flash message show balance.
