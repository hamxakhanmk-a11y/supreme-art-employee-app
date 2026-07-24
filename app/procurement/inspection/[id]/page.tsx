import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { inspections } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, fmtDate, FORM_META, FORM_COPIES, type InspectionRow } from "@/lib/procurement";
import ProcurementPrint from "@/components/procurement/ProcurementPrint";

export const dynamic = "force-dynamic";

export default async function InspectionView({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("inspection");
  await ensureProcurementTables();
  const { id } = await params;
  const [r] = await db.select().from(inspections).where(eq(inspections.id, parseInt(id)));
  if (!r) notFound();
  const results = parseItems<InspectionRow>(r.results);
  const m = FORM_META.inspection;

  return (
    <div className="fade-up">
      <ProcurementPrint code={m.code} title={m.title} issue={m.issue} issueDate={m.issueDate}
        copies={FORM_COPIES.inspection} backHref="/procurement/inspection"
        pdfFilename={`Inspection-${r.inspNo}.pdf`}>
        <div className="pf-metarow">
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>PO Ref No:</td><td className="u">{r.poNo ?? ""}</td></tr>
            </tbody>
          </table>
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>Date:</td><td className="u">{fmtDate(r.date)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="pf-metarow">
          <div className="pf-left" style={{ display: "flex", gap: "6px 34px", flexWrap: "wrap" }}>
            <span><b>Type of material(s):</b> {r.materialType || "____________"}</span>
            <span><b>Name of supplier:</b> {r.supplierName || "____________"}</span>
          </div>
        </div>

        <div className="pf-remark" style={{ fontWeight: 700, marginBottom: 4 }}>Observations:</div>
        <table className="pf-table">
          <thead>
            <tr>
              <th style={{ width: "26%" }}>Parameters</th>
              <th>Standard</th>
              <th style={{ width: 70 }}>1</th>
              <th style={{ width: 70 }}>2</th>
              <th style={{ width: 70 }}>3</th>
              <th style={{ width: 70 }}>4</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr key={i}>
                <td>{row.parameter}</td>
                <td>{row.standard}</td>
                {[0, 1, 2, 3].map(si => <td key={si} className="c">{row.samples?.[si] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pf-sign">
          <div>
            <div className="lbl">Inspected By:</div>
            <div className="line">{r.inspectedBy || ""}</div>
          </div>
        </div>
      </ProcurementPrint>
    </div>
  );
}
