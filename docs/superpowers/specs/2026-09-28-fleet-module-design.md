# Fleet — vehicle log book inside the Station tab

**Date:** 2026-09-28
**Status:** approved design, ready for implementation planning

## Why

Vehicle journeys are kept in a paper log book — one page per vehicle per month,
ruled into Date, Time (From/To), Details of Journey, Purpose of Journey, Name of
Officer/Official, Meter Reading (From/To), K. Meter Covered, Signature, P.O.L.
Drawn, Remarks, with "Average to litre" written at the top of the page.

The book gives no totals without adding them up by hand, no fuel average unless
someone computes it, and no way to ask what a vehicle cost or where it went.
Meter readings are copied from the dashboard to paper hours after the fact.

Fleet replaces that book: the readings are captured at the gate as the journey
happens, and the page prints back out in the same shape for the file.

## Success

- A driver can take a vehicle out and bring it back at the gate terminal without
  writing anything on paper.
- Any month of any vehicle prints as a page that matches the book, with km
  totals and the km/litre average already worked out.
- A wrong meter reading can be corrected afterwards without touching the database.

## Scope

**In:** vehicles registry, trips (the log book), fuel entries, the printable
monthly log book, and the gate terminal flow for taking a vehicle out and
bringing it back.

**Out, deliberately** — revisit after a month of real use:
maintenance and service records, document expiry alerts (registration,
insurance, route permit, token tax), per-vehicle monthly cost summaries,
tyre/battery records, challans.

## Decisions made during design

| Question | Decision |
|---|---|
| How trips are recorded | At the gate terminal, corrected afterwards on the report — mirrors how Station already works |
| Who a trip names | The driver (from their PIN) **and** the officers/officials travelling |
| How many officers | Several per trip, so a trip needs its own officers list |
| Fuel | Its own records — litres, rate, amount, meter reading — not a number typed on a trip row |
| Where it lives | Inside the **Station** tab, on the existing Station permission. No new top-level tab and no new Role Permissions rows |
| The terminal | One terminal. After the PIN, the person picks "On foot" or "Taking a vehicle" |
| Vehicle trip vs hourly leave | Taking a vehicle records a **trip only**, not an hourly-leave punch. The journey is the record, as on paper. Official leave is excused from worked hours anyway, so there is no pay effect |

## Data model

Three tables in `lib/schema.ts`, created by `ensureFleetSchema()` in a new
`lib/fleet.ts`, following the self-creating pattern already used by
`lib/procurement.ts`, `lib/capa.ts` and `lib/overtimeServer.ts` — production's
schema cannot be migrated by hand from a developer machine, so the tables have
to create themselves on first use. `ensureFleetSchema()` must be called from
**reads as well as writes**: a read naming a table that does not exist yet
throws, and a failed read is how the store rendered itself empty.

### `vehicles`

| Column | Type | Notes |
|---|---|---|
| `id` | serial pk | |
| `vehicleNo` | text, unique | e.g. `APR-1234`. Unique on `LOWER(vehicle_no)` |
| `name` | text | make/model, e.g. "Suzuki Bolan" |
| `type` | varchar(20) | car / van / bike / truck |
| `defaultDriverId` | int → employees | nullable; pre-selected at the terminal |
| `active` | boolean, default true | retired vehicles stop being offered |
| `notes` | text | |
| `createdAt` | timestamptz | |

### `fleet_trips`

One row per journey. `inAt IS NULL` means the vehicle is still out — the same
convention `station_leaves` uses for a person.

| Column | Type | Notes |
|---|---|---|
| `id` | serial pk | |
| `vehicleId` | int → vehicles, cascade | |
| `date` | date | local (Karachi) day of the *outward* leg, like `station_leaves.date` |
| `outAt` | timestamptz | |
| `inAt` | timestamptz, null | null = still out |
| `driverId` | int → employees | who drove; from the PIN |
| `destination` | text | "Details of Journey" |
| `purpose` | text | |
| `meterOut` | int | |
| `meterIn` | int, null | filled on return |
| `kmCovered` | int, null | **stored**, not derived — see below |
| `remarks` | text | |
| `createdAt` | timestamptz | |

`kmCovered` is stored rather than computed at read time for the same reason the
store anchors its balances to the part's real quantity: when a reading is
corrected later, the row should say what it says, not silently re-derive and
leave the history disagreeing with itself. It is recomputed on every write that
touches either reading.

### `fleet_trip_officers`

| Column | Type | Notes |
|---|---|---|
| `id` | serial pk | |
| `tripId` | int → fleet_trips, cascade | |
| `employeeId` | int → employees, null | null for someone not on the payroll |
| `name` | text | always filled, so the printed page never depends on a join |

`employeeId` is nullable so a customer's man or a visitor can ride along and
still be named — the same problem the store's "Issued To" solved. `name` is
stored even when `employeeId` is set, so a page printed today still reads
correctly after someone leaves the company.

### `fuel_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | serial pk | |
| `vehicleId` | int → vehicles, cascade | |
| `date` | date | |
| `litres` | double precision | fractional |
| `rate` | double precision | per litre |
| `amount` | double precision | litres × rate, stored |
| `meterReading` | int, null | reading at the pump |
| `drawnById` | int → employees, null | |
| `vendor` | text | pump / station name |
| `notes` | text | |
| `createdAt` | timestamptz | |

## Screens

All inside the Station tab. `components/nav-config.ts` `case "station"` grows
from three entries to five:

```
Terminal  |  Who's Out  |  Report  |  Log Book  |  Vehicles
```

### Terminal — `/station` (existing screen, extended)

After the PIN resolves, the found-employee view offers two choices instead of
punching straight out:

- **On foot** — today's behaviour exactly, unchanged.
- **Taking a vehicle** — vehicle (defaulting to the one they usually drive),
  meter reading now, destination, purpose, and who else is going.

If the employee already has an **open trip**, the terminal goes straight to the
return form and asks only for the closing reading — the toggle behaviour the
punch endpoint already has.

The existing PIN lookup returns the employee and their open hourly leave; it
gains their open *trip* and the vehicle list, so the terminal can decide which
form to show without a second round trip.

### Who's Out — `/station/out` (existing screen, extended)

Gains a "Vehicles out" panel above the people: vehicle, driver, destination,
time out, and the reading it left on. One board for the gate.

### Log Book — `/station/logbook` (new)

Pick a vehicle and a month; get that page of the book. Columns and order follow
the paper exactly. Above it: km covered, litres drawn, and the km/litre average
for the month. Beneath it: that month's fuel entries, with an "Add fuel" button.

Two columns of the paper page are not trip fields and need saying plainly:

- **P.O.L. Drawn** prints the litres from any fuel entry dated that day for that
  vehicle, against the first trip of the day — or on its own row if fuel was
  drawn on a day with no journey. Blank otherwise.
- **Signature** prints as an empty ruled column. It exists to be signed in ink
  once the page is printed and filed; nothing is captured on screen.

Fuel is recorded here rather than on its own sub-tab because this is the one
screen where fuel has context — the vehicle and the month are already chosen,
and the average sits directly above.

Rows edit inline and delete, following `StationReportClient` — which already
does inline edit of times/type/reason with a `station.delete` grant. Prints to a
page shaped like the book; exports through the existing `downloadRegisterXlsx`.

### Vehicles — `/station/vehicles` (new)

Add and edit vehicles, set the default driver, retire one. Retiring keeps its
history and stops offering it at the terminal.

## API

Following the existing `/api/station/*` shape:

| Route | Methods | Guard |
|---|---|---|
| `/api/fleet/vehicles` | GET, POST, PUT, DELETE | `guardAuth` / `guardWrite("station")` |
| `/api/fleet/trips` | GET, POST, PUT | as above |
| `/api/fleet/trips/[id]` | PUT, DELETE | DELETE needs `station.delete` |
| `/api/fleet/fuel` | GET, POST, PUT, DELETE | as above |
| `/api/station/punch` | extended | accepts a vehicle trip instead of a leave |
| `/api/station/lookup` | extended | also returns the open trip + vehicle list |

## Rules and error handling

**Meter readings must move forward.** A closing reading below the opening one is
rejected. A new trip whose opening reading is below the vehicle's last known
reading is rejected with what that reading was and where it came from (a trip or
a fuel fill) — the driver can then correct it, or the office can fix the bad row
on the Log Book page. The vehicle's "last known reading" is the highest of its
trips' `meterIn` and its fuel entries' `meterReading`.

**One open trip per vehicle.** Taking out a vehicle that is already out is
refused, naming who has it. Guarded in the database with a partial unique index
on `(vehicle_id) WHERE in_at IS NULL`, not only in application code.

**A driver can have only one open trip.** Same check against `driver_id`.

**A trip left open overnight** is not auto-closed. It shows on Who's Out as out,
and on the Log Book with a blank return, to be corrected by hand — the same way
the Station report treats an unclosed leave today.

**Retired vehicles and inactive employees** keep their history. Trips and fuel
entries already recorded still print with their names.

**Failure to load the vehicle list** must not break the Terminal's existing
on-foot flow — fetch it separately from the PIN lookup's own data.

## Activity log

New actions under the existing `station` family, so they land in the Station
badge in `components/ActivityFeed.tsx` with no change to `FAMILY`:
`station.vehicle.out`, `station.vehicle.in`, `station.vehicle.add`,
`station.vehicle.edit`, `station.trip.edit`, `station.trip.delete`,
`station.fuel.add`, `station.fuel.edit`, `station.fuel.delete`.

## Permissions

No new `ModuleKey` values. Fleet reads need `station` view; writes need
`station` edit; deleting a trip or a fuel entry needs `station.delete`, the same
grant the Station report's delete uses.

## Testing

- **Meter rules:** closing below opening rejected; opening below the vehicle's
  last known reading rejected; a fuel fill between two trips counts as the last
  known reading.
- **Open-trip rules:** a second trip for the same vehicle refused; for the same
  driver refused; the partial unique index enforces it with the application
  check bypassed.
- **km covered:** stored on return; recomputed when either reading is edited;
  unchanged rows keep their value.
- **Monthly average:** km ÷ litres for a vehicle-month; a month with no fuel
  shows no average rather than a division by zero.
- **Log book page:** columns and order match the paper; a trip with several
  officers prints them all; an open trip prints with a blank return.
- **Terminal:** on-foot punching is unchanged; taking a vehicle creates a trip
  and **no** hourly leave; an employee with an open trip is shown the return
  form.
- **Schema:** `ensureFleetSchema()` runs twice without error, and a read on a
  database that has never had the tables succeeds.

## Notes for implementation

- Production's database cannot be reached from a developer machine, and reads of
  it are blocked in the Claude session. Anything depending on live data has to
  be verified against a stub, and that limitation stated rather than glossed.
- The store's "Issued To" picker (`public/store/index.html`, `setupEmpCombo`)
  already solves picking an employee with free text as a fallback; the officers
  field should behave the same way rather than inventing a second pattern.
