import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/schema";
import { sql } from "drizzle-orm";
import PurchaseClient from "./PurchaseClient";
import { ensurePurchaseColumns } from "@/lib/purchaseServer";

export const dynamic = "force-dynamic";

export default async function PurchasePage() {
  await ensurePurchaseColumns();
  const rows = await db.select().from(purchaseRequisitions)
    .orderBy(sql`date DESC NULLS LAST, pr_no DESC NULLS LAST`);
  return <PurchaseClient initialRows={rows} />;
}
