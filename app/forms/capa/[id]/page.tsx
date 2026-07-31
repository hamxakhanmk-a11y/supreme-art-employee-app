import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { capaReports } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureCapaTable } from "@/lib/capa";
import CapaFormClient from "./CapaFormClient";

export const dynamic = "force-dynamic";

export default async function CapaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("capa");
  await ensureCapaTable();
  const { id } = await params;
  const capaId = parseInt(id);
  if (isNaN(capaId)) notFound();
  const [row] = await db.select().from(capaReports).where(eq(capaReports.id, capaId));
  if (!row) notFound();

  return (
    <CapaFormClient
      capa={{
        id: row.id,
        capaRef: row.capaRef,
        status: row.status,
        issueDate: row.issueDate,
        data: row.data,
        createdByName: row.createdByName,
      }}
    />
  );
}
