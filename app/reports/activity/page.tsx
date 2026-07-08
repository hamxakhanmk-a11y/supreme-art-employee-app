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
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Activity Log</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Audit trail of every change: who did what, and when. Newest first (last {rows.length}).
          </p>
        </div>
      </div>

      {/* Filters — plain GET form, no client JS needed */}
      <form method="GET" className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <select name="type" defaultValue={type} style={{ width: 160 }}>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Search summary or user…" style={{ width: 260 }} />
        <button type="submit" className="btn btn-primary btn-sm">Filter</button>
        {(q || type) && <a href="/reports/activity" className="btn btn-sm">Clear</a>}
      </form>

      <div className="card">
        <ActivityFeed rows={rows} linkEmployees />
      </div>
    </div>
  );
}
