"use client";
import { useEffect } from "react";
import SalarySlipView from "../[id]/SalarySlipView";

export default function BulkPrintClient({ slips }: { slips: any[] }) {
  useEffect(() => {
    // Open the print dialog automatically once everything paints.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => history.back()} style={{ fontSize: 13, color: "var(--brand)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>← Back</button>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>{slips.length} salary slip{slips.length === 1 ? "" : "s"} — printing…</div>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print Again</button>
      </div>
      <div className="bulk-slip-stack">
        {slips.map((s, i) => (
          <div key={s.id} className="bulk-slip-item" style={{ pageBreakAfter: i < slips.length - 1 ? "always" : "auto", breakAfter: i < slips.length - 1 ? "page" : "auto" }}>
            <SalarySlipView slip={s} embedded />
          </div>
        ))}
      </div>
      <style>{`
        @media print {
          .bulk-slip-item { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
