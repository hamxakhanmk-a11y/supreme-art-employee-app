import { db } from "@/lib/db";
import { capaReports } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureCapaTable } from "@/lib/capa";
import CapaListClient from "./CapaListClient";

export const dynamic = "force-dynamic";

export default async function CapaListPage() {
  await requireModule("capa");
  await ensureCapaTable();
  const rows = await db.select().from(capaReports).orderBy(desc(capaReports.id));
  // Dates aren't serialisable across the server/client boundary as Date objects.
  const capas = rows.map(r => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    closedAt: r.closedAt ? (r.closedAt instanceof Date ? r.closedAt.toISOString() : String(r.closedAt)) : null,
  }));
  return <CapaListClient initial={capas} />;
}
