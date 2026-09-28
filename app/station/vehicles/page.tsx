import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { isViewOnly } from "@/lib/pageGuard";
import VehiclesClient from "./VehiclesClient";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  // Reads, not just writes: the tables may not exist on this database yet.
  await ensureFleetSchema();

  const drivers = await db.select({
    id: employees.id,
    employeeId: employees.employeeId,
    firstName: employees.firstName,
    lastName: employees.lastName,
  }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName);

  return <VehiclesClient drivers={drivers} readOnly={await isViewOnly("station")} />;
}
