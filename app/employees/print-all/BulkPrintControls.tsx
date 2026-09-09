"use client";

export default function BulkPrintControls({ count }: { count: number }) {
  return (
    <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
      <a href="/employees" style={{ fontSize: 12, color: "var(--primary)" }}>← Back to Employees</a>
      <button className="btn btn-print" onClick={() => window.print()}>
        🖨 Print All ({count} employee{count === 1 ? "" : "s"})
      </button>
    </div>
  );
}
