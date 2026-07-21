"use client";
import Link from "next/link";
import { COMPANY } from "@/lib/procurement";

// Shared A4 print shell for the three procurement forms. Client component so
// styled-jsx is allowed (it breaks the build in a Server Component).
// The header reproduces the controlled-document block from the Word originals:
// a 4-cell control strip over a logo cell beside the system + form title.
export default function ProcurementPrint({
  code, title, issue, issueDate, backHref, children,
}: {
  code: string; title: string; issue: string; issueDate: string;
  backHref: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Link href={backHref} className="btn">← Back</Link>
        <button onClick={() => window.print()} className="btn btn-primary">🖨 Print</button>
      </div>

      <div className="pf-sheet">
        <table className="pf-head">
          <tbody>
            <tr className="pf-ctrl">
              <td style={{ width: "26%" }}><b>{code}</b></td>
              <td style={{ width: "24%" }}>Issue Status:&nbsp;&nbsp;&nbsp;&nbsp;{issue}</td>
              <td style={{ width: "28%" }}>Issue date {issueDate}</td>
              <td style={{ width: "22%" }}>Page 1 of 1</td>
            </tr>
            <tr>
              <td className="pf-logo" rowSpan={2}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt={COMPANY.name} />
                <div className="pf-org">
                  <div className="pf-orgname">{COMPANY.name}</div>
                  <div>{COMPANY.address}</div>
                  <div>Phone: {COMPANY.phone}</div>
                  <div>NTN: {COMPANY.ntn} &nbsp;·&nbsp; STRN: {COMPANY.strn}</div>
                </div>
              </td>
              <td className="pf-band" colSpan={3}>QUALITY &amp; ENVIRONMENTAL SYSTEM</td>
            </tr>
            <tr>
              <td className="pf-band pf-formtitle" colSpan={3}>{title}</td>
            </tr>
          </tbody>
        </table>

        {children}
      </div>

      <style jsx global>{`
        /* Serif throughout so the printed sheet reads like the Word original. */
        .pf-sheet {
          background: #fff; color: #000; max-width: 820px; margin: 0 auto;
          padding: 26px 30px; font-size: 14px;
          font-family: "Times New Roman", Times, serif;
        }
        /* --- controlled-document header --- */
        .pf-head { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .pf-head td { border: 1px solid #000; padding: 5px 8px; }
        .pf-ctrl td { font-size: 12px; }
        .pf-logo { width: 250px; text-align: center; vertical-align: middle; padding: 8px !important; }
        .pf-logo img { width: 150px; height: auto; object-fit: contain; }
        .pf-org { font-size: 9px; line-height: 1.45; color: #222; margin-top: 4px; }
        .pf-orgname { font-weight: 700; font-size: 10px; }
        .pf-band {
          text-align: center; font-weight: 700; color: #595959;
          font-size: 17px; letter-spacing: 0.3px; padding: 12px 8px !important;
        }
        .pf-formtitle { font-size: 19px; }

        /* --- body --- */
        .pf-meta { display: flex; flex-wrap: wrap; gap: 6px 26px; margin: 6px 0 14px; font-size: 13px; }
        .pf-meta b { font-weight: 700; }
        /* left content with the date pushed to the right edge */
        .pf-metarow { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin: 6px 0 14px; font-size: 13px; }
        .pf-metarow .pf-left { display: flex; flex-wrap: wrap; gap: 6px 26px; }
        .pf-metarow .pf-right { margin-left: auto; text-align: right; white-space: nowrap; }
        .pf-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .pf-table th, .pf-table td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; vertical-align: top; }
        /* Override the app's global uppercase/letter-spaced table headings —
           the originals use plain mixed case ("Sr. No.", "Material required"). */
        .pf-table th {
          background: #f2f2f2; font-weight: 700; text-align: left;
          text-transform: none; letter-spacing: normal; color: #000;
        }
        .pf-table td.c { text-align: center; }
        .pf-sign { display: flex; justify-content: space-between; gap: 30px; margin-top: 30px; flex-wrap: wrap; }
        .pf-sign > div { flex: 1; min-width: 180px; text-align: center; }
        .pf-sign .line { border-top: 1px solid #000; margin-top: 34px; padding-top: 4px; font-size: 12px; }
        .pf-remark { margin-top: 14px; font-size: 12px; }
        @media print {
          /* Zero page margin leaves the browser no room to draw its own
             date / title / URL / page-number headers. The sheet supplies the
             real margin as padding instead. */
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff; margin: 0 !important; padding: 0 !important; }
          .no-print, header, nav { display: none !important; }
          .pf-sheet { border: none; max-width: 100%; padding: 14mm 12mm; }
          .pf-formtitle { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
