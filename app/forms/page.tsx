import Link from "next/link";
import { db } from "@/lib/db";
import { leaveRequests } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function FormsLanding() {
  const [pendingRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leaveRequests)
    .where(eq(leaveRequests.status, "pending"));
  const pending = pendingRow?.c ?? 0;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Forms</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Fill, print, submit, and file company forms. Approve incoming requests from HR.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <FormCard
          href="/forms/leave"
          icon="📝"
          title="Leave Application Form"
          urdu="رخصت کی درخواست فارم"
          desc="Full-day or multi-day leaves of any type — sick, annual, casual, etc."
        />
        <FormCard
          href="/forms/half-day"
          icon="½"
          title="Half-Day Leave Form"
          urdu="آدھے دن کی رخصت کا فارم"
          desc="Single-day permission to leave after 1 PM (per policy)."
        />
        <FormCard
          href="/forms/file"
          icon="📎"
          title="File Signed Form"
          urdu="دستخط شدہ فارم درج کریں"
          desc="Upload a scan or photo of a signed paper form against an employee."
        />
        <FormCard
          href="/forms/approvals"
          icon="✓"
          title="Pending Approvals"
          urdu="منظوری کے درخواستیں"
          desc={`${pending} request${pending === 1 ? "" : "s"} waiting for HR decision.`}
          badge={pending > 0 ? String(pending) : undefined}
        />
      </div>
    </div>
  );
}

function FormCard({ href, icon, title, urdu, desc, badge }: {
  href: string; icon: string; title: string; urdu: string; desc: string; badge?: string;
}) {
  return (
    <Link href={href} className="form-card" style={{
      display: "flex", flexDirection: "column",
      textDecoration: "none", color: "var(--text)",
      borderRadius: 12, overflow: "hidden",
      border: "1px solid var(--border)",
      background: "var(--bg)",
      boxShadow: "var(--shadow-sm)",
      transition: "transform 0.15s, box-shadow 0.15s",
      position: "relative",
    }}>
      {/* Red header band */}
      <div style={{
        background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)",
        color: "#fff",
        padding: "16px 18px",
        display: "flex", alignItems: "center", gap: 12,
        position: "relative",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800,
          flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.2 }}>{title}</div>
          <div className="urdu" style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{urdu}</div>
        </div>
        {badge && (
          <span style={{
            padding: "3px 10px", borderRadius: 999,
            background: "#fff", color: "var(--brand)",
            fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}>{badge}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 18px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55 }}>{desc}</div>
        <div style={{ fontSize: 12, color: "var(--brand)", fontWeight: 700, letterSpacing: 0.3 }}>
          Open →
        </div>
      </div>
    </Link>
  );
}
