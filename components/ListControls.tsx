"use client";

// The "Sort: …" dropdown and the search box the attendance and leave screens share, so every list looks and
// behaves like the Attendance Register's: pick how the rows are ordered, type to narrow them.

export type SortOption<K extends string> = { value: K; label: string };

// See-through white with a faint brand-red edge, so the search box and the sort dropdown sit lightly on the page
// instead of as solid white slabs. backgroundColor (not the shorthand) keeps a select's own arrow.
const GLASS: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 255, 0.45)",
  border: "1px solid rgba(163, 45, 45, 0.28)",
  backdropFilter: "blur(3px)",
};

export function SortBy<K extends string>({ options, value, onChange, minWidth = 150, glass = true }: {
  options: readonly SortOption<K>[]; value: K; onChange: (v: K) => void; minWidth?: number; glass?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as K)} title="Sort by" className="no-print"
      style={{ width: "auto", minWidth, ...(glass ? GLASS : null) }}>
      {options.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
    </select>
  );
}

/** A search box with a clear button. `block` makes it fill its row (a bar of its own); otherwise it is compact for a toolbar. */
export function SearchBox({ value, onChange, placeholder = "🔍  Search…", block = false, width = 230 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; block?: boolean; width?: number;
}) {
  return (
    <span className="no-print" style={{ position: "relative", display: "inline-block", flex: block ? 1 : undefined, width: block ? undefined : width }}>
      <input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: block ? "11px 34px 11px 16px" : "8px 30px 8px 12px", fontSize: 13, ...GLASS }} />
      {value && (
        <button type="button" onClick={() => onChange("")} title="Clear search" style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: 4,
        }}>✕</button>
      )}
    </span>
  );
}
