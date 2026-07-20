import { db } from "@/lib/db";
import { demands } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables } from "@/lib/procurement";
import DemandClient from "./DemandClient";

export const dynamic = "force-dynamic";

export default async function DemandPage() {
  await requireModule("demand");
  await ensureProcurementTables();
  const rows = await db.select().from(demands).orderBy(desc(demands.demandNo));
  return <DemandClient rows={rows} />;
}
