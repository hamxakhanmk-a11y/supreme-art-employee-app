"use client";

// The switch between the views inside one Station sub-tab (PSO Cards: Cards
// Logbook | All cards; Vehicles: Log Book | All vehicles). A pill with the
// chosen view filled in the brand red, the same as the Tracker's switches, so
// it reads as a control rather than as a heading.
export type PageTab<K extends string> = { key: K; label: string; count?: string | number };

export default function PageTabs<K extends string>({ tabs, value, onChange }: {
  tabs: PageTab<K>[]; value: K; onChange: (k: K) => void;
}) {
  return (
    <div className="page-tabs no-print" role="tablist">
      {tabs.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key}
          className={value === t.key ? "on" : ""} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined && t.count !== "" && t.count !== 0 && <span className="page-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
