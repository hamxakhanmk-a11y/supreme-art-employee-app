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
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Forms</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Fill, print, and submit company forms. Approve incoming requests from HR.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <FormCard
          href="/forms/leave"
          title="Leave Application Form"
          urdu="رخصت کی درخواست فارم"
          desc="Full-day or multi-day leaves of any type — sick, annual, casual, etc."
        />
        <FormCard
          href="/forms/half-day"
          title="Half-Day Leave Form"
          urdu="آدھے دن کی رخصت کا فارم"
          desc="Single-day permission to leave after 1 PM (per policy)."
        />
        <FormCard
          href="/forms/approvals"
          title="Pending Approvals"
          urdu="منظوری کے درخواستیں"
          desc={`${pending} request${pending === 1 ? "" : "s"} waiting for HR decision.`}
          accent
          badge={pending > 0 ? String(pending) : undefined}
        />
      </div>
    </div>
  );
}

function FormCard({ href, title, urdu, desc, accent, badge }: { href: string; title: string; urdu: string; desc: string; accent?: boolean; badge?: string }) {
  return (
    <Link href={href} className="card card-hover" style={{
      textDecoration: "none", color: "var(--text)",
      borderColor: accent ? "var(--brand)" : "var(--border)",
      borderWidth: accent ? 2 : 1,
      display: "block", position: "relative",
    }}>
      {badge && (
        <span style={{
          position: "absolute", top: 12, right: 12,
          padding: "2px 10px", borderRadius: 999,
          background: "var(--brand)", color: "#fff",
          fontSize: 11, fontWeight: 700,
        }}>{badge}</span>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: accent ? "var(--brand)" : "var(--text)" }}>{title}</div>
      <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>{urdu}</div>
      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 10, lineHeight: 1.5 }}>{desc}</div>
      <div style={{ fontSize: 12, color: "var(--brand)", marginTop: 12, fontWeight: 600 }}>
        Open →
      </div>
    </Link>
  );
}
