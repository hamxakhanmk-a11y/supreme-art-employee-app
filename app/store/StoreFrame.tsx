"use client";

import { useEffect, useRef } from "react";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { reportLetterhead } from "@/lib/report-export";

// Hosts the ported parts-store.html (public/store/index.html) inside an iframe.
// The module ('machinery' | 'consumables') is chosen by the /store/* route and
// passed to the iframe via a query param so its JS knows which set to load.
export default function StoreFrame({ module }: { module: "machinery" | "consumables" }) {
  const src = `/store/index.html?module=${module}`;
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.type !== "store-excel-export") return;
      const { section, title, headers, rows, from, to, filename } = message;
      const code = section === "issuance" ? (module === "consumables" ? "STR/QR/008/B" : "STR/QR/008/A") : undefined;
      try {
        await downloadWorkbookXlsx({ filename, sheets: [{
          sheetName: String(title).slice(0, 31), title, headers, rows, freezeCols: 1,
          letterhead: { ...reportLetterhead(from || "", to || ""), code },
        }] });
        frameRef.current?.contentWindow?.postMessage({ type: "store-excel-result", ok: true }, event.origin);
      } catch (error) {
        frameRef.current?.contentWindow?.postMessage({ type: "store-excel-result", ok: false, error: error instanceof Error ? error.message : "Export failed. Please retry." }, event.origin);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [module]);
  return (
    <div style={{
      position: "fixed",
      // Sit just below the 56px topbar. There's no employee-app sub-nav
      // row here — the store's iframe brings its own sidebar.
      top: 56, left: 0, right: 0, bottom: 0,
      background: "#f5f5f3",
    }}>
      <iframe
        ref={frameRef}
        // key forces a full reload when the module changes so the store JS
        // re-picks the URL param on mount (rather than keeping the old state).
        key={module}
        src={src}
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        title="Parts Store"
      />
    </div>
  );
}
