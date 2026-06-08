import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { sql, eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let total = 0, active = 0, inactive = 0;
  let recent: (typeof employees.$inferSelect)[] = [];
  try {
    const [t] = await db.select({ c: sql<number>`count(*)::int` }).from(employees);
    total = t?.c ?? 0;
    const [a] = await db.select({ c: sql<number>`count(*)::int` }).from(employees).where(eq(employees.status, "active"));
    active = a?.c ?? 0;
    const [i] = await db.select({ c: sql<number>`count(*)::int` }).from(employees).where(eq(employees.status, "inactive"));
    inactive = i?.c ?? 0;
    recent = await db.select().from(employees).orderBy(desc(employees.createdAt)).limit(5);
  } catch {}

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-up">
      {/* Hero */}
      <div className="hero" style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ position: "relative", zIndex: 2, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {greeting}, Hamza 👋
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "8px 0 4px", letterSpacing: -0.3 }}>
            Welcome to Supreme Art HR Portal
          </h1>
          <p style={{ opacity: 0.9, fontSize: 13, maxWidth: 600 }}>
            Manage your team's records, onboard new employees, and keep everything organized — all in one place.
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/employees/new" className="btn" style={{ background: "#fff", color: "var(--primary)", borderColor: "#fff", fontWeight: 600 }}>
              ＋ Add New Employee
            </Link>
            <Link href="/employees" className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
              👥 View All Employees
            </Link>
          </div>
        </div>

        {/* Logo on the right — directly on red, white-tinted */}
        <div style={{
          position: "relative",
          zIndex: 2,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingRight: 12,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-transparent.png"
            alt="Supreme Art"
            style={{
              height: 150,
              width: "auto",
              display: "block",
              // White silhouette on the red hero
              filter: "brightness(0) invert(1)",
            }}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard
          label="Total Employees"
          value={total}
          icon="👥"
          color="var(--primary)"
          bg="#fdecec"
          sub="All records on file"
        />
        <StatCard
          label="Active"
          value={active}
          icon="✓"
          color="var(--success)"
          bg="var(--success-bg)"
          sub="Currently employed"
        />
        <StatCard
          label="Inactive"
          value={inactive}
          icon="○"
          color="#888"
          bg="#f3f0eb"
          sub="Resigned or on hold"
        />
        <StatCard
          label="This Month"
          value={recent.filter(e => new Date(e.createdAt).getMonth() === new Date().getMonth()).length}
          icon="✨"
          color="var(--accent)"
          bg="var(--info-bg)"
          sub="New additions"
        />
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Recently added */}
        <div className="card">
          <div className="section-title">Recently Added</div>
          {recent.length === 0 ? (
            <div className="empty" style={{ padding: "2rem 1rem" }}>
              No employees yet. Add your first one!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recent.map((e) => (
                <Link
                  key={e.id}
                  href={`/employees/${e.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", borderRadius: 10, background: "#fafaf6",
                    textDecoration: "none", color: "var(--fg)",
                    transition: "all 0.15s", border: "1px solid transparent",
                  }}
                  className="hover-row"
                >
                  {e.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={e.photoUrl} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                      {e.firstName[0]}{e.lastName[0]}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.firstName} {e.lastName}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {e.designation || "—"} • {e.employeeId}
                    </div>
                  </div>
                  <span className={`badge ${e.status === "active" ? "badge-active" : "badge-inactive"}`}>{e.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="section-title">Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ActionLink href="/employees/new" icon="＋" label="Add New Employee" desc="Register a new team member" color="var(--primary)" />
            <ActionLink href="/employees" icon="👥" label="View All Employees" desc="Browse the employee directory" color="var(--accent)" />
            <ActionLink href="/employees/form/print" icon="🖨" label="Print Blank Form" desc="Get the onboarding form for new hires" color="#444" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg, sub }: { label: string; value: number; icon: string; color: string; bg: string; sub: string }) {
  return (
    <div className="card card-hover">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="form-label" style={{ marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>{sub}</div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: bg, color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 700,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ActionLink({ href, icon, label, desc, color }: { href: string; icon: string; label: string; desc: string; color: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 10,
        background: "#fafaf6", border: "1px solid var(--border)",
        textDecoration: "none", color: "var(--fg)", transition: "all 0.15s",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 700, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#888" }}>{desc}</div>
      </div>
      <span style={{ color: "#bbb" }}>→</span>
    </Link>
  );
}
