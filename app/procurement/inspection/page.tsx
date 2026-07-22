import { db } from "@/lib/db";
import { inspections, purchaseOrders } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables } from "@/lib/procurement";
import InspectionClient from "./InspectionClient";

export const dynamic = "force-dynamic";

export default async function InspectionPage() {
  await requireModule("inspection");
  await ensureProcurementTables();
  const [rows, pos] = await Promise.all([
    db.select().from(inspections).orderBy(desc(inspections.inspNo)),
    db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.poNo)),
  ]);
  return <InspectionClient rows={rows} pos={pos} />;
}
