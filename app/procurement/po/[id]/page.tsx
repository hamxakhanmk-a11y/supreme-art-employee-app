import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireModule } from "@/lib/pageGuard";
import { ensureProcurementTables, parseItems, fmtDate, poLineMoney, fmtMoney, docNoLabel, FORM_META, FORM_COPIES, type PoItem } from "@/lib/procurement";
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
  // Column totals for the footer row.
  const totals = items.reduce((a, it) => {
    const { gross, taxValue, net } = poLineMoney(it);
    a.gross += gross; a.taxValue += taxValue; a.net += net;
    return a;
  }, { gross: 0, taxValue: 0, net: 0 });

  return (
    <div className="fade-up">
      <ProcurementPrint code={m.code} title={m.title} issue={m.issue} issueDate={m.issueDate}
        copies={FORM_COPIES.po} backHref="/procurement/po" compact
        pdfFilename={`PO-${docNoLabel(p.poNo, p.registered)}.pdf`}>
        <div className="pf-metarow">
          <div className="pf-to">
            <div className="pf-tohead">To:</div>
            <div className="pf-toline"><b>Supplier Name:</b> {p.supplierName || "_______________________________"}</div>
            <div className="pf-toline"><b>Address:</b> {p.supplierAddress || "_______________________________"}</div>
            <div className="pf-toline"><b>Contact #:</b> {p.supplierPhone || "_______________________________"}</div>
            {p.registered != null && (
              <div className="pf-toline"><b>Tax status:</b> {p.registered ? "Registered (sales-tax invoice)" : "Unregistered"}</div>
            )}
          </div>
          <table className="pf-fieldtable">
            <tbody>
              <tr><td>P.O. No:</td><td className="u">{docNoLabel(p.poNo, p.registered)}</td></tr>
              <tr><td>Date:</td><td className="u">{fmtDate(p.date)}</td></tr>
              <tr><td>Delivery Date:</td><td className="u">{fmtDate(p.expectedDate)}</td></tr>
              <tr><td>Demand Form Ref No:</td><td className="u">{p.demandNo ?? ""}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="pf-dear">Dear Sir,</div>
        <div className="pf-intro">You are requested to supply the following item(s) in accordance with the terms &amp; conditions given below:</div>

        <table className="pf-table pf-po-items">
          <thead>
            <tr>
              <th style={{ width: 34 }}>S.No</th>
              <th>Description</th>
              <th style={{ width: 48 }}>Qty</th>
              <th style={{ width: 44 }}>UOM</th>
              <th style={{ width: 62 }}>Rate</th>
              <th style={{ width: 72 }}>Gross</th>
              <th style={{ width: 42 }}>Tax %</th>
              <th style={{ width: 72 }}>Tax Value</th>
              <th style={{ width: 78 }}>Net Value</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="c">1</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            ) : items.map(it => {
              const { rate, gross, taxPct, taxValue, net } = poLineMoney(it);
              return (
                <tr key={it.srNo}>
                  <td className="c">{it.srNo}</td>
                  <td>{it.description || it.item || ""}</td>
                  <td className="c">{it.quantity}</td>
                  <td className="c">{it.uom || ""}</td>
                  <td className="r">{fmtMoney(rate)}</td>
                  <td className="r">{fmtMoney(gross)}</td>
                  <td className="c">{it.tax !== "" && it.tax != null ? `${taxPct}%` : ""}</td>
                  <td className="r">{fmtMoney(taxValue)}</td>
                  <td className="r">{fmtMoney(net)}</td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr>
                <td className="r" colSpan={5}><b>Total</b></td>
                <td className="r"><b>{fmtMoney(totals.gross)}</b></td>
                <td></td>
                <td className="r"><b>{fmtMoney(totals.taxValue)}</b></td>
                <td className="r"><b>{fmtMoney(totals.net)}</b></td>
              </tr>
            </tfoot>
          )}
        </table>

        <div className="pf-closing">Looking forward.</div>

        <div className="pf-terms">
          <div className="pf-termshead">Terms &amp; Conditions</div>
          {termLines.length > 0
            ? (
              <ol className="pf-termslist">
                {termLines.map((t, i) => (
                  <li key={i}>
                    <span className="pf-termnum">{i + 1}.</span>
                    <span className="pf-termtext">{t}</span>
                  </li>
                ))}
              </ol>
            )
            : <div className="pf-termsbox" />}
        </div>

        <div className="pf-sign">
          <div>
            <div className="lbl">Order Placed By:</div>
            <div className="line">{p.orderPlacedBy || ""}</div>
            <div className="cap" />
          </div>
          <div>
            <div className="lbl">Approved By:</div>
            <div className="line">{p.approvedBy || ""}</div>
            <div className="cap">DIRECTOR/CEO</div>
          </div>
        </div>

        <style>{`
          .pf-po-items td.r, .pf-po-items th.r { text-align: right; }
          .pf-po-items tfoot td { border-top: 1.5px solid #000; }
        `}</style>
      </ProcurementPrint>
    </div>
  );
}
