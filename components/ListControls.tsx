"use client";

// The "Sort: …" dropdown and the search box the attendance and leave screens share, so every list looks and
// behaves like the Attendance Register's: pick how the rows are ordered, type to narrow them.

export type SortOption<K extends string> = { value: K; label: string };

// Solid yellow-orange with dark text, so the search box and the sort dropdown stand out on the page. A select gets its
// own dark arrow (the native one is easy to lose on a coloured box); the placeholder and option colours are in globals.css.
const ACCENT: React.CSSProperties = {
  backgroundColor: "rgba(245, 158, 11, 0.5)",   // 50% opacity: the colour is half see-through, the text stays solid
  color: "#1f1300",
  border: "1px solid #B45309",
  boxShadow: "0 2px 6px rgba(245, 158, 11, 0.40)",
};
const ARROW = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%231f1300' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>\")";
const SELECT_ACCENT: React.CSSProperties = {
  ...ACCENT, appearance: "none", WebkitAppearance: "none", fontWeight: 600,
  backgroundImage: ARROW, backgroundRepeat: "no-repeat", backgroundPosition: "right 11px center", backgroundSize: "12px 8px",
  paddingRight: 32, cursor: "pointer",
};

export function SortBy<K extends string>({ options, value, onChange, minWidth = 150, accent = true }: {
  options: readonly SortOption<K>[]; value: K; onChange: (v: K) => void; minWidth?: number; accent?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as K)} title="Sort by" className="no-print lc-sort"
      style={{ width: "auto", minWidth, ...(accent ? SELECT_ACCENT : null) }}>
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
      <input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="lc-search"
        style={{ width: "100%", padding: block ? "11px 34px 11px 16px" : "8px 30px 8px 12px", fontSize: 13, fontWeight: 600, ...ACCENT }} />
      {value && (
        <button type="button" onClick={() => onChange("")} title="Clear search" style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          background: "transparent", border: "none", color: "#1f1300", cursor: "pointer", fontSize: 14, padding: 4,
        }}>✕</button>
      )}
    </span>
  );
}
