import { db } from "@/lib/db";
import { salaryRecords } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import SalarySlipView from "./SalarySlipView";

export const dynamic = "force-dynamic";

export default async function SalarySlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rec] = await db.select().from(salaryRecords).where(eq(salaryRecords.id, parseInt(id)));
  if (!rec) notFound();
  return <SalarySlipView slip={rec as any} />;
}
