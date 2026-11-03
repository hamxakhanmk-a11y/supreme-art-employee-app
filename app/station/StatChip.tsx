// The thin inline count/total pill the list screens start their controls row with
// (the same look as the Stat chips on Leave History and Purchase).
export default function StatChip({ label, value, color = "#1a1a1a", bg = "#fafaf6" }: {
  label: string; value: string | number; color?: string; bg?: string;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 9px", borderRadius: 8, background: bg, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10.5, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}
