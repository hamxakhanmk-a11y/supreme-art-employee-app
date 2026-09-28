import { db } from "@/lib/db";
import { employees, vehicles } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { psoRegister } from "@/lib/fleetServer";
import { isViewOnly } from "@/lib/pageGuard";
import { getSession } from "@/lib/auth";
import { roleCanEdit } from "@/lib/permissions";
import PsoClient from "./PsoClient";

export const dynamic = "force-dynamic";

type SP = { from?: string; to?: string };

export default async function PsoPage({ searchParams }: { searchParams: Promise<SP> }) {
  await ensureFleetSchema();
  const sp = await searchParams;

  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const from = sp.from || first;
  const to = sp.to || now.toISOString().slice(0, 10);

  const [rows, vehicleList, people, user] = await Promise.all([
    psoRegister(from, to),
    db.select({ id: vehicles.id, vehicleNo: vehicles.vehicleNo, name: vehicles.name, active: vehicles.active })
      .from(vehicles).orderBy(asc(vehicles.vehicleNo)),
    db.select({
      id: employees.id, code: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    getSession(),
  ]);

  const canDelete = user?.role === "superadmin" || (user ? await roleCanEdit(user.role, "station.delete") : false);

  return (
    <PsoClient
      rows={rows}
      vehicles={vehicleList}
      people={people.map(p => ({ id: p.id, code: p.code, name: `${p.firstName} ${p.lastName}`.trim() }))}
      from={from}
      to={to}
      readOnly={await isViewOnly("station")}
      canDelete={canDelete}
    />
  );
}
