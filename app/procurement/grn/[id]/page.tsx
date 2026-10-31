import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { grns, purchaseOrders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, fmtDate, docNoLabel, FORM_META, FORM_COPIES, parseInspection, qtyDifference, INSPECTION_RESULTS, showsGrammage, showsViscosity, loadChecklist, type GrnItem } from "@/lib/procurement";
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
  // The supplier lives on the PO the goods were ordered on; a standalone GRR
  // has none, so its lines print blank to be written in by hand.
  const [po] = g.poId
    ? await db.select({ supplierName: purchaseOrders.supplierName, supplierBrand: purchaseOrders.supplierBrand })
        .from(purchaseOrders).where(eq(purchaseOrders.id, g.poId))
    : [];
  const m = FORM_META.grn;
  const ins = parseInspection(g.inspection);
  const result = ins.result ? INSPECTION_RESULTS[ins.result] : null;
  const checklist = await loadChecklist();
  const cats = checklist.categories.filter(c => ins.categories.includes(c.id));

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
              <tr><td>GRR No:</td><td className="u">{docNoLabel(g.grnNo, g.registered)}</td></tr>
              <tr><td>Inward gate pass No:</td><td className="u">{g.gatePassNo || ""}</td></tr>
              <tr><td>Inv No:</td><td className="u">{g.invNo || ""}</td></tr>
              <tr><td>DC No:</td><td className="u">{g.dcNo || ""}</td></tr>
            </tbody>
          </table>
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>PO Ref No:</td><td className="u">{g.poNo != null ? docNoLabel(g.poNo, g.registered) : ""}</td></tr>
              <tr><td>Date:</td><td className="u">{fmtDate(g.date)}</td></tr>
              <tr><td>Supplier:</td><td className="u">{po?.supplierName || ""}</td></tr>
              <tr><td>Brand:</td><td className="u">{po?.supplierBrand || ""}</td></tr>
            </tbody>
          </table>
        </div>

        {/* What arrived against what was invoiced. Line remarks sit under the
            table, so the quantities have the width. */}
        <table className="pf-table">
          <thead>
            <tr>
              <th>Item(s)</th>
              <th style={{ width: 105 }}>Invoice Qty</th>
              <th style={{ width: 120 }}>Received Qty</th>
              <th style={{ width: 95 }}>Difference</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td></td><td></td><td></td><td></td></tr>
            ) : items.map(it => {
              const d = qtyDifference(it.invoiceQty, it.quantity);
              return (
                <tr key={it.srNo}>
                  <td>{it.item}</td>
                  <td className="c">{it.invoiceQty || ""}</td>
                  <td className="c">{it.quantity}</td>
                  <td className="c" style={{ fontWeight: 700 }}>{d === null ? "" : d > 0 ? `+${d}` : d}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(() => {
          // One item: its remark as it is. Several: each named, one per line.
          const noted = items.filter(it => (it.remarks || "").trim());
          return (
            <div className="pf-remarks">
              <b>Remarks:</b>{" "}
              {noted.length === 0 ? <span className="u wide" />
                : items.length === 1 ? noted[0].remarks
                : noted.map(it => <div key={it.srNo}>{it.item} — {it.remarks}</div>)}
            </div>
          );
        })()}

        {/* The incoming-material inspection, part of the GRR. Anything not yet
            filled prints blank, to be completed by hand. */}
        <div className="pf-insp">
          <div className="pf-insp-head">
            <span className="pf-insp-title">Incoming Material Inspection</span>
            <span>Date of Inspection: <span className="u">{ins.date ? fmtDate(ins.date) : ""}</span></span>
          </div>
          {[{ title: "General checks (all items)", points: checklist.general }, ...cats.map(c => ({ title: c.label, points: c.points }))].map(grp => (
            <table key={grp.title} className="pf-table pf-points">
              <thead>
                <tr><th style={{ width: 28 }}>No.</th><th>{grp.title}</th><th style={{ width: 38 }}>OK</th><th style={{ width: 52 }}>Not OK</th></tr>
              </thead>
              <tbody>
                {grp.points.map((p, i) => (
                  <tr key={p.key}>
                    <td className="c">{i + 1}</td>
                    <td>{p.text}</td>
                    <td className="c">{ins.checks[p.key] === "ok" ? "☑" : "☐"}</td>
                    <td className="c">{ins.checks[p.key] === "no" ? "☑" : "☐"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          <div className="pf-insp-checks">
            <span>{ins.designSpec ? "☑" : "☐"} As per required design specification</span>
            <span>{ins.approvedSample ? "☑" : "☐"} As per approved sample</span>
            <span>{ins.approvedSupplier ? "☑" : "☐"} As per approved supplier</span>
            {showsGrammage(ins) && <span>Board Grammage: <span className="u">{ins.grammage}</span></span>}
            {showsViscosity(ins) && <span>Viscosity: <span className="u">{ins.viscosity}</span></span>}
          </div>
          {result ? (
            <div className="pf-insp-result" style={{ color: result.color, background: result.bg, borderColor: result.color }}>
              RESULT: {result.label}.
            </div>
          ) : (
            <div className="pf-insp-result pf-insp-result-blank">RESULT: ☐ Accepted &nbsp; ☐ Partly accepted &nbsp; ☐ Rejected</div>
          )}
          <div className="pf-insp-foot">
            <span>Remarks: <span className="u wide">{ins.remarks}</span></span>
          </div>
        </div>

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
