import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { grns } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, fmtDate, FORM_META, type GrnItem } from "@/lib/procurement";
import ProcurementPrint from "@/components/procurement/ProcurementPrint";

export const dynamic = "force-dynamic";

export default async function GrnView({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("grn");
  await ensureProcurementTables();
  const { id } = await params;
  const [g] = await db.select().from(grns).where(eq(grns.id, parseInt(id)));
  if (!g) notFound();
  const items = parseItems<GrnItem>(g.items);
  const m = FORM_META.grn;

  return (
    <div className="fade-up">
      <ProcurementPrint code={m.code} title={m.title} backHref="/procurement/grn">
        <div className="pf-metarow">
          <div className="pf-left">
            <span><b>No.:</b> {g.grnNo}</span>
            {g.poNo != null && <span><b>PO No.:</b> {g.poNo}</span>}
          </div>
          <div className="pf-right"><b>Date:</b> {fmtDate(g.date)}</div>
        </div>

        <table className="pf-table">
          <thead>
            <tr><th style={{ width: 44 }}>S.No</th><th>Gate Pass No.</th><th>Supplier&apos;s Name</th><th>Item</th><th style={{ width: 90 }}>Quantity</th><th>Remarks</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="c">1</td><td></td><td></td><td></td><td></td><td></td></tr>
            ) : items.map(it => (
              <tr key={it.srNo}>
                <td className="c">{it.srNo}</td><td>{it.gatePassNo}</td><td>{it.supplierName}</td><td>{it.item}</td><td className="c">{it.quantity}</td><td>{it.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pf-sign">
          <div><div className="line">Received by{g.receivedBy ? ` — ${g.receivedBy}` : ""}</div><div style={{ fontSize: 11, color: "#555" }}>Store keeper</div></div>
          <div><div className="line">Verified by{g.verifiedBy ? ` — ${g.verifiedBy}` : ""}</div><div style={{ fontSize: 11, color: "#555" }}>Store Manager</div></div>
        </div>
      </ProcurementPrint>
    </div>
  );
}
