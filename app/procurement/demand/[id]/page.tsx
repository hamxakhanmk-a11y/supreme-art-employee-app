import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { demands } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, fmtDate, FORM_META, type DemandItem } from "@/lib/procurement";
import ProcurementPrint from "@/components/procurement/ProcurementPrint";

export const dynamic = "force-dynamic";

export default async function DemandView({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("demand");
  await ensureProcurementTables();
  const { id } = await params;
  const [d] = await db.select().from(demands).where(eq(demands.id, parseInt(id)));
  if (!d) notFound();
  const items = parseItems<DemandItem>(d.items);
  const m = FORM_META.demand;

  return (
    <div className="fade-up">
      <ProcurementPrint code={m.code} title={m.title} issue={m.issue} issueDate={m.issueDate} backHref="/procurement/demand">
        <div className="pf-metarow">
          <div className="pf-left"><span><b>Demand form number:</b> {d.demandNo}</span></div>
          <div className="pf-right"><b>Date:</b> {fmtDate(d.date)}</div>
        </div>
        <div className="pf-remark">Kindly allow to arrange the following particulars by <b>{fmtDate(d.requiredBy) || "____________"}</b>.</div>
        <div className="pf-meta" style={{ marginTop: 8 }}>
          {d.demandBy && <span><b>Demand by:</b> {d.demandBy}</span>}
          {d.department && <span><b>Department:</b> {d.department}</span>}
        </div>

        <table className="pf-table">
          <thead>
            <tr><th style={{ width: 44 }}>Sr. No.</th><th>Material required</th><th>Required for</th><th style={{ width: 110 }}>Quantity</th><th>Remarks</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="c">1</td><td></td><td></td><td></td><td></td></tr>
            ) : items.map(it => (
              <tr key={it.srNo}>
                <td className="c">{it.srNo}</td><td>{it.material}</td><td>{it.requiredFor}</td>
                <td className="c">{it.quantity}</td><td>{it.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pf-sign">
          <div><div className="line">Prepared By{d.preparedBy ? ` — ${d.preparedBy}` : ""}</div></div>
          <div><div className="line">Approved By{d.approvedBy ? ` — ${d.approvedBy}` : ""}</div></div>
        </div>
      </ProcurementPrint>
    </div>
  );
}
