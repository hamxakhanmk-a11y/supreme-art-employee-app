import { db } from "@/lib/db";
import { employees, vehicles } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { logBookMonth } from "@/lib/fleetServer";
import { isViewOnly } from "@/lib/pageGuard";
import { getSession } from "@/lib/auth";
import { roleCanEdit } from "@/lib/permissions";
import { karachiNow } from "@/lib/gateTime";
import { redirect } from "next/navigation";
import VehiclesTabs from "./VehiclesTabs";

export const dynamic = "force-dynamic";

type SP = { vehicle?: string; month?: string; tab?: string };

// Vehicles, one tab with two views inside it: the Log Book (one vehicle, one
// month, as the book has it) and All vehicles (the list, PINs and drivers).
export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SP> }) {
  // Reads, not just writes: the tables may not exist on this database yet.
  await ensureFleetSchema();
  const sp = await searchParams;
  // The Monthly Report has its own Station tab now; old links land there.
  if (sp.tab === "report") redirect(sp.month ? `/station/monthly?month=${sp.month}` : "/station/monthly");
  const tab = sp.tab === "vehicles" ? "vehicles" : "logbook";

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

  const page = vehicleId ? await logBookMonth(vehicleId, month) : { trips: [], fuel: [], totals: { km: 0, litres: 0, cost: 0, average: null, openTrips: 0 } };

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
    />
  );
}
