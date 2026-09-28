import { sql } from "drizzle-orm";
import { db } from "./db";

// Fleet's tables create themselves on first use, the way procurement's and
// CAPA's do: production's schema can't be migrated by hand from a developer
// machine, so the change has to apply itself.
//
// Everything is ONE statement — a single DO block — because the Neon HTTP
// driver refuses a query carrying several commands, and because issued
// separately this cost seconds per request against Neon, which shows up as
// laggy buttons on every page that waits for it.
//
// Call it from READS as well as writes. A read naming a table that doesn't
// exist yet throws, and a failed read is how the store once rendered itself
// empty — parts, quantities and totals all zero, looking exactly like deleted
// data.
let ensured = false;
export async function ensureFleetSchema() {
  if (ensured) return;
  await db.execute(sql`
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS vehicles (
    id serial PRIMARY KEY,
    vehicle_no varchar(30) NOT NULL,
    name varchar(80) DEFAULT '',
    type varchar(20) NOT NULL DEFAULT 'car',
    default_driver_id integer REFERENCES employees(id) ON DELETE SET NULL,
    active boolean NOT NULL DEFAULT true,
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  -- On LOWER(), so one vehicle can't be added twice as "apr-1234".
  CREATE UNIQUE INDEX IF NOT EXISTS vehicles_no_key ON vehicles (LOWER(vehicle_no));

  -- The vehicle's own PIN, typed at the gate. A vehicle identifies itself and
  -- the driver is then chosen from those allowed to drive it, so the trip is
  -- attributed without the driver needing to remember a second PIN.
  ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS pin varchar(6);
  -- Partial, so the many vehicles without a PIN don't collide on null.
  CREATE UNIQUE INDEX IF NOT EXISTS vehicles_pin_key ON vehicles (pin) WHERE pin IS NOT NULL;

  -- Who may drive which vehicle. The gate offers only these names, not the
  -- whole payroll: a list of three is a tap, a list of ninety is a search.
  CREATE TABLE IF NOT EXISTS vehicle_drivers (
    id serial PRIMARY KEY,
    vehicle_id integer NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS vehicle_drivers_key ON vehicle_drivers (vehicle_id, employee_id);

  -- Not every driver is on the payroll — a hired driver, a contractor's man.
  -- Such a row carries a plain name and no employee link, so employee_id stops
  -- being mandatory and a name column joins it.
  ALTER TABLE vehicle_drivers ALTER COLUMN employee_id DROP NOT NULL;
  ALTER TABLE vehicle_drivers ADD COLUMN IF NOT EXISTS name varchar(160);
  -- The index above can't stop a name being added twice, since two NULL
  -- employee_ids never collide. This one does.
  CREATE UNIQUE INDEX IF NOT EXISTS vehicle_drivers_name_key
    ON vehicle_drivers (vehicle_id, LOWER(name)) WHERE employee_id IS NULL;

  -- The driver's name as it stood on the day. Always written, so a trip driven
  -- by someone off the payroll still prints, and so does one driven by an
  -- employee who has since left.
  ALTER TABLE fleet_trips ADD COLUMN IF NOT EXISTS driver_name varchar(160);

  CREATE TABLE IF NOT EXISTS fleet_trips (
    id serial PRIMARY KEY,
    vehicle_id integer NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date date NOT NULL,
    out_at timestamptz NOT NULL,
    in_at timestamptz,
    driver_id integer REFERENCES employees(id) ON DELETE SET NULL,
    destination text DEFAULT '',
    purpose text DEFAULT '',
    meter_out integer NOT NULL,
    meter_in integer,
    km_covered integer,
    remarks text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  -- A vehicle can only be out once, and a driver can only be out in one
  -- vehicle. Enforced here rather than only in application code: two taps on a
  -- slow gate terminal are exactly how a double punch happens.
  CREATE UNIQUE INDEX IF NOT EXISTS fleet_trips_open_vehicle_key
    ON fleet_trips (vehicle_id) WHERE in_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS fleet_trips_open_driver_key
    ON fleet_trips (driver_id) WHERE in_at IS NULL AND driver_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS fleet_trips_vehicle_date_idx
    ON fleet_trips (vehicle_id, date);

  CREATE TABLE IF NOT EXISTS fleet_trip_officers (
    id serial PRIMARY KEY,
    trip_id integer NOT NULL REFERENCES fleet_trips(id) ON DELETE CASCADE,
    employee_id integer REFERENCES employees(id) ON DELETE SET NULL,
    name varchar(160) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS fleet_trip_officers_trip_idx
    ON fleet_trip_officers (trip_id);

  CREATE TABLE IF NOT EXISTS fuel_entries (
    id serial PRIMARY KEY,
    vehicle_id integer NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date date NOT NULL,
    litres double precision NOT NULL DEFAULT 0,
    rate double precision NOT NULL DEFAULT 0,
    amount double precision NOT NULL DEFAULT 0,
    meter_reading integer,
    drawn_by_id integer REFERENCES employees(id) ON DELETE SET NULL,
    vendor varchar(120) DEFAULT '',
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS fuel_entries_vehicle_date_idx
    ON fuel_entries (vehicle_id, date);

  -- PSO fuel cards. The card is the thing that persists; it can move between
  -- vehicles, be blocked, or be replaced, and its SN outlives all of that.
  CREATE TABLE IF NOT EXISTS pso_cards (
    id serial PRIMARY KEY,
    sn varchar(40) NOT NULL,
    vehicle_id integer REFERENCES vehicles(id) ON DELETE SET NULL,
    status varchar(16) NOT NULL DEFAULT 'in_use',   -- in_use | spare | blocked | lost
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS pso_cards_sn_key ON pso_cards (LOWER(sn));

  -- One row per time a card went out with a driver and came back. Dates and
  -- times are kept apart, as the register writes them.
  CREATE TABLE IF NOT EXISTS pso_card_issues (
    id serial PRIMARY KEY,
    card_id integer NOT NULL REFERENCES pso_cards(id) ON DELETE CASCADE,
    vehicle_id integer REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id integer REFERENCES employees(id) ON DELETE SET NULL,
    driver_name varchar(160),
    collected_date date NOT NULL,
    collected_time varchar(5),
    submitted_date date,
    submitted_time varchar(5),
    amount double precision,
    litres double precision,
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  -- A card is either with a driver or in the drawer; it can't be both.
  CREATE UNIQUE INDEX IF NOT EXISTS pso_card_issues_open_key
    ON pso_card_issues (card_id) WHERE submitted_date IS NULL;
  CREATE INDEX IF NOT EXISTS pso_card_issues_vehicle_idx
    ON pso_card_issues (vehicle_id, collected_date);

  -- Fuel drawn on a card is the same fuel the log book counts, so a submitted
  -- card writes the P.O.L. entry rather than being tallied separately. The
  -- cascade keeps the two from drifting: remove the card entry and its fuel
  -- entry goes with it.
  ALTER TABLE fuel_entries ADD COLUMN IF NOT EXISTS card_issue_id integer
    REFERENCES pso_card_issues(id) ON DELETE CASCADE;
END $$;
  `);
  ensured = true;
}

export const VEHICLE_TYPES = ["car", "van", "bike", "truck", "other"] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

export const VEHICLE_TYPE_LABEL: Record<string, string> = {
  car: "Car", van: "Van", bike: "Bike", truck: "Truck", other: "Other",
};

// The odometer can only go forward, and it moves whether the vehicle was on a
// journey or standing at a pump — so the last known reading is the highest of
// both, not simply the last trip's. Returns null for a vehicle never yet read.
export async function lastMeterReading(vehicleId: number): Promise<{ km: number; from: string } | null> {
  const res = await db.execute(sql`
    SELECT km, src FROM (
      SELECT GREATEST(COALESCE(t.meter_in, 0), t.meter_out) AS km,
             CASE WHEN t.meter_in IS NOT NULL
                  THEN 'a trip on ' || t.date::text
                  ELSE 'a trip started on ' || t.date::text END AS src
      FROM fleet_trips t WHERE t.vehicle_id = ${vehicleId}
      UNION ALL
      SELECT f.meter_reading AS km, 'fuel drawn on ' || f.date::text AS src
      FROM fuel_entries f WHERE f.vehicle_id = ${vehicleId} AND f.meter_reading IS NOT NULL
    ) readings
    ORDER BY km DESC
    LIMIT 1
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  if (!rows.length || rows[0].km === null) return null;
  return { km: Number(rows[0].km), from: String(rows[0].src) };
}

// Km for a closed trip. Kept in one place so the terminal, the inline edit and
// any backfill all agree on what the number means.
export function kmBetween(meterOut: number, meterIn: number | null | undefined): number | null {
  if (meterIn === null || meterIn === undefined) return null;
  return Math.max(0, meterIn - meterOut);
}
