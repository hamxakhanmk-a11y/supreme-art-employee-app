"use client";
import { usePathname, useRouter } from "next/navigation";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// The From–To dates of the Super Admin dashboard, kept in the address so a reload or a shared link shows the same period.
export default function RangePicker({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (f: string, t: string) => {
    if (!f || !t) return;
    const [a, b] = f <= t ? [f, t] : [t, f];
    router.push(`${pathname}?from=${a}&to=${b}`);
  };
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const quick: [string, string, string][] = [
    ["Today", today, today],
    ["This month", iso(y, m, 1), today],
    ["Last month", iso(py, pm, 1), iso(py, pm, lastDay(py, pm))],
    ["This year", iso(y, 1, 1), today],
  ];
  return (
    <div className="od-range no-print">
      <div className="od-range-dates">
        <input type="date" value={from} max={to} onChange={e => go(e.target.value, to)} aria-label="From date" />
        <span>→</span>
        <input type="date" value={to} min={from} onChange={e => go(from, e.target.value)} aria-label="To date" />
      </div>
      <div className="od-range-quick">
        {quick.map(([label, f, t]) => (
          <button key={label} type="button" onClick={() => go(f, t)}
            className={`od-chip ${from === f && to === t ? "on" : ""}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}
