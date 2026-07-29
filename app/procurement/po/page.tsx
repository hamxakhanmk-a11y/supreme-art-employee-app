import { db } from "@/lib/db";
import { purchaseOrders, demands, suppliers } from "@/lib/schema";
import { asc, desc, eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables } from "@/lib/procurement";
import PoClient from "./PoClient";

export const dynamic = "force-dynamic";

export default async function PoPage() {
  await requireModule("po");
  await ensureProcurementTables();
  const [rows, openDemands, supplierList] = await Promise.all([
    db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.poNo)),
    db.select().from(demands).where(eq(demands.status, "open")).orderBy(desc(demands.demandNo)),
    db.select().from(suppliers).orderBy(asc(suppliers.name)),
  ]);
  return <PoClient rows={rows} openDemands={openDemands} suppliers={supplierList} />;
}
