"use client";
import Link from "next/link";

// Shared A4 print shell for the three procurement forms. Client component so
// styled-jsx is allowed (it breaks the build in a Server Component).
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
        <div className="pf-head">
          <div className="pf-org">SUPREME ART</div>
          <div className="pf-sys">QUALITY &amp; ENVIRONMENTAL SYSTEM</div>
          <div className="pf-title">{title}</div>
        </div>

        {children}

        <div className="pf-foot">
          <span>{code}</span>
          <span>Issue Status: {issue}</span>
          <span>Issue date {issueDate}</span>
        </div>
      </div>

      <style jsx global>{`
        .pf-sheet {
          background: #fff; color: #000; max-width: 820px; margin: 0 auto;
          border: 1px solid #ccc; padding: 26px 30px; font-size: 13px;
        }
        .pf-head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
        .pf-org { font-size: 20px; font-weight: 800; letter-spacing: 2px; }
        .pf-sys { font-size: 10px; letter-spacing: 1px; color: #333; margin-top: 2px; }
        .pf-title { font-size: 15px; font-weight: 800; margin-top: 6px; text-transform: uppercase; }
        .pf-meta { display: flex; flex-wrap: wrap; gap: 6px 26px; margin: 6px 0 14px; font-size: 13px; }
        .pf-meta b { font-weight: 700; }
        .pf-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .pf-table th, .pf-table td { border: 1px solid #000; padding: 6px 8px; font-size: 12px; vertical-align: top; }
        .pf-table th { background: #f0eadf; font-weight: 700; text-align: left; }
        .pf-table td.c { text-align: center; }
        .pf-sign { display: flex; justify-content: space-between; gap: 30px; margin-top: 30px; flex-wrap: wrap; }
        .pf-sign > div { flex: 1; min-width: 180px; text-align: center; }
        .pf-sign .line { border-top: 1px solid #000; margin-top: 34px; padding-top: 4px; font-size: 12px; }
        .pf-remark { margin-top: 14px; font-size: 12px; }
        .pf-foot { display: flex; justify-content: space-between; gap: 12px; margin-top: 22px; padding-top: 8px; border-top: 1px solid #000; font-size: 11px; color: #333; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: #fff; }
          .no-print, header, nav { display: none !important; }
          .pf-sheet { border: none; max-width: 100%; padding: 0; }
        }
      `}</style>
    </div>
  );
}
