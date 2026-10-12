import { db } from "@/lib/db";
import { employees, vehicles } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { logBookMonth } from "@/lib/fleetServer";
import { isViewOnly } from "@/lib/pageGuard";
import { getSession } from "@/lib/auth";
import { roleCanEdit } from "@/lib/permissions";
import { karachiNow } from "@/lib/gateTime";
import { fleetMonth } from "@/lib/fleetMonthly";
import VehiclesTabs from "./VehiclesTabs";

export const dynamic = "force-dynamic";

type SP = { vehicle?: string; month?: string; tab?: string };

// Vehicles, one tab with three views inside it: the Log Book (one vehicle, one
// month, as the book has it), All vehicles (the list, PINs and drivers) and
// the Monthly Report (the fleet sheet the office signs each month).
export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SP> }) {
  // Reads, not just writes: the tables may not exist on this database yet.
  await ensureFleetSchema();
  const sp = await searchParams;
  const tab = sp.tab === "vehicles" ? "vehicles" : sp.tab === "report" ? "report" : "logbook";

  const [list, people, drivers, user] = await Promise.all([
    db.select({
      id: vehicles.id, vehicleNo: vehicles.vehicleNo, name: vehicles.name, active: vehicles.active,
    }).from(vehicles).orderBy(asc(vehicles.vehicleNo)),
    db.select({
      id: employees.id, code: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName, department: employees.department,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    db.select({
      id: employees.id,
      employeeId: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    getSession(),
  ]);

  // Karachi's month: on the server's UTC clock the 1st doesn't start until 5am.
  const month = /^\d{4}-\d{2}$/.test(sp.month || "") ? sp.month! : karachiNow().date.slice(0, 7);

  // Default to the first vehicle still in service, else the first on the list.
  const asked = Number(sp.vehicle);
  const vehicleId = list.some(v => v.id === asked)
    ? asked
    : (list.find(v => v.active)?.id ?? list[0]?.id ?? 0);

  const [page, monthly] = await Promise.all([
    vehicleId ? logBookMonth(vehicleId, month) : Promise.resolve({ trips: [], fuel: [], totals: { km: 0, litres: 0, cost: 0, average: null, openTrips: 0 } }),
    // The month's fleet sheet, for the Monthly Report view.
    fleetMonth(month),
  ]);

  const canDelete = user?.role === "superadmin" || (user ? await roleCanEdit(user.role, "station.delete") : false);

  return (
    <VehiclesTabs
      tab={tab}
      readOnly={await isViewOnly("station")}
      canDelete={canDelete}
      vehicles={list}
      people={people.map(p => ({ id: p.id, code: p.code, name: `${p.firstName} ${p.lastName}`.trim(), department: p.department || "" }))}
      drivers={drivers}
      vehicleId={vehicleId}
      month={month}
      trips={page.trips}
      fuel={page.fuel}
      totals={page.totals}
      monthly={monthly}
    />
  );
}
