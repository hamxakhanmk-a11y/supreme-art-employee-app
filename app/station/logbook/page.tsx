import { db } from "@/lib/db";
import { employees, vehicles } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { logBookMonth } from "@/lib/fleetServer";
import { isViewOnly } from "@/lib/pageGuard";
import { getSession } from "@/lib/auth";
import { roleCanEdit } from "@/lib/permissions";
import LogBookClient from "./LogBookClient";

export const dynamic = "force-dynamic";

type SP = { vehicle?: string; month?: string };

export default async function LogBookPage({ searchParams }: { searchParams: Promise<SP> }) {
  // A read, and the tables may not exist on this database yet.
  await ensureFleetSchema();
  const sp = await searchParams;

  const [list, people, user] = await Promise.all([
    db.select({
      id: vehicles.id, vehicleNo: vehicles.vehicleNo, name: vehicles.name, active: vehicles.active,
    }).from(vehicles).orderBy(asc(vehicles.vehicleNo)),
    db.select({
      id: employees.id, code: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName, department: employees.department,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    getSession(),
  ]);

  const now = new Date();
  const month = /^\d{4}-\d{2}$/.test(sp.month || "")
    ? sp.month!
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Default to the first vehicle still in service, else the first on the list.
  const asked = Number(sp.vehicle);
  const vehicleId = list.some(v => v.id === asked)
    ? asked
    : (list.find(v => v.active)?.id ?? list[0]?.id ?? 0);

  const page = vehicleId ? await logBookMonth(vehicleId, month) : { trips: [], fuel: [], totals: { km: 0, litres: 0, cost: 0, average: null, openTrips: 0 } };

  const canDelete = user?.role === "superadmin" || (user ? await roleCanEdit(user.role, "station.delete") : false);

  return (
    <LogBookClient
      vehicles={list}
      people={people.map(p => ({ id: p.id, code: p.code, name: `${p.firstName} ${p.lastName}`.trim(), department: p.department || "" }))}
      vehicleId={vehicleId}
      month={month}
      trips={page.trips}
      fuel={page.fuel}
      totals={page.totals}
      readOnly={await isViewOnly("station")}
      canDelete={canDelete}
    />
  );
}
