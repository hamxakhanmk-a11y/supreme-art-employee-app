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
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>Demand Form No:</td><td className="u">{d.demandNo}</td></tr>
              <tr><td>Demand By:</td><td className="u">{d.demandBy || ""}</td></tr>
            </tbody>
          </table>
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>Date:</td><td className="u">{fmtDate(d.date)}</td></tr>
              <tr><td>Department:</td><td className="u">{d.department || ""}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="pf-intro">
          Kindly allow to arrange the following particulars by <b>{fmtDate(d.requiredBy) || "____________"}</b>.
        </div>

        <table className="pf-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>Sr. No.</th>
              <th>Material required</th>
              <th>Required for</th>
              <th style={{ width: 110 }}>Quantity</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="c">1</td><td></td><td></td><td></td><td></td></tr>
            ) : items.map(it => (
              <tr key={it.srNo}>
                <td className="c">{it.srNo}</td>
                <td>{it.material}</td>
                <td>{it.requiredFor}</td>
                <td className="c">{it.quantity}</td>
                <td>{it.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pf-sign">
          <div>
            <div className="lbl">Prepared By:</div>
            <div className="line">{d.preparedBy || ""}</div>
          </div>
          <div>
            <div className="lbl">Approved By:</div>
            <div className="line">{d.approvedBy || ""}</div>
          </div>
        </div>
      </ProcurementPrint>
    </div>
  );
}
