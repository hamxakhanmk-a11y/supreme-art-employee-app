"use client";
import Link from "next/link";
import { useState } from "react";
import { COMPANY } from "@/lib/procurement";

// Shared A4 print shell for the three procurement forms. Client component so
// styled-jsx is allowed (it breaks the build in a Server Component).
// The header reproduces the block used across the Word templates: a control
// strip (Doc No / Issue Status / Issue date) above the company details.
export default function ProcurementPrint({
  code, title, issue, issueDate, backHref, copies, pdfFilename, compact, children,
}: {
  code: string; title: string; issue: string; issueDate: string;
  backHref: string; copies?: string[];
  pdfFilename?: string;   // pre-fills the filename in the browser's Save-as-PDF dialog
  compact?: boolean;      // tighter typography so a long form (PO) fits one A4 page
  children: React.ReactNode;
}) {
  // One identical page per copy, each named at the foot. Falls back to a
  // single unnamed page if a form has no copy set.
  const sheets = copies?.length ? copies : [""];

  // Which copies to include on the next Print / Save-as-PDF. "" = all.
  const [selectedCopy, setSelectedCopy] = useState<string>("");
  // Stable per-instance id so the print-copy CSS scoping only affects this sheet.
  const [rootId] = useState(() => `pf-${Math.random().toString(36).slice(2, 9)}`);

  // Hide non-selected sheets during print by tagging them with `pf-hide`
  // (see the CSS block below). Restored on `afterprint` so the on-screen view
  // is untouched. Using JS avoids having to enumerate every copy name in CSS.
  function beforePrint(): () => void {
    if (!selectedCopy) return () => {};
    const root = document.getElementById(rootId);
    if (!root) return () => {};
    const hidden: Element[] = [];
    root.querySelectorAll<HTMLElement>(".pf-sheet").forEach((el) => {
      if (el.dataset.copy !== selectedCopy) { el.classList.add("pf-hide"); hidden.push(el); }
    });
    return () => hidden.forEach((el) => el.classList.remove("pf-hide"));
  }

  function doPrint() {
    const restore = beforePrint();
    const cleanup = () => { restore(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  // Chrome/Edge use document.title as the default filename in the Save-as-PDF
  // dialog. Swap it in around window.print() so users get a sensible file name.
  function savePdf() {
    const restoreDom = beforePrint();
    const prev = document.title;
    if (pdfFilename) {
      const base = pdfFilename.replace(/\.pdf$/i, "");
      document.title = selectedCopy ? `${base} - ${selectedCopy}` : base;
    }
    const cleanup = () => {
      document.title = prev; restoreDom();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  return (
    <div id={rootId}>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Link href={backHref} className="btn">← Back</Link>
        <button onClick={doPrint} className="btn btn-primary">🖨 Print</button>
        <button onClick={savePdf} className="btn" title="Opens the print dialog — choose &quot;Save as PDF&quot; as the destination">💾 Save as PDF</button>
        {sheets.length > 1 && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text2)" }}>
            Copy:
            <select value={selectedCopy} onChange={(e) => setSelectedCopy(e.target.value)} style={{ padding: "4px 6px" }}>
              <option value="">All copies ({sheets.length})</option>
              {sheets.map((c) => <option key={c} value={c}>{c || "(unnamed)"}</option>)}
            </select>
          </label>
        )}
      </div>

      {sheets.map((copy, i) => (
        <div className={`pf-sheet${compact ? " pf-sheet--compact" : ""}`} data-copy={copy} key={i}>
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
        /* Design tokens local to the printed forms. --pf-brand is Supreme Art's
           red (#A32D2D); the softs / darks are derived shades used only for
           accents so the sheet still prints legibly on a monochrome printer. */
        .pf-sheet {
          --pf-brand: #A32D2D;
          --pf-brand-dark: #7C1F1F;
          --pf-brand-soft: #FDECEC;
          --pf-rule: #C9C3BC;   /* warm neutral for table lines */
          --pf-ink: #1a1a1a;    /* body copy — near-black, softer than pure */
          --pf-zebra: #FAFAF7;  /* subtle alt-row tint */
          background: #fff; color: var(--pf-ink); max-width: 850px; margin: 0 auto;
          padding: 26px 30px 22px; font-size: 13px;
          font-family: "Times New Roman", Times, serif;
          display: flex; flex-direction: column; min-height: 1040px;
          /* Thin brand strip along the top of every sheet. */
          border-top: 3px solid var(--pf-brand);
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        /* On screen, separate the stacked copies so they read as pages. */
        .pf-sheet + .pf-sheet { margin-top: 26px; }

        /* Copy label at the foot — a small pill instead of plain uppercase text. */
        .pf-copy {
          margin: 16px auto 0; text-align: center;
          font-weight: 700; font-size: 11px; letter-spacing: 1.4px;
          text-transform: uppercase; color: var(--pf-brand-dark);
          padding: 3px 14px; border: 1px solid var(--pf-brand);
          border-radius: 999px; display: inline-block; align-self: center;
          background: var(--pf-brand-soft);
        }

        /* --- shared document header --- */
        .pf-head { width: 100%; border-collapse: collapse; }
        .pf-head td { border: 1px solid var(--pf-rule); padding: 5px 10px; }
        .pf-ctrl td {
          font-size: 11.5px; background: var(--pf-brand-soft);
          color: var(--pf-brand-dark); font-weight: 600; letter-spacing: 0.2px;
        }
        /* the flex lives on an inner div — flex on a <td> breaks colSpan */
        .pf-orgcell { padding: 12px 14px !important; }
        .pf-orginner { display: flex; align-items: center; gap: 20px; }
        .pf-orginner img { width: 118px; height: auto; object-fit: contain; flex-shrink: 0; }
        .pf-org { font-size: 11.5px; line-height: 1.6; color: #2a2a2a; }
        .pf-orgname {
          font-weight: 700; font-size: 16px; margin-bottom: 3px;
          color: var(--pf-brand-dark); text-transform: uppercase;
          letter-spacing: 1.2px; font-family: Georgia, "Times New Roman", serif;
        }

        /* Document title — no underline, brand-red hairline instead, refined
           typography. Reads as the document's headline rather than a form field. */
        .pf-title {
          text-align: center; font-weight: 700; font-size: 16px;
          margin: 18px auto 14px; text-decoration: none;
          text-transform: uppercase; letter-spacing: 3px;
          color: var(--pf-brand-dark);
          padding: 0 12px 8px; border-bottom: 1.5px solid var(--pf-brand);
          display: table; /* shrink-wrap so the rule matches the text width */
        }

        /* --- body helpers --- */
        .pf-metarow { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; margin-bottom: 14px; }
        .pf-fieldtable { border-collapse: collapse; width: auto; font-size: 13px; }
        .pf-fieldtable td { padding: 4px 8px; white-space: nowrap; }
        .pf-fieldtable td:first-child { font-weight: 700; color: #333; }
        /* Value cells get a brand-red underline instead of black — friendlier
           than a hard black rule while still clearly delineating the value. */
        .pf-fieldtable td.u {
          border-bottom: 1.5px solid var(--pf-brand); min-width: 130px;
          color: var(--pf-ink); font-weight: 600;
        }
        .pf-to { font-size: 13px; line-height: 1.95; }
        .pf-tohead {
          font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
          font-size: 11px; color: var(--pf-brand-dark); margin-bottom: 2px;
        }
        .pf-toline b { font-weight: 700; color: #333; }
        .pf-dear { margin: 12px 0 4px; font-style: italic; color: #333; }
        .pf-intro { margin-bottom: 12px; }

        /* Content tables — softer borders + brand-tinted header + subtle zebra. */
        .pf-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .pf-table th, .pf-table td {
          border: 1px solid var(--pf-rule); padding: 7px 9px;
          font-size: 12.5px; vertical-align: top;
        }
        .pf-table th {
          background: var(--pf-brand-soft); font-weight: 700; text-align: left;
          text-transform: uppercase; letter-spacing: 0.6px; color: var(--pf-brand-dark);
          font-size: 11.5px; border-bottom: 1.5px solid var(--pf-brand);
        }
        .pf-table tbody tr:nth-child(even) td { background: var(--pf-zebra); }
        .pf-table td.c { text-align: center; }

        .pf-closing { margin-top: 14px; font-style: italic; color: #444; }
        .pf-terms { margin-top: 16px; }
        /* Section header — brand accent bar on the left, no underline. */
        .pf-termshead {
          font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
          color: var(--pf-brand-dark); margin-bottom: 8px; font-size: 12px;
          border-left: 3px solid var(--pf-brand); padding-left: 8px;
        }
        .pf-terms ol { margin: 0; padding-left: 22px; }
        .pf-terms li { font-size: 12.5px; line-height: 1.6; margin-bottom: 2px; }
        /* Explicit-number variant — doesn't rely on browser list-style so the
           numbers survive globals.css and compact-print typography. */
        .pf-terms .pf-termslist { list-style: none; padding: 0; margin: 0; }
        .pf-terms .pf-termslist li { display: flex; align-items: flex-start; gap: 6px; }
        .pf-terms .pf-termnum { font-weight: 700; flex-shrink: 0; min-width: 18px; color: var(--pf-brand-dark); }
        .pf-terms .pf-termtext { flex: 1; }

        /* Compact variant — used by PO, which carries 11 standard T&C items.
           Tightens typography/spacing enough to keep the whole form on one
           A4 page. Screen picks up the same tightening so what-you-see matches
           what-you-print. */
        .pf-sheet--compact { font-size: 12px; }
        .pf-sheet--compact .pf-title { font-size: 15.5px; margin: 10px 0 8px; }
        .pf-sheet--compact .pf-dear { margin: 6px 0 2px; }
        .pf-sheet--compact .pf-intro { margin-bottom: 6px; font-size: 11.5px; }
        .pf-sheet--compact .pf-table th,
        .pf-sheet--compact .pf-table td { padding: 3px 6px; font-size: 11px; }
        .pf-sheet--compact .pf-closing { margin-top: 6px; font-size: 11.5px; }
        .pf-sheet--compact .pf-terms { margin-top: 8px; }
        .pf-sheet--compact .pf-terms li { font-size: 9.5px; line-height: 1.32; margin-bottom: 0; }
        .pf-sheet--compact .pf-terms .pf-termnum { min-width: 15px; }
        .pf-sheet--compact .pf-sign { padding-top: 18px; }
        .pf-sheet--compact .pf-sign .lbl { min-height: 32px; font-size: 12px; }
        .pf-termsbox { min-height: 90px; border: 1px solid var(--pf-rule); border-radius: 2px; }
        /* margin-top:auto drops the sign-off to the foot of the sheet */
        .pf-sign { display: flex; justify-content: space-between; gap: 40px; margin-top: auto; padding-top: 42px; flex-wrap: wrap; }
        .pf-sign > div { flex: 1 1 0; min-width: 200px; max-width: 300px; display: flex; flex-direction: column; }
        .pf-sign .lbl {
          font-weight: 700; font-size: 11.5px; flex: 1; min-height: 46px;
          text-transform: uppercase; letter-spacing: 1px;
          color: var(--pf-brand-dark);
        }
        /* Signature rule — a touch bolder so it reads as a line to sign on. */
        .pf-sign .line {
          border-top: 1.5px solid var(--pf-ink); padding-top: 4px; font-size: 12px;
          text-align: center; box-sizing: border-box; height: 22px;
          font-family: Georgia, "Times New Roman", serif; font-style: italic;
        }
        .pf-sign .cap {
          text-align: center; font-size: 10px; font-weight: 700;
          letter-spacing: 1.4px; margin-top: 3px;
          height: 18px; line-height: 18px;
          text-transform: uppercase; color: #555;
        }
        .pf-remark { margin-top: 12px; font-size: 12.5px; color: #333; }

        /* Sheets tagged with pf-hide by the copy picker are removed both on
           screen (so the user sees exactly what will print) and in print. */
        .pf-sheet.pf-hide { display: none !important; }

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
          /* Every copy starts its own sheet of paper — but keep the top brand
             strip on every one of them (border-top on .pf-sheet is intentional). */
          .pf-sheet + .pf-sheet {
            break-before: page; page-break-before: always;
            margin-top: 0 !important;
          }
          /* Force every tinted element to print in colour — Chrome strips
             backgrounds by default, which would knock the accents off. */
          .pf-sheet,
          .pf-sheet .pf-ctrl td,
          .pf-sheet .pf-table th,
          .pf-sheet .pf-table tbody tr:nth-child(even) td,
          .pf-sheet .pf-copy {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* globals.css has a print block for the attendance register that
             shrinks body text to 8.5pt and forces every table to 100% width.
             That squashed these forms and broke the side-by-side field blocks,
             so restore this sheet's own typography and table sizing. */
          .pf-sheet { font-size: 13px !important; }
          .pf-sheet table { font-size: inherit !important; width: auto !important; }
          .pf-sheet .pf-head,
          .pf-sheet .pf-table,
          .pf-sheet .pf-termsbox { width: 100% !important; }
          .pf-sheet .pf-head td { padding: 5px 10px !important; }
          .pf-sheet .pf-fieldtable td { padding: 4px 8px !important; }
          .pf-sheet .pf-table th,
          .pf-sheet .pf-table td { padding: 7px 9px !important; font-size: 13px !important; }
          .pf-sheet .pf-band { font-size: 17px !important; }
          .pf-sheet .pf-formtitle { font-size: 19px !important; }

          /* Compact-variant print overrides — must repeat inside @media print
             because globals.css also sets !important font-size in print. */
          .pf-sheet--compact { font-size: 11px !important; padding: 8mm 10mm !important; }
          .pf-sheet--compact .pf-title { font-size: 14px !important; margin: 6px 0 6px !important; }
          .pf-sheet--compact .pf-head td { padding: 3px 6px !important; font-size: 10.5px !important; }
          .pf-sheet--compact .pf-orgname { font-size: 12px !important; }
          .pf-sheet--compact .pf-org { font-size: 10.5px !important; line-height: 1.3 !important; }
          .pf-sheet--compact .pf-orginner img { width: 90px !important; }
          .pf-sheet--compact .pf-table th,
          .pf-sheet--compact .pf-table td { padding: 3px 5px !important; font-size: 10px !important; }
          .pf-sheet--compact .pf-fieldtable td { padding: 2px 6px !important; font-size: 11px !important; }
          .pf-sheet--compact .pf-terms { margin-top: 6px !important; }
          .pf-sheet--compact .pf-termshead { font-size: 11px !important; margin-bottom: 3px !important; }
          .pf-sheet--compact .pf-terms li { font-size: 8.5px !important; line-height: 1.28 !important; margin-bottom: 0 !important; }
          .pf-sheet--compact .pf-sign { padding-top: 10px !important; }
          .pf-sheet--compact .pf-sign .lbl { min-height: 26px !important; font-size: 11px !important; }
          .pf-sheet--compact .pf-sign .line { height: 18px !important; font-size: 10.5px !important; }
          .pf-sheet--compact .pf-copy { font-size: 10px !important; margin-top: 6px !important; }
          /* Force the whole sheet onto a single page. */
          .pf-sheet--compact { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
