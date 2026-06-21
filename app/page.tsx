import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
// no drizzle ops needed at top level — we run a single select

export const dynamic = "force-dynamic";

type Emp = typeof employees.$inferSelect;
type Alert = {
  empId: number;
  empCode: string;
  name: string;
  designation: string | null;
  docType: "CNIC" | "Passport" | "Contract" | "EOBI" | "ESSI";
  date: string; // ISO date
  daysLeft: number; // negative = expired
};

const DOC_ACCENT: Record<Alert["docType"], string> = {
  CNIC: "#A32D2D",
  Passport: "#185FA5",
  Contract: "#7C1F1F",
  EOBI: "#0F766E",
  ESSI: "#854F0B",
};

function daysBetween(future: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(future);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function buildAlerts(rows: Emp[]): Alert[] {
  const out: Alert[] = [];
  for (const e of rows) {
    if (e.status !== "active") continue;
    const name = `${e.firstName} ${e.lastName}`.trim();
    const base = { empId: e.id, empCode: e.employeeId, name, designation: e.designation };
    const push = (docType: Alert["docType"], date: string | null | undefined) => {
      if (!date) return;
      const days = daysBetween(date);
      if (days > 90) return; // only show ≤ 90 days or already expired
      out.push({ ...base, docType, date, daysLeft: days });
    };
    push("CNIC", e.cnicExpiry as any);
    push("Passport", e.passportExpiry as any);
    push("Contract", e.contractExpiry as any);
    push("EOBI", e.ssiExpiry as any);
    push("ESSI", e.ubiExpiry as any);
  }
  // Most urgent first (expired, then nearest)
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function severity(daysLeft: number): { label: string; color: string; bg: string; border: string } {
  if (daysLeft < 0) return { label: `Expired ${Math.abs(daysLeft)}d ago`, color: "#A32D2D", bg: "#fcebeb", border: "#f3c2c2" };
  if (daysLeft === 0) return { label: "Expires today", color: "#A32D2D", bg: "#fcebeb", border: "#f3c2c2" };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: "#854F0B", bg: "#faeeda", border: "#f0d5a8" };
  return { label: `${daysLeft}d left`, color: "#2d6a10", bg: "#eaf3de", border: "#cfe5b8" };
}

export default async function Dashboard() {
  let allEmployees: Emp[] = [];
  try {
    allEmployees = await db.select().from(employees);
  } catch {}
  const total = allEmployees.length;
  const active = allEmployees.filter(e => e.status === "active").length;
  const inactive = allEmployees.filter(e => e.status === "inactive").length;

  const alerts = buildAlerts(allEmployees);
  const expired = alerts.filter(a => a.daysLeft < 0);
  const within30 = alerts.filter(a => a.daysLeft >= 0 && a.daysLeft <= 30);
  const within90 = alerts.filter(a => a.daysLeft > 30 && a.daysLeft <= 90);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-up">
      {/* Slim hero — tracker style */}
      <div className="hero">
        <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}>
          <div className="hero-greet">{greeting}, Hamza 👋</div>
          <div className="hero-cta">
            <Link href="/employees/new" className="hero-btn hero-btn-light">＋ Add Employee</Link>
            <Link href="/employees" className="hero-btn hero-btn-dark">View Employees</Link>
          </div>
        </div>

        <div className="hero-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-urdu.png" alt="Supreme Art" className="hero-mark-img" />
          <div className="hero-mark-text">Supreme Art (Pvt) Ltd</div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Employees" value={total} sub="All records on file" />
        <StatCard label="Active" value={active} sub="Currently employed" color="#15803D" />
        <StatCard label="Inactive" value={inactive} sub="Resigned or on hold" color="var(--text2)" />
        <StatCard label="Open Alerts" value={alerts.length} sub="Documents needing attention" warn={alerts.length > 0} />
      </div>

      {/* Alerts */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0, paddingBottom: 0, border: "none" }}>Document & Contract Alerts</div>
          <div style={{ fontSize: 11, color: "#888" }}>
            Showing items expiring within 90 days, or already expired.
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="empty" style={{ padding: "2.5rem 1rem" }}>
            ✓ No upcoming expiries. Everything is current.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {expired.length > 0 && <AlertGroup title="🔴 Already expired" rows={expired} />}
            {within30.length > 0 && <AlertGroup title="🟠 Within 30 days" rows={within30} />}
            {within90.length > 0 && <AlertGroup title="🟢 31–90 days out" rows={within90} />}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertGroup({ title, rows }: { title: string; rows: Alert[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        {title} <span style={{ color: "#aaa", fontWeight: 500 }}>({rows.length})</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((a, i) => {
          const sev = severity(a.daysLeft);
          return (
            <Link key={i} href={`/employees/${a.empId}`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fafaf6",
                border: "1px solid var(--border)",
                textDecoration: "none",
                color: "var(--fg)",
                transition: "all 0.15s",
              }}>
              {/* doc type chip */}
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                padding: "4px 10px", borderRadius: 6, color: "#fff",
                background: DOC_ACCENT[a.docType], minWidth: 70, textAlign: "center",
              }}>{a.docType}</span>

              {/* name + designation */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                  {a.name} <span style={{ color: "#aaa", fontWeight: 500, fontSize: 11 }}>· {a.empCode}</span>
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {a.designation || "—"} · expires {fmtDate(a.date)}
                </div>
              </div>

              {/* severity badge */}
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: "4px 10px", borderRadius: 999,
                color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`,
                whiteSpace: "nowrap",
              }}>{sev.label}</span>

              <span style={{ color: "#bbb", fontSize: 14 }}>›</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub, warn }: { label: string; value: number; icon?: string; color?: string; bg?: string; sub?: string; warn?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${warn ? "warn" : ""}`} style={color && !warn ? { color } : undefined}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
