"use client";
import Link from "next/link";
import { COMPANY } from "@/lib/procurement";

// Shared A4 print shell for the three procurement forms. Client component so
// styled-jsx is allowed (it breaks the build in a Server Component).
// The header reproduces the block used across the Word templates: a control
// strip (Doc No / Issue Status / Issue date) above the company details.
export default function ProcurementPrint({
  code, title, issue, issueDate, backHref, copies, children,
}: {
  code: string; title: string; issue: string; issueDate: string;
  backHref: string; copies?: string[]; children: React.ReactNode;
}) {
  // One identical page per copy, each named at the foot. Falls back to a
  // single unnamed page if a form has no copy set.
  const sheets = copies?.length ? copies : [""];
  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <Link href={backHref} className="btn">← Back</Link>
        <button onClick={() => window.print()} className="btn btn-primary">🖨 Print</button>
        {sheets.length > 1 && (
          <span style={{ fontSize: 12.5, color: "var(--text2)" }}>
            Prints {sheets.length} pages — {sheets.join(", ")}
          </span>
        )}
      </div>

      {sheets.map((copy, i) => (
        <div className="pf-sheet" key={i}>
          <table className="pf-head">
            <tbody>
              <tr className="pf-ctrl">
                <td style={{ width: "34%" }}>Doc No. {code}</td>
                <td style={{ width: "28%" }}>Issue Status: {issue}</td>
                <td style={{ width: "38%" }}>Issue date {issueDate}</td>
              </tr>
              <tr>
                <td className="pf-orgcell" colSpan={3}>
                  <div className="pf-orginner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt={COMPANY.name} />
                    <div className="pf-org">
                      <div className="pf-orgname">{COMPANY.name}</div>
                      <div>Address: {COMPANY.address}</div>
                      <div>NTN: {COMPANY.ntn} &nbsp;&nbsp; STRN: {COMPANY.strn}</div>
                      <div>EMAIL: {COMPANY.email} &nbsp;&nbsp; Phone: {COMPANY.phone}</div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="pf-title">{title}</div>

          {children}

          {copy && <div className="pf-copy">{copy}</div>}
        </div>
      ))}

      <style jsx global>{`
        /* Column layout so the signature block can be pushed to the page foot. */
        .pf-sheet {
          background: #fff; color: #000; max-width: 850px; margin: 0 auto;
          padding: 24px 28px; font-size: 13px;
          font-family: "Times New Roman", Times, serif;
          display: flex; flex-direction: column; min-height: 1040px;
        }
        /* On screen, separate the stacked copies so they read as pages. */
        .pf-sheet + .pf-sheet { margin-top: 26px; border-top: 2px dashed #d8d0c2; }
        /* Copy name, centred at the very foot of each page. */
        .pf-copy {
          margin-top: 14px; text-align: center;
          font-weight: 700; font-size: 12.5px; letter-spacing: 0.6px;
          text-transform: uppercase;
        }
        /* --- shared document header --- */
        .pf-head { width: 100%; border-collapse: collapse; }
        .pf-head td { border: 1px solid #000; padding: 5px 8px; }
        .pf-ctrl td { font-size: 12px; }
        /* the flex lives on an inner div — flex on a <td> breaks colSpan */
        .pf-orgcell { padding: 10px 12px !important; }
        .pf-orginner { display: flex; align-items: center; gap: 18px; }
        .pf-orginner img { width: 130px; height: auto; object-fit: contain; flex-shrink: 0; }
        .pf-org { font-size: 11.5px; line-height: 1.55; }
        .pf-orgname { font-weight: 700; font-size: 13px; margin-bottom: 1px; }
        .pf-title {
          text-align: center; font-weight: 700; font-size: 17px;
          margin: 16px 0 14px; text-decoration: underline;
        }

        /* --- body helpers --- */
        .pf-metarow { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; margin-bottom: 12px; }
        .pf-fieldtable { border-collapse: collapse; width: auto; font-size: 13px; }
        .pf-fieldtable td { padding: 3px 8px; white-space: nowrap; }
        .pf-fieldtable td:first-child { font-weight: 700; }
        .pf-fieldtable td.u { border-bottom: 1px solid #000; min-width: 130px; }
        .pf-to { font-size: 13px; line-height: 1.9; }
        .pf-tohead { font-weight: 700; }
        .pf-toline b { font-weight: 700; }
        .pf-dear { margin: 10px 0 4px; }
        .pf-intro { margin-bottom: 10px; }
        .pf-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .pf-table th, .pf-table td { border: 1px solid #000; padding: 6px 8px; font-size: 12.5px; vertical-align: top; }
        .pf-table th {
          background: #f2f2f2; font-weight: 700; text-align: left;
          text-transform: none; letter-spacing: normal; color: #000;
        }
        .pf-table td.c { text-align: center; }
        .pf-closing { margin-top: 12px; }
        .pf-terms { margin-top: 16px; }
        .pf-termshead { font-weight: 700; text-decoration: underline; margin-bottom: 6px; }
        .pf-terms ol { margin: 0; padding-left: 22px; }
        .pf-terms li { font-size: 12.5px; line-height: 1.6; margin-bottom: 2px; }
        .pf-termsbox { min-height: 90px; border: 1px solid #000; }
        /* margin-top:auto drops the sign-off to the foot of the sheet */
        .pf-sign { display: flex; justify-content: space-between; gap: 40px; margin-top: auto; padding-top: 42px; flex-wrap: wrap; }
        /* Each block is a column whose label grows, so the signature rules line
           up even when one label wraps to two lines. */
        /* Equal-width blocks so the signature rules match in length and line up.
           The cap stops a lone signature (e.g. the PO) stretching page-wide. */
        .pf-sign > div { flex: 1 1 0; min-width: 200px; max-width: 300px; display: flex; flex-direction: column; }
        .pf-sign .lbl { font-weight: 700; font-size: 13px; flex: 1; min-height: 46px; }
        /* min-height keeps an empty signature the same height as a filled one,
           so both rules sit at the same level. */
        .pf-sign .line {
          border-top: 1px solid #000; padding-top: 3px; font-size: 12px;
          text-align: center; box-sizing: border-box; height: 22px;
        }
        /* Role caption under a signature rule, e.g. DIRECTOR/CEO. Render this
           slot in every block of a row (empty is fine) — the fixed height keeps
           the rules level whether or not a block is captioned. */
        .pf-sign .cap {
          text-align: center; font-size: 11.5px; font-weight: 700;
          letter-spacing: 0.4px; margin-top: 2px;
          height: 18px; line-height: 18px;
        }
        .pf-remark { margin-top: 12px; font-size: 12.5px; }

        @media print {
          /* Zero page margin leaves the browser no room to draw its own
             date / title / URL / page-number strips. */
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff; margin: 0 !important; padding: 0 !important; width: 100%; }
          .no-print, header, nav { display: none !important; }
          /* The app shell (max-width 1400px + padding) would make the printed
             document wider than A4, which makes Chrome shrink the whole page.
             Collapse it so the sheet maps 1:1 onto the paper. */
          main { max-width: none !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .fade-up { margin: 0 !important; padding: 0 !important; }
          .pf-sheet {
            max-width: none !important; width: 100% !important;
            box-sizing: border-box; margin: 0 !important;
            padding: 12mm 11mm; min-height: calc(297mm - 24mm);
          }
          /* Every copy starts its own sheet of paper. */
          .pf-sheet + .pf-sheet {
            break-before: page; page-break-before: always;
            border-top: none !important; margin-top: 0 !important;
          }
          .pf-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* globals.css has a print block for the attendance register that
             shrinks body text to 8.5pt and forces every table to 100% width.
             That squashed these forms and broke the side-by-side field blocks,
             so restore this sheet's own typography and table sizing. */
          .pf-sheet { font-size: 13px !important; }
          .pf-sheet table { font-size: inherit !important; width: auto !important; }
          .pf-sheet .pf-head,
          .pf-sheet .pf-table,
          .pf-sheet .pf-termsbox { width: 100% !important; }
          .pf-sheet .pf-head td { padding: 5px 8px !important; }
          .pf-sheet .pf-fieldtable td { padding: 3px 8px !important; }
          .pf-sheet .pf-table th,
          .pf-sheet .pf-table td { padding: 6px 8px !important; font-size: 13px !important; }
          .pf-sheet .pf-band { font-size: 17px !important; }
          .pf-sheet .pf-formtitle { font-size: 19px !important; }
        }
      `}</style>
    </div>
  );
}
