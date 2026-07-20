import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, fmtDate, FORM_META, type PoItem } from "@/lib/procurement";
import ProcurementPrint from "@/components/procurement/ProcurementPrint";

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
      <ProcurementPrint code={m.code} title={m.title} backHref="/procurement/po">
        <div className="pf-metarow">
          <div className="pf-left">
            <span><b>PO No.:</b> {p.poNo}</span>
            <span><b>Demand by:</b> {p.demandByName || "____________"}</span>
            <span><b>Demand Form No.:</b> {p.demandNo ?? "____________"}</span>
          </div>
          <div className="pf-right"><b>Issue date:</b> {fmtDate(p.date)}</div>
        </div>
        <div className="pf-metarow">
          <div className="pf-left"><span><b>Supplier Name:</b> {p.supplierName || "____________"}</span></div>
          <div className="pf-right"><b>Expected Date:</b> {fmtDate(p.expectedDate) || "____________"}</div>
        </div>
        <div className="pf-remark" style={{ marginBottom: 6 }}>Dear Sir, You are requested to supply the following items:</div>

        <table className="pf-table">
          <thead>
            <tr><th style={{ width: 44 }}>S.No</th><th>Items</th><th>Specifications</th><th>Quality</th><th style={{ width: 110 }}>Quantity</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="c">1</td><td></td><td></td><td></td><td></td></tr>
            ) : items.map(it => (
              <tr key={it.srNo}>
                <td className="c">{it.srNo}</td><td>{it.item}</td><td>{it.specifications}</td><td>{it.quality}</td><td className="c">{it.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {p.remarks && <div className="pf-remark"><b>Remarks:</b> {p.remarks}</div>}

        <div className="pf-sign">
          <div><div className="line">Order placed by{p.orderPlacedBy ? ` — ${p.orderPlacedBy}` : ""}</div></div>
          <div><div className="line">Approved By{p.approvedBy ? ` — ${p.approvedBy}` : ""}</div></div>
        </div>
      </ProcurementPrint>
    </div>
  );
}
