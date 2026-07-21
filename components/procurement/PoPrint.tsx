"use client";
import Link from "next/link";
import { COMPANY, lineTotal, money, fmtDate, type PoItem } from "@/lib/procurement";

// Purchase Order laid out like the reference PO: company block + doc-control
// box, To / P.O. details columns, priced item table, totals, terms, sign-off.
export default function PoPrint({
  po, items, code, issue, issueDate,
}: {
  po: {
    poNo: number; demandNo: number | null; date: string;
    supplierName: string | null; supplierAddress: string | null;
    supplierContact: string | null; supplierPhone: string | null;
    expectedDate: string | null; specification: string | null;
    terms: string | null; discount: number | null;
    orderPlacedBy: string | null; approvedBy: string | null;
  };
  items: PoItem[];
  code: string; issue: string; issueDate: string;
}) {
  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const discount = Number(po.discount ?? 0);
  const total = subtotal - discount;
  const termLines = (po.terms || "").split("\n").map(t => t.trim()).filter(Boolean);

  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Link href="/procurement/po" className="btn">← Back</Link>
        <button onClick={() => window.print()} className="btn btn-primary">🖨 Print</button>
      </div>

      <div className="po-sheet">
        {/* ---- header: company block | doc control ---- */}
        <div className="po-head">
          <div className="po-org">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={COMPANY.name} />
            <div className="po-orgtext">
              <div className="po-orgname">{COMPANY.name}</div>
              <div>{COMPANY.address}</div>
              <div>Phone No: {COMPANY.phone}</div>
              <div>NTN: {COMPANY.ntn}</div>
              <div>Sales Tax Reg. No. {COMPANY.strn}</div>
            </div>
          </div>
          <table className="po-doc">
            <tbody>
              <tr><td>Doc No:</td><td className="u">{code}</td></tr>
              <tr><td>Rev. No:</td><td className="u">{issue}</td></tr>
              <tr><td>Rev. Date:</td><td className="u">{issueDate}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="po-rule" />

        <div className="po-title">PURCHASE ORDER</div>

        {/* ---- To ... | P.O. details ---- */}
        <div className="po-parties">
          <div className="po-to">
            <div className="po-torow"><span className="po-tolabel">To :</span><b>{po.supplierName || "____________________"}</b></div>
            {po.supplierContact && <div className="po-toline">{po.supplierContact}</div>}
            {po.supplierAddress && <div className="po-toline">{po.supplierAddress}</div>}
            {po.supplierPhone && <div className="po-toline">{po.supplierPhone}</div>}
          </div>
          <table className="po-meta">
            <tbody>
              <tr><td>P.O. No:</td><td className="u">{po.poNo}</td></tr>
              <tr><td>Date:</td><td className="u">{fmtDate(po.date)}</td></tr>
              <tr><td>Delivery Date:</td><td className="u">{fmtDate(po.expectedDate)}</td></tr>
              <tr><td>Demand Form #:</td><td className="u">{po.demandNo ?? ""}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="po-dear">Dear Sir,</div>
        <div className="po-intro">Please arrange to supply the following good(s) in accordance with the terms &amp; conditions given below:</div>

        {/* ---- items ---- */}
        <table className="po-items">
          <thead>
            <tr>
              <th style={{ width: 46 }}>Sr.No</th>
              <th style={{ width: 90 }}>Item Code</th>
              <th>Item Name</th>
              <th style={{ width: 90 }}>Quantity</th>
              <th style={{ width: 58 }}>UOM</th>
              <th style={{ width: 110 }}>Specification</th>
              <th style={{ width: 90 }}>Price</th>
              <th style={{ width: 100 }}>Total Value</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="c">1</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            ) : items.map(it => (
              <tr key={it.srNo}>
                <td className="c">{it.srNo}</td>
                <td>{it.itemCode}</td>
                <td>{it.item}</td>
                <td className="r">{it.quantity}</td>
                <td className="c">{it.uom}</td>
                <td>{it.specifications}</td>
                <td className="r">{it.price}</td>
                <td className="r">{money(lineTotal(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- totals ---- */}
        <div className="po-totalswrap">
          <table className="po-totals">
            <tbody>
              <tr><td>Total before Discount</td><td className="r">{money(subtotal)}</td></tr>
              <tr><td>Discount</td><td className="r">{money(discount)}</td></tr>
              <tr><td><b>Total Amount</b></td><td className="r"><b>{money(total)}</b></td></tr>
            </tbody>
          </table>
        </div>

        {po.specification && (
          <div className="po-spec"><b>Specification :</b>&nbsp;&nbsp;{po.specification}</div>
        )}

        {termLines.length > 0 && (
          <div className="po-terms">
            <div className="po-termshead">Terms &amp; Conditions</div>
            <ol>{termLines.map((t, i) => <li key={i}>{t}</li>)}</ol>
          </div>
        )}

        <div className="po-approve">
          <div><b>Approved By :</b></div>
          <div className="po-sigspace" />
          <div className="po-signame">{po.approvedBy || "____________________"}</div>
          {po.orderPlacedBy && <div className="po-sigrole">Order placed by: {po.orderPlacedBy}</div>}
        </div>

        <div className="po-rule" />
        <div className="po-printed"><b>Printed Date :</b> {new Date().toLocaleDateString("en-GB")}</div>
      </div>

      <style jsx global>{`
        .po-sheet {
          background: #fff; color: #000; max-width: 860px; margin: 0 auto;
          font-family: "Times New Roman", Times, serif; font-size: 13px; padding: 24px 28px;
        }
        .po-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        .po-org { display: flex; align-items: flex-start; gap: 14px; }
        .po-org img { width: 110px; height: auto; object-fit: contain; }
        .po-orgtext { font-size: 11.5px; line-height: 1.5; }
        .po-orgname { font-weight: 700; font-size: 13px; }
        /* width:auto overrides the global full-width table rule */
        .po-doc { border-collapse: collapse; font-size: 12px; width: auto; }
        .po-doc td { padding: 2px 8px; white-space: nowrap; }
        .po-doc td.u { border-bottom: 1px solid #000; font-weight: 700; min-width: 110px; }
        .po-rule { border-top: 2px solid #000; margin: 8px 0 0; }
        .po-title {
          text-align: center; font-weight: 700; font-size: 17px;
          text-decoration: underline; margin: 12px 0 14px;
        }
        .po-parties { display: flex; justify-content: space-between; gap: 30px; margin-bottom: 12px; }
        .po-to { font-size: 13px; line-height: 1.7; }
        .po-torow { display: flex; gap: 10px; }
        .po-tolabel { font-weight: 700; min-width: 34px; }
        .po-toline { padding-left: 44px; }
        .po-meta { border-collapse: collapse; font-size: 13px; width: auto; }
        .po-meta td { padding: 2px 8px; white-space: nowrap; }
        .po-meta td:first-child { font-weight: 700; }
        .po-meta td.u { border-bottom: 1px solid #000; text-align: right; min-width: 110px; }
        .po-dear { margin-top: 6px; }
        .po-intro { margin: 6px 0 10px; }
        .po-items { width: 100%; border-collapse: collapse; }
        .po-items th, .po-items td { border: 1px solid #000; padding: 5px 7px; font-size: 12px; vertical-align: top; }
        .po-items th {
          background: #f2f2f2; font-weight: 700; text-align: left;
          text-transform: none; letter-spacing: normal; color: #000;
        }
        .po-items td.c { text-align: center; }
        .po-items td.r { text-align: right; }
        .po-totalswrap { display: flex; justify-content: flex-end; margin-top: 10px; }
        .po-totals { border-collapse: collapse; width: auto; border: 1px solid #999; }
        .po-totals td { padding: 4px 14px; font-size: 12.5px; white-space: nowrap; }
        .po-totals td:first-child { min-width: 170px; }
        .po-totals td.r { text-align: right; min-width: 130px; }
        .po-totals tr:last-child td { border-top: 1px solid #000; }
        .po-spec { margin-top: 16px; font-size: 13px; }
        .po-terms { margin-top: 18px; }
        .po-termshead { font-weight: 700; margin-bottom: 6px; }
        .po-terms ol { margin: 0; padding-left: 22px; }
        .po-terms li { font-size: 12px; line-height: 1.65; margin-bottom: 2px; }
        .po-approve { margin-top: 26px; }
        .po-sigspace { height: 48px; }
        .po-signame { font-weight: 700; border-top: 1px solid #000; display: inline-block; padding-top: 3px; min-width: 220px; }
        .po-sigrole { font-size: 11.5px; color: #333; margin-top: 2px; }
        .po-printed { font-size: 11.5px; margin-top: 6px; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff; margin: 0 !important; padding: 0 !important; }
          .no-print, header, nav { display: none !important; }
          .po-sheet { max-width: 100%; padding: 12mm 11mm; }
          .po-items th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
