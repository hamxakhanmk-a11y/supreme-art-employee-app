// Branded header that shows on printed pages only.
// Hidden on screen via .print-only (see globals.css).
export default function PrintHeader({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: string }) {
  return (
    <div className="print-only print-header">
      <div className="print-header-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Supreme Art" />
        <div style={{ textAlign: "right" }}>
          <div className="print-header-title">{title}</div>
          {subtitle && <div className="print-header-sub">{subtitle}</div>}
          {meta && <div className="print-header-meta">{meta}</div>}
          <div className="print-header-meta">
            Printed: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>
    </div>
  );
}
