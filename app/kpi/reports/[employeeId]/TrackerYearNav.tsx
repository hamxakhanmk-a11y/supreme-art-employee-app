"use client";
import { useRouter, usePathname } from "next/navigation";

export default function TrackerYearNav({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select value={year} onChange={e => router.push(`${pathname}?year=${e.target.value}`)} style={{ width: 100 }}>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}
