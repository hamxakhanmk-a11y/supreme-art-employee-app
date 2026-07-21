import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, FORM_META, type PoItem } from "@/lib/procurement";
import PoPrint from "@/components/procurement/PoPrint";

export const dynamic = "force-dynamic";

export default async function PoView({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("po");
  await ensureProcurementTables();
  const { id } = await params;
  const [p] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, parseInt(id)));
  if (!p) notFound();
  const items = parseItems<PoItem>(p.items);
  const m = FORM_META.po;

  return (
    <div className="fade-up">
      <PoPrint po={p} items={items} code={m.code} issue={m.issue} issueDate={m.issueDate} />
    </div>
  );
}
