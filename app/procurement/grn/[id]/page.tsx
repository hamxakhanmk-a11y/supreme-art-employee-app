import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { grns } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, fmtDate, docNoLabel, FORM_META, FORM_COPIES, type GrnItem } from "@/lib/procurement";
import ProcurementPrint from "@/components/procurement/ProcurementPrint";

export const dynamic = "force-dynamic";

export default async function GrnView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ref?: string }> }) {
  const fromReport = (await searchParams).ref === "report";
  await requireModule("grn");
  await ensureProcurementTables();
  const { id } = await params;
  const [g] = await db.select().from(grns).where(eq(grns.id, parseInt(id)));
  if (!g) notFound();
  const items = parseItems<GrnItem>(g.items);
  const m = FORM_META.grn;

  return (
    <div className="fade-up">
      <ProcurementPrint code={m.code} title={m.title} issue={m.issue} issueDate={m.issueDate}
        copies={FORM_COPIES.grn}
        backHref={fromReport ? "/reports/procurement" : "/procurement/grn"}
        backLabel={fromReport ? "← Back to Report" : "← Back"}
        pdfFilename={`GRR-${g.gatePassNo || g.id}.pdf`}>
        <div className="pf-metarow">
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>GRR No:</td><td className="u">{docNoLabel(g.grnNo)}</td></tr>
              <tr><td>Inward gate pass No:</td><td className="u">{g.gatePassNo || ""}</td></tr>
              <tr><td>Inv No:</td><td className="u">{g.invNo || ""}</td></tr>
            </tbody>
          </table>
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>PO Ref No:</td><td className="u">{g.poNo != null ? docNoLabel(g.poNo) : ""}</td></tr>
              <tr><td>Date:</td><td className="u">{fmtDate(g.date)}</td></tr>
            </tbody>
          </table>
        </div>

        <table className="pf-table">
          <thead>
            <tr>
              <th>Item(s)</th>
              <th style={{ width: 120 }}>Quantity</th>
              <th style={{ width: 200 }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td></td><td></td><td></td></tr>
            ) : items.map(it => (
              <tr key={it.srNo}>
                <td>{it.item}</td>
                <td className="c">{it.quantity}</td>
                <td>{it.remarks || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pf-sign">
          <div>
            <div className="lbl">Checked By</div>
            <div className="line">{g.verifiedBy || ""}</div>
          </div>
          <div>
            <div className="lbl">Received by:<br />Store In-Charge</div>
            <div className="line">{g.receivedBy || ""}</div>
          </div>
        </div>
      </ProcurementPrint>
    </div>
  );
}
