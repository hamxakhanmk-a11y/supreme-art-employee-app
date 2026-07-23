"use client";

// Hosts the ported parts-store.html (public/store/index.html) inside an iframe.
// Uses same-origin so the iframe's fetch() calls to /api/store/* carry the
// session cookie automatically.
export default function StoreFrame() {
  return (
    <div style={{
      position: "fixed",
      // Sit just below the topbar + sub-nav row (~96px total).
      top: 96, left: 0, right: 0, bottom: 0,
      background: "#f5f5f3",
    }}>
      <iframe
        src="/store/index.html"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        title="Parts Store"
      />
    </div>
  );
}
