import { db } from "./db";
import { sql } from "drizzle-orm";
import { ensureFleetSchema, lastMeterReading } from "./fleet";

// Server-only fleet queries. Kept apart from lib/fleet.ts so the client
// components can import the constants and the km helper there without pulling
// the database in behind them.

export type OpenTripInfo = {
  id: number;
  vehicleId: number;
  vehicleNo: string;
  vehicleName: string;
  outAt: string;
  destination: string;
  purpose: string;
  meterOut: number;
  officers: string[];
  driver?: string;
};

export type VehicleOption = {
  id: number;
  vehicleNo: string;
  pin: string | null;
  name: string;
  type: string;
  defaultDriverId: number | null;
  out: boolean;
  lastMeter: number | null;
};

// The trip this driver is out on, or null. One row by construction — the open
// trip per driver is a unique index.
export async function openTripForDriver(driverId: number): Promise<OpenTripInfo | null> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT t.id, t.vehicle_id AS "vehicleId", v.vehicle_no AS "vehicleNo",
           COALESCE(v.name, '') AS "vehicleName",
           t.out_at AS "outAt", COALESCE(t.destination, '') AS destination,
           COALESCE(t.purpose, '') AS purpose, t.meter_out AS "meterOut",
           COALESCE(
             (SELECT json_agg(o.name ORDER BY o.id) FROM fleet_trip_officers o WHERE o.trip_id = t.id),
             '[]'::json
           ) AS officers
    FROM fleet_trips t
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE t.driver_id = ${driverId} AND t.in_at IS NULL
    LIMIT 1
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  if (!rows.length) return null;
  const r = rows[0];
  return { ...r, outAt: new Date(r.outAt).toISOString(), officers: r.officers ?? [] };
}

// The trip this vehicle is out on, or null. One row by construction — the open
// trip per vehicle is a unique index.
export async function openTripForVehicle(vehicleId: number): Promise<OpenTripInfo | null> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT t.id, t.vehicle_id AS "vehicleId", v.vehicle_no AS "vehicleNo",
           COALESCE(v.name, '') AS "vehicleName",
           t.out_at AS "outAt", COALESCE(t.destination, '') AS destination,
           COALESCE(t.purpose, '') AS purpose, t.meter_out AS "meterOut",
           COALESCE(NULLIF(TRIM(e.first_name || ' ' || e.last_name), ''), NULLIF(TRIM(t.driver_name), ''), '—') AS driver,
           COALESCE(
             (SELECT json_agg(o.name ORDER BY o.id) FROM fleet_trip_officers o WHERE o.trip_id = t.id),
             '[]'::json
           ) AS officers
    FROM fleet_trips t
    JOIN vehicles v ON v.id = t.vehicle_id
    LEFT JOIN employees e ON e.id = t.driver_id
    WHERE t.vehicle_id = ${vehicleId} AND t.in_at IS NULL
    LIMIT 1
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  if (!rows.length) return null;
  const r = rows[0];
  return { ...r, outAt: new Date(r.outAt).toISOString(), officers: r.officers ?? [] };
}

// Vehicles for the terminal's picker: active ones, each with whether it's out
// and the reading it was last seen on, so the form can prefill and warn.
export async function vehicleOptions(): Promise<VehicleOption[]> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT v.id, v.vehicle_no AS "vehicleNo", v.pin, COALESCE(v.name, '') AS name, v.type,
           v.default_driver_id AS "defaultDriverId",
           EXISTS (SELECT 1 FROM fleet_trips t WHERE t.vehicle_id = v.id AND t.in_at IS NULL) AS out,
           -- Two plain correlated subqueries rather than a MAX over a UNION:
           -- a derived table can't see v.id without LATERAL, so the tidier
           -- version would fail at runtime. NULLIF turns "never read" back into
           -- null instead of a meaningless 0.
           NULLIF(GREATEST(
             COALESCE((SELECT MAX(GREATEST(COALESCE(t.meter_in, 0), t.meter_out))
                       FROM fleet_trips t WHERE t.vehicle_id = v.id), 0),
             COALESCE((SELECT MAX(f.meter_reading)
                       FROM fuel_entries f WHERE f.vehicle_id = v.id), 0)
           ), 0) AS "lastMeter"
    FROM vehicles v
    WHERE v.active = true
    ORDER BY v.vehicle_no
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.map(r => ({
    ...r,
    out: r.out === true || r.out === "t",
    lastMeter: r.lastMeter === null ? null : Number(r.lastMeter),
  }));
}

// Vehicles out right now, for the Who's Out board.
export async function vehiclesOut() {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT t.id, t.out_at AS "outAt", t.meter_out AS "meterOut",
           COALESCE(t.destination, '') AS destination, COALESCE(t.purpose, '') AS purpose,
           v.vehicle_no AS "vehicleNo", COALESCE(v.name, '') AS "vehicleName",
           COALESCE(NULLIF(TRIM(e.first_name || ' ' || e.last_name), ''), NULLIF(TRIM(t.driver_name), ''), '—') AS driver,
           COALESCE(
             (SELECT json_agg(o.name ORDER BY o.id) FROM fleet_trip_officers o WHERE o.trip_id = t.id),
             '[]'::json
           ) AS officers
    FROM fleet_trips t
    JOIN vehicles v ON v.id = t.vehicle_id
    LEFT JOIN employees e ON e.id = t.driver_id
    WHERE t.in_at IS NULL
    ORDER BY t.out_at
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.map(r => ({ ...r, outAt: new Date(r.outAt).toISOString(), officers: r.officers ?? [] }));
}

// Shared by the terminal and the Log Book's inline edit: the odometer only
// goes forward, so refuse a reading that would move it back. Returns an error
// message naming where the earlier reading came from, or null when it's fine.
export async function checkMeterForward(vehicleId: number, meter: number): Promise<string | null> {
  const last = await lastMeterReading(vehicleId);
  if (last && meter < last.km) {
    return `Meter reads ${meter} km, but this vehicle was last on ${last.km} km (${last.from}). Check the reading.`;
  }
  return null;
}

export type LogBookTrip = {
  id: number;
  date: string;
  outAt: string;
  inAt: string | null;
  driver: string;
  destination: string;
  purpose: string;
  meterOut: number;
  meterIn: number | null;
  kmCovered: number | null;
  remarks: string;
  officers: string[];
};

export type LogBookFuel = {
  id: number;
  date: string;
  litres: number;
  rate: number;
  amount: number;
  meterReading: number | null;
  drawnBy: string;
  vendor: string;
  notes: string;
};

// One page of the book: a vehicle's month. `month` is "YYYY-MM".
export async function logBookMonth(vehicleId: number, month: string) {
  await ensureFleetSchema();
  const first = `${month}-01`;
  const tripsRes = await db.execute(sql`
    SELECT t.id, t.date::text AS date, t.out_at AS "outAt", t.in_at AS "inAt",
           COALESCE(NULLIF(TRIM(e.first_name || ' ' || e.last_name), ''), NULLIF(TRIM(t.driver_name), ''), '—') AS driver,
           COALESCE(t.destination, '') AS destination, COALESCE(t.purpose, '') AS purpose,
           t.meter_out AS "meterOut", t.meter_in AS "meterIn", t.km_covered AS "kmCovered",
           COALESCE(t.remarks, '') AS remarks,
           COALESCE(
             (SELECT json_agg(o.name ORDER BY o.id) FROM fleet_trip_officers o WHERE o.trip_id = t.id),
             '[]'::json
           ) AS officers
    FROM fleet_trips t
    LEFT JOIN employees e ON e.id = t.driver_id
    WHERE t.vehicle_id = ${vehicleId}
      AND t.date >= ${first}::date
      AND t.date < (${first}::date + INTERVAL '1 month')
    ORDER BY t.date, t.out_at
  `);
  const fuelRes = await db.execute(sql`
    SELECT f.id, f.date::text AS date, f.litres, f.rate, f.amount,
           f.meter_reading AS "meterReading",
           COALESCE(NULLIF(TRIM(e.first_name || ' ' || e.last_name), ''), '—') AS "drawnBy",
           COALESCE(f.vendor, '') AS vendor, COALESCE(f.notes, '') AS notes
    FROM fuel_entries f
    LEFT JOIN employees e ON e.id = f.drawn_by_id
    WHERE f.vehicle_id = ${vehicleId}
      AND f.date >= ${first}::date
      AND f.date < (${first}::date + INTERVAL '1 month')
    ORDER BY f.date, f.id
  `);
  const tripRows: any[] = (tripsRes as any).rows ?? (tripsRes as any);
  const fuelRows: any[] = (fuelRes as any).rows ?? (fuelRes as any);

  const trips: LogBookTrip[] = tripRows.map(r => ({
    ...r,
    outAt: new Date(r.outAt).toISOString(),
    inAt: r.inAt ? new Date(r.inAt).toISOString() : null,
    meterIn: r.meterIn === null ? null : Number(r.meterIn),
    kmCovered: r.kmCovered === null ? null : Number(r.kmCovered),
    officers: r.officers ?? [],
  }));
  const fuel: LogBookFuel[] = fuelRows.map(r => ({
    ...r,
    litres: Number(r.litres), rate: Number(r.rate), amount: Number(r.amount),
    meterReading: r.meterReading === null ? null : Number(r.meterReading),
  }));

  const km = trips.reduce((s, t) => s + (t.kmCovered ?? 0), 0);
  const litres = fuel.reduce((s, f) => s + f.litres, 0);
  const cost = fuel.reduce((s, f) => s + f.amount, 0);
  return {
    trips, fuel,
    totals: {
      km, litres: Math.round(litres * 100) / 100, cost,
      // "Average to litre" from the top of the paper page. No fuel drawn means
      // no average — not a division by zero, and not a misleading zero either.
      average: litres > 0 ? Math.round((km / litres) * 100) / 100 : null,
      openTrips: trips.filter(t => t.inAt === null).length,
    },
  };
}
