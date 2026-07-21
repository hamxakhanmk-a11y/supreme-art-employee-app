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
  const termLines = (p.terms || "").split("\n").map(t => t.trim()).filter(Boolean);

  return (
    <div className="fade-up">
      <ProcurementPrint code={m.code} title={m.title} issue={m.issue} issueDate={m.issueDate} backHref="/procurement/po">
        <div className="pf-metarow">
          <div className="pf-to">
            <div className="pf-tohead">To:</div>
            <div className="pf-toline"><b>Supplier Name:</b> {p.supplierName || "_______________________________"}</div>
            <div className="pf-toline"><b>Address:</b> {p.supplierAddress || "_______________________________"}</div>
            <div className="pf-toline"><b>Contact #:</b> {p.supplierPhone || "_______________________________"}</div>
          </div>
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>P.O. No:</td><td className="u">{p.poNo}</td></tr>
              <tr><td>Date:</td><td className="u">{fmtDate(p.date)}</td></tr>
              <tr><td>Delivery Date:</td><td className="u">{fmtDate(p.expectedDate)}</td></tr>
              <tr><td>Demand Form No:</td><td className="u">{p.demandNo ?? ""}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="pf-dear">Dear Sir,</div>
        <div className="pf-intro">You are requested to supply the following item(s) in accordance with the terms &amp; conditions given below:</div>

        <table className="pf-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>S.No</th>
              <th>Item Name</th>
              <th>Specifications</th>
              <th style={{ width: 110 }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="c">1</td><td></td><td></td><td></td></tr>
            ) : items.map(it => (
              <tr key={it.srNo}>
                <td className="c">{it.srNo}</td>
                <td>{it.item}</td>
                <td>{it.specifications}</td>
                <td className="c">{it.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pf-closing">Looking forward.</div>

        <div className="pf-terms">
          <div className="pf-termshead">Terms &amp; Conditions</div>
          {termLines.length > 0
            ? <ol>{termLines.map((t, i) => <li key={i}>{t}</li>)}</ol>
            : <div className="pf-termsbox" />}
        </div>

        <div className="pf-sign">
          <div>
            <div className="lbl">Order Placed By:</div>
            <div className="line">{p.orderPlacedBy || ""}</div>
          </div>
          <div>
            <div className="lbl">Approved By:</div>
            <div className="line">{p.approvedBy || ""}</div>
          </div>
        </div>
      </ProcurementPrint>
    </div>
  );
}
