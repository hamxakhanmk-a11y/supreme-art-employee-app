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
      SELECT GREATEST(COALESCE(meter_in, 0), meter_out) AS km,
             CASE WHEN meter_in IS NOT NULL THEN 'a trip on ' || date ELSE 'a trip started on ' || date END AS src
      FROM fleet_trips WHERE vehicle_id = ${vehicleId}
      UNION ALL
      SELECT meter_reading AS km, 'fuel drawn on ' || date AS src
      FROM fuel_entries WHERE vehicle_id = ${vehicleId} AND meter_reading IS NOT NULL
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
