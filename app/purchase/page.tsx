import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/schema";
import { desc } from "drizzle-orm";
import PurchaseClient from "./PurchaseClient";

export const dynamic = "force-dynamic";

export default async function PurchasePage() {
  const rows = await db.select().from(purchaseRequisitions)
    .orderBy(desc(purchaseRequisitions.prNo));
  return <PurchaseClient initialRows={rows} />;
}
