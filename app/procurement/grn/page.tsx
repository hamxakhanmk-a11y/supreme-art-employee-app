import { db } from "@/lib/db";
import { grns, purchaseOrders } from "@/lib/schema";
import { desc, notInArray } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, computePoReceipts, type PoItem, type GrnItem } from "@/lib/procurement";
import GrnClient from "./GrnClient";

export const dynamic = "force-dynamic";

export default async function GrnPage() {
  await requireModule("grn");
  await ensureProcurementTables();
  const [rows, pos] = await Promise.all([
    db.select().from(grns).orderBy(desc(grns.grnNo)),
    // POs still awaiting goods — fully received & closed ones drop out of the picker.
    db.select().from(purchaseOrders)
      .where(notInArray(purchaseOrders.status, ["received", "closed"]))
      .orderBy(desc(purchaseOrders.poNo)),
  ]);

  // For each open PO, work out which lines are still outstanding (and by how
  // much) so the GRN picker only offers what hasn't been received yet.
  const openPos = pos.map(p => {
    const poItems = parseItems<PoItem>(p.items);
    const grnItems = rows.filter(g => g.poId === p.id).flatMap(g => parseItems<GrnItem>(g.items));
    const outstanding = computePoReceipts(poItems, grnItems)
      .filter(r => !r.fulfilled)
      .map(r => ({
        poSrNo: r.srNo,
        item: r.description,
        uom: r.uom,
        remaining: r.remaining != null ? String(r.remaining) : "",
        ordered: r.orderedRaw,
      }));
    return { id: p.id, poNo: p.poNo, registered: p.registered, supplierName: p.supplierName, outstanding };
  }).filter(p => p.outstanding.length > 0);

  return <GrnClient rows={rows} openPos={openPos} />;
}
