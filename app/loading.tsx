export default function Loading() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", flexDirection: "column", gap: 14,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid var(--border)",
        borderTopColor: "var(--brand)",
        animation: "spin 0.7s linear infinite",
      }} />
      <div style={{ fontSize: 12, color: "var(--text2)", letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 600 }}>
        Loading…
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
