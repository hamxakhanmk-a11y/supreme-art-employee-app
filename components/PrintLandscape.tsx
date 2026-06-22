"use client";
import { useEffect } from "react";

// Call this from a "Print" button click handler to force the current
// document into A4 landscape just for this one print invocation.
export function printLandscape() {
  const s = document.createElement("style");
  s.setAttribute("data-tmp-print-landscape", "1");
  s.textContent = "@media print { @page { size: A4 landscape; margin: 8mm; } }";
  document.head.appendChild(s);
  window.addEventListener("afterprint", () => s.remove(), { once: true });
  setTimeout(() => window.print(), 30);
}

// Switches the document to A4 landscape for printing while this component is
// mounted. We do this by directly inserting a CSSStyleSheet rule rather than
// appending a <style> tag — some Chrome builds don't honour @page from
// dynamically-added stylesheets, but they do honour CSSOM-inserted rules.
export default function PrintLandscape({ margin = "8mm" }: { margin?: string }) {
  useEffect(() => {
    let sheet: CSSStyleSheet | null = null;
    let ruleIdx: number | null = null;
    try {
      const styleEl = document.createElement("style");
      styleEl.setAttribute("data-print-landscape", "1");
      document.head.appendChild(styleEl);
      sheet = styleEl.sheet as CSSStyleSheet | null;
      if (sheet) {
        const rule = `@media print { @page { size: A4 landscape; margin: ${margin}; } }`;
        ruleIdx = sheet.insertRule(rule, sheet.cssRules.length);
      }
      return () => {
        try {
          if (sheet && ruleIdx !== null) sheet.deleteRule(ruleIdx);
          styleEl.remove();
        } catch {}
      };
    } catch { return; }
  }, [margin]);
  return null;
}
