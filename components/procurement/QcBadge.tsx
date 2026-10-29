import type { InspectionResult } from "@/lib/procurement";

// A GRR's incoming-material inspection result at a glance: green passed,
// yellow partly accepted, red rejected, grey while nobody has inspected it.
// Shown on the GRR register and the procurement master report.
export const QC_STATUS = {
  accepted: { text: "Passed", color: "#166534", bg: "#dcfce7" },
  partial:  { text: "Partial", color: "#92400E", bg: "#fef3c7" },
  rejected: { text: "Rejected", color: "#991B1B", bg: "#fee2e2" },
} as const;

export const qcText = (result: InspectionResult) => (result ? QC_STATUS[result].text : "Not inspected");

export default function QcBadge({ result }: { result: InspectionResult }) {
  const b = result ? QC_STATUS[result] : null;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap",
      background: b ? b.bg : "var(--bg2)", color: b ? b.color : "var(--text3)" }}>
      {qcText(result)}
    </span>
  );
}
