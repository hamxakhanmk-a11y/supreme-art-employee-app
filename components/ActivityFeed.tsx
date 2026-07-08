import Link from "next/link";

export type ActivityRow = {
  id: number;
  userName: string;
  action: string;
  employeeId: number | null;
  summary: string;
  createdAt: Date | string;
};

// Color per action family (prefix before the dot).
const FAMILY: Record<string, { label: string; color: string; bg: string }> = {
  attendance: { label: "Attendance", color: "#15803D", bg: "#dcf5dc" },
  leave:      { label: "Leave",      color: "#D97706", bg: "#fdebd0" },
  salary:     { label: "Salary",     color: "#0C447C", bg: "#E6F1FB" },
  employee:   { label: "Employee",   color: "#A32D2D", bg: "#fdecec" },
  kpi:        { label: "KPI",        color: "#9333EA", bg: "#f3e8ff" },
};

function familyOf(action: string) {
  return FAMILY[action.split(".")[0]] ?? { label: action, color: "#6b6960", bg: "#f1f1ef" };
}

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function dayKey(d: Date | string) {
  return new Date(d).toDateString();
}
function fmtDay(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

// Vertical audit-trail feed grouped by day. Server-renderable (no hooks).
export default function ActivityFeed({ rows, linkEmployees = false }: { rows: ActivityRow[]; linkEmployees?: boolean }) {
  if (rows.length === 0) {
    return <div className="empty" style={{ padding: "2rem" }}>No activity recorded yet. Actions like marking attendance, approving leave and generating salary slips will appear here.</div>;
  }

  const groups: { day: string; items: ActivityRow[] }[] = [];
  for (const r of rows) {
    const key = dayKey(r.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === key) last.items.push(r);
    else groups.push({ day: key, items: [r] });
  }

  return (
    <div>
      {groups.map(g => (
        <div key={g.day} style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase",
            letterSpacing: 0.5, padding: "6px 0", borderBottom: "2px solid var(--border)", marginBottom: 4,
          }}>
            {fmtDay(g.items[0].createdAt)}
          </div>
          {g.items.map(r => {
            const fam = familyOf(r.action);
            return (
              <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 4px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, minWidth: 40, paddingTop: 2 }}>{fmtTime(r.createdAt)}</span>
                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase",
                  color: fam.color, background: fam.bg, borderRadius: 999, padding: "3px 8px",
                  whiteSpace: "nowrap", marginTop: 1,
                }}>{fam.label}</span>
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>
                  {linkEmployees && r.employeeId ? (
                    <Link href={`/employees/${r.employeeId}`} style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "none" }}>
                      {r.summary.split(" — ")[0]}
                    </Link>
                  ) : (
                    <strong>{r.summary.split(" — ")[0]}</strong>
                  )}
                  {r.summary.includes(" — ") && <> — {r.summary.split(" — ").slice(1).join(" — ")}</>}
                  <span style={{ color: "var(--text3)", fontSize: 11.5 }}> · by {r.userName}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
