"use client";

// Hosts the ported parts-store.html (public/store/index.html) inside an iframe.
// The module ('machinery' | 'consumables') is chosen by the /store/* route and
// passed to the iframe via a query param so its JS knows which set to load.
export default function StoreFrame({ module }: { module: "machinery" | "consumables" }) {
  const src = `/store/index.html?module=${module}`;
  return (
    <div style={{
      position: "fixed",
      // Sit just below the topbar + sub-nav row (~96px total).
      top: 96, left: 0, right: 0, bottom: 0,
      background: "#f5f5f3",
    }}>
      <iframe
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
