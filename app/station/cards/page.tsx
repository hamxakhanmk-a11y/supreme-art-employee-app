import { db } from "@/lib/db";
import { vehicles } from "@/lib/schema";
import { asc } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { isViewOnly } from "@/lib/pageGuard";
import CardsClient from "./CardsClient";

export const dynamic = "force-dynamic";

export default async function CardMaintenancePage() {
  await ensureFleetSchema();
  const list = await db.select({
    id: vehicles.id, vehicleNo: vehicles.vehicleNo, name: vehicles.name, active: vehicles.active,
  }).from(vehicles).orderBy(asc(vehicles.vehicleNo));

  return <CardsClient vehicles={list} readOnly={await isViewOnly("station")} />;
}
