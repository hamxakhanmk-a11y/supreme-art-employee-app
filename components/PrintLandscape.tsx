"use client";
import { useEffect } from "react";

// Injects an `@page { size: A4 landscape }` rule into the document while mounted.
// Reports with wide tables wrap themselves in this so Ctrl+P / print buttons
// produce a landscape page that fits the table without right-edge cropping.
// CSS `@page` cannot be scoped via selectors in standard CSS, so we toggle a
// stylesheet at the document level instead.
export default function PrintLandscape({ margin = "8mm" }: { margin?: string }) {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-print-landscape", "1");
    style.textContent = `@media print { @page { size: A4 landscape; margin: ${margin}; } }`;
    document.head.appendChild(style);
    return () => {
      try { document.head.removeChild(style); } catch {}
    };
  }, [margin]);
  return null;
}
