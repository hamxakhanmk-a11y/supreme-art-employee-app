import { db } from "@/lib/db";
import { activityLog } from "@/lib/schema";
import { and, desc, ilike, or } from "drizzle-orm";
import ActivityFeed from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

type SP = { q?: string; type?: string };

const TYPES = [
  { value: "", label: "All activity" },
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave" },
  { value: "salary", label: "Salary" },
  { value: "employee", label: "Employee" },
  { value: "kpi", label: "KPI" },
  { value: "store", label: "Store — all" },
  { value: "store.machinery", label: "Store — Machinery" },
  { value: "store.consumables", label: "Store — Inks & Consumables" },
];

export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const type = (sp.type || "").trim();

  const conds = [];
  if (type) conds.push(ilike(activityLog.action, `${type}.%`));
  if (q) conds.push(or(ilike(activityLog.summary, `%${q}%`), ilike(activityLog.userName, `%${q}%`)));

  const rows = await db.select().from(activityLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(300);

  return (
    <div className="fade-up">
      {/* One row: the entry count, then the filters. Plain GET form, no client JS needed. The log is always newest first
          (and capped at the last 300), so there is no sort control. */}
      <form method="GET" className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", flexShrink: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 10px", borderRadius: 8, background: "#fafaf6", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{rows.length}</span>
            <span style={{ fontSize: 10.5, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Entries</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <input name="q" defaultValue={q} placeholder="🔍  Search summary or user…" style={{ width: 260 }} />
          <select name="type" defaultValue={type} style={{ width: 170 }}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button type="submit" className="btn btn-primary btn-sm">Filter</button>
          {(q || type) && <a href="/reports/activity" className="btn btn-sm">Clear</a>}
        </div>
      </form>

      <div className="card">
        <ActivityFeed rows={rows} linkEmployees />
      </div>
    </div>
  );
}
