import { db } from "@/lib/db";
import { salaryRecords } from "@/lib/schema";
import { inArray } from "drizzle-orm";
import BulkPrintClient from "./BulkPrintClient";

export const dynamic = "force-dynamic";

export default async function BulkPrintPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const sp = await searchParams;
  const ids = (sp.ids || "").split(",").map(s => parseInt(s.trim())).filter(n => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    return <div className="empty" style={{ padding: "2rem" }}>No slips selected. Go back and tick the slips you want to print.</div>;
  }
  const slips = await db.select().from(salaryRecords).where(inArray(salaryRecords.id, ids));
  // Keep the order the user picked
  const order = new Map(ids.map((id, i) => [id, i]));
  slips.sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return <BulkPrintClient slips={slips as any[]} />;
}
