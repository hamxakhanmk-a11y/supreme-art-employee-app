import { db } from "./db";
import { sql, type SQL } from "drizzle-orm";
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

// The odometer only goes forward — in time, not in order of entry. A trip
// written up the next morning sits between readings that are already there, so
// it is checked against the readings either side of when it happened, rather
// than against the latest one, which would refuse every back-dated trip.
//
// `excludeTripId` leaves out the trip being closed, whose own opening reading
// is not a neighbour of itself.
export async function meterCheckAt(
  vehicleId: number, at: SQL, meter: number, excludeTripId = 0,
): Promise<string | null> {
  const res = await db.execute(sql`
    WITH readings AS (
      SELECT meter_out AS km, out_at AS ts FROM fleet_trips
      WHERE vehicle_id = ${vehicleId} AND id <> ${excludeTripId}
      UNION ALL
      SELECT meter_in AS km, in_at AS ts FROM fleet_trips
      WHERE vehicle_id = ${vehicleId} AND id <> ${excludeTripId}
        AND meter_in IS NOT NULL AND in_at IS NOT NULL
    )
    SELECT
      (SELECT MAX(km) FROM readings WHERE ts <= ${at}) AS before,
      (SELECT MIN(km) FROM readings WHERE ts > ${at}) AS after
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  const before = rows[0]?.before == null ? null : Number(rows[0].before);
  const after = rows[0]?.after == null ? null : Number(rows[0].after);
  if (before !== null && meter < before) {
    return `Meter reads ${meter} km, but this vehicle was already on ${before} km before then. Check the reading, or the date and time.`;
  }
  if (after !== null && meter > after) {
    return `Meter reads ${meter} km, but this vehicle was on ${after} km later than that. Check the reading, or the date and time.`;
  }
  return null;
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
  // Written by a submitted PSO card rather than typed in here.
  fromCard: boolean;
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
           COALESCE(f.vendor, '') AS vendor, COALESCE(f.notes, '') AS notes,
           (f.card_issue_id IS NOT NULL) AS "fromCard"
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
    fromCard: r.fromCard === true || r.fromCard === "t",
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

export type PsoRow = {
  id: number;
  cardId: number;
  sn: string;
  vehicleId: number | null;
  vehicleNo: string;
  driverId: number | null;
  driver: string;
  collectedDate: string;
  collectedTime: string;
  submittedDate: string | null;
  submittedTime: string;
  amount: number | null;
  litres: number | null;
  rate: number | null;
  slipNo: string;
  notes: string;
};

// The PSO card register over a date range, read on the collection date — that
// is the day the card left, and the day the register is written against.
// Cards still out are included whatever the range's end, since an unsubmitted
// card is the thing you most need to see.
export async function psoRegister(from: string, to: string): Promise<PsoRow[]> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT i.id, i.card_id AS "cardId", c.sn,
           i.vehicle_id AS "vehicleId", COALESCE(v.vehicle_no, '—') AS "vehicleNo",
           i.driver_id AS "driverId",
           COALESCE(NULLIF(TRIM(e.first_name || ' ' || e.last_name), ''), NULLIF(TRIM(i.driver_name), ''), '—') AS driver,
           i.collected_date::text AS "collectedDate", COALESCE(i.collected_time, '') AS "collectedTime",
           i.submitted_date::text AS "submittedDate", COALESCE(i.submitted_time, '') AS "submittedTime",
           i.amount, i.litres, i.rate, COALESCE(i.slip_no, '') AS "slipNo",
           COALESCE(i.notes, '') AS notes
    FROM pso_card_issues i
    JOIN pso_cards c ON c.id = i.card_id
    LEFT JOIN vehicles v ON v.id = i.vehicle_id
    LEFT JOIN employees e ON e.id = i.driver_id
    WHERE i.collected_date BETWEEN ${from}::date AND ${to}::date
    ORDER BY i.collected_date DESC, i.id DESC
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.map(r => ({
    ...r,
    amount: r.amount === null ? null : Number(r.amount),
    litres: r.litres === null ? null : Number(r.litres),
    rate: r.rate === null ? null : Number(r.rate),
  }));
}

export type OpenCard = {
  cardId: number;
  sn: string;
  takenBy: string;
  collectedDate: string;
  collectedTime: string;
};

export type DrawerCard = { id: number; sn: string; vehicleNo: string | null; own: boolean };

// The card this vehicle is out with, read off the card itself: custody lives
// there because a card stays with a driver across many fills.
export async function openCardForVehicle(vehicleId: number): Promise<OpenCard | null> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT c.id AS "cardId", c.sn,
           COALESCE(NULLIF(TRIM(c.held_by_name), ''), '—') AS "takenBy",
           -- From the open hand-over, which carries the time and any correction
           -- made since in the Cards Logbook.
           COALESCE(s.taken_date::text, c.held_since::text, '') AS "collectedDate",
           COALESCE(s.taken_time, '') AS "collectedTime"
    FROM pso_cards c
    LEFT JOIN pso_card_custody s ON s.card_id = c.id AND s.returned_date IS NULL
    WHERE c.vehicle_id = ${vehicleId} AND c.held_by_name IS NOT NULL
    ORDER BY c.id
    LIMIT 1
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.length ? rows[0] : null;
}
// Cards that can be handed out: in the drawer, not written off. This vehicle's
// own card is flagged so the terminal can preselect it — which is the whole
// point, since it is the one the driver will almost always be taking.
export async function cardsInDrawer(vehicleId: number): Promise<DrawerCard[]> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT c.id, c.sn, v.vehicle_no AS "vehicleNo", (c.vehicle_id = ${vehicleId}) AS own
    FROM pso_cards c
    LEFT JOIN vehicles v ON v.id = c.vehicle_id
    WHERE c.status NOT IN ('blocked', 'lost')
      AND c.held_by_name IS NULL
    ORDER BY (c.vehicle_id = ${vehicleId}) DESC, c.sn
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.map(r => ({ ...r, own: r.own === true || r.own === "t" }));
}

export type CustodyRow = {
  cardId: number;
  sn: string;
  vehicleNo: string | null;
  holder: string;
  takenDate: string;
  takenTime: string;
  returnedDate: string | null;
  returnedTime: string;
  fills: number;
  amount: number;
};

// Who held which card on a given day. A spell counts if it had started by then
// and had not ended before it — so a card out for a fortnight answers for every
// day of that fortnight, not just the day it was handed over.
export async function custodyOn(date: string): Promise<CustodyRow[]> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT h.card_id AS "cardId", c.sn, v.vehicle_no AS "vehicleNo",
           h.holder_name AS holder,
           h.taken_date::text AS "takenDate", COALESCE(h.taken_time, '') AS "takenTime",
           h.returned_date::text AS "returnedDate", COALESCE(h.returned_time, '') AS "returnedTime",
           -- What was drawn on the card while this person had it.
           COALESCE((
             SELECT COUNT(*) FROM pso_card_issues i
             WHERE i.card_id = h.card_id
               AND i.collected_date >= h.taken_date
               AND (h.returned_date IS NULL OR i.collected_date <= h.returned_date)
           ), 0) AS fills,
           COALESCE((
             SELECT SUM(i.amount) FROM pso_card_issues i
             WHERE i.card_id = h.card_id
               AND i.collected_date >= h.taken_date
               AND (h.returned_date IS NULL OR i.collected_date <= h.returned_date)
           ), 0) AS amount
    FROM pso_card_custody h
    JOIN pso_cards c ON c.id = h.card_id
    LEFT JOIN vehicles v ON v.id = c.vehicle_id
    WHERE h.taken_date <= ${date}::date
      AND (h.returned_date IS NULL OR h.returned_date >= ${date}::date)
    ORDER BY c.sn
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.map(r => ({ ...r, fills: Number(r.fills), amount: Number(r.amount) }));
}

// Every vehicle journey on a given day, closed or not — the fleet half of the
// Who's Out board once it is looking at a day other than today.
export async function tripsOn(date: string) {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT t.id, t.out_at AS "outAt", t.in_at AS "inAt",
           t.meter_out AS "meterOut", t.meter_in AS "meterIn", t.km_covered AS "kmCovered",
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
    WHERE t.date = ${date}::date
    ORDER BY t.out_at
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.map(r => ({
    ...r,
    outAt: new Date(r.outAt).toISOString(),
    inAt: r.inAt ? new Date(r.inAt).toISOString() : null,
    officers: r.officers ?? [],
  }));
}
