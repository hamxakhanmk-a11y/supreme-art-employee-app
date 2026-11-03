"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { rangeLabel } from "./format";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// The period of the Super Admin dashboard, as on the Tracker's CEO dashboard: one dropdown of periods, the date
// boxes only for Custom, a reload button and the range in words. Kept in the address, so a reload keeps it.
export default function RangePicker({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const presets: [string, string, string, string][] = [
    ["today", "Today", today, today],
    ["this-month", "This month", iso(y, m, 1), today],
    ["last-month", "Last month", iso(py, pm, 1), iso(py, pm, lastDay(py, pm))],
    ["this-year", "This year", iso(y, 1, 1), today],
  ];
  const matched = presets.find(p => p[2] === from && p[3] === to)?.[0] ?? "custom";
  const [customOpen, setCustomOpen] = useState(false);
  const value = customOpen ? "custom" : matched;
  const go = (f: string, t: string) => {
    if (!f || !t) return;
    const [a, b] = f <= t ? [f, t] : [t, f];
    router.push(`${pathname}?from=${a}&to=${b}`);
  };
  return (
    <div className="od-bar no-print">
      <select value={value} aria-label="Period" onChange={e => {
        const p = presets.find(x => x[0] === e.target.value);
        if (p) { setCustomOpen(false); go(p[2], p[3]); } else setCustomOpen(true);
      }}>
        {presets.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
        <option value="custom">Custom…</option>
      </select>
      {value === "custom" && (
        <>
          <input type="date" value={from} max={to} onChange={e => go(e.target.value, to)} aria-label="From date" />
          <span className="od-bar-to">to</span>
          <input type="date" value={to} min={from} onChange={e => go(from, e.target.value)} aria-label="To date" />
        </>
      )}
      <button type="button" className="btn btn-sm" onClick={() => router.refresh()} title="Load the latest figures">↻</button>
      <span className="od-bar-label">{rangeLabel(from, to)}</span>
    </div>
  );
}
