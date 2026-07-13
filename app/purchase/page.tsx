import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/schema";
import { sql } from "drizzle-orm";
import PurchaseClient from "./PurchaseClient";

export const dynamic = "force-dynamic";

export default async function PurchasePage() {
  const rows = await db.select().from(purchaseRequisitions)
    .orderBy(sql`pr_no DESC NULLS LAST, date DESC NULLS LAST`);
  return <PurchaseClient initialRows={rows} />;
}
