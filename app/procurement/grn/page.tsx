import { db } from "@/lib/db";
import { grns, purchaseOrders } from "@/lib/schema";
import { desc, ne } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables } from "@/lib/procurement";
import GrnClient from "./GrnClient";

export const dynamic = "force-dynamic";

export default async function GrnPage() {
  await requireModule("grn");
  await ensureProcurementTables();
  const [rows, openPos] = await Promise.all([
    db.select().from(grns).orderBy(desc(grns.grnNo)),
    db.select().from(purchaseOrders).where(ne(purchaseOrders.status, "closed")).orderBy(desc(purchaseOrders.poNo)),
  ]);
  return <GrnClient rows={rows} openPos={openPos} />;
}
