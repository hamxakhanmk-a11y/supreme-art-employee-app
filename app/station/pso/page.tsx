import { db } from "@/lib/db";
import { employees, vehicles } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { custodyOn } from "@/lib/fleetServer";
import { isViewOnly } from "@/lib/pageGuard";
import PsoCardsClient from "./PsoCardsClient";

export const dynamic = "force-dynamic";

type SP = { date?: string };

export default async function PsoCardsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await ensureFleetSchema();
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || "") ? sp.date! : today;
  const isToday = date === today;

  const [vehicleList, people, custody] = await Promise.all([
    db.select({ id: vehicles.id, vehicleNo: vehicles.vehicleNo, name: vehicles.name, active: vehicles.active })
      .from(vehicles).orderBy(asc(vehicles.vehicleNo)),
    db.select({
      id: employees.id, code: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    // Who held what that day. On today this is the same set the cards
    // themselves report, but it carries the times and what was drawn.
    custodyOn(date),
  ]);

  return (
    <PsoCardsClient
      vehicles={vehicleList}
      people={people.map(p => ({ id: p.id, code: p.code, name: `${p.firstName} ${p.lastName}`.trim() }))}
      readOnly={await isViewOnly("station")}
      custody={custody}
      date={date}
      isToday={isToday}
    />
  );
}
