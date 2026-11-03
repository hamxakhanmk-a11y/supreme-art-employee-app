"use client";

// The "Sort: …" dropdown and the search box the attendance and leave screens share, so every list looks and
// behaves like the Attendance Register's: pick how the rows are ordered, type to narrow them.

export type SortOption<K extends string> = { value: K; label: string };

export function SortBy<K extends string>({ options, value, onChange, minWidth = 150 }: {
  options: readonly SortOption<K>[]; value: K; onChange: (v: K) => void; minWidth?: number;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as K)} title="Sort by" className="no-print"
      style={{ width: "auto", minWidth }}>
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
        style={{ width: "100%", padding: block ? "11px 34px 11px 16px" : "8px 30px 8px 12px", fontSize: 13 }} />
      {value && (
        <button type="button" onClick={() => onChange("")} title="Clear search" style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: 4,
        }}>✕</button>
      )}
    </span>
  );
}
