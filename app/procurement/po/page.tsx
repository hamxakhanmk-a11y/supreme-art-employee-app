import { db } from "@/lib/db";
import { purchaseOrders, demands } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables } from "@/lib/procurement";
import PoClient from "./PoClient";

export const dynamic = "force-dynamic";

export default async function PoPage() {
  await requireModule("po");
  await ensureProcurementTables();
  const [rows, openDemands] = await Promise.all([
    db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.poNo)),
    db.select().from(demands).where(eq(demands.status, "open")).orderBy(desc(demands.demandNo)),
  ]);
  return <PoClient rows={rows} openDemands={openDemands} />;
}
