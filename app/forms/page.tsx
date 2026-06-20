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
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Forms</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Fill, print, submit, and file company forms. Approve incoming requests from HR.</p>
      </div>

      {/* Quick shortcuts row — most common actions */}
      <div className="card" style={{ background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)", color: "#fff", padding: "16px 18px", marginBottom: 18, border: "none" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.85, marginBottom: 10 }}>
          Quick actions
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ShortcutBtn href="/forms/leave"    icon="📝" label="Submit Leave Form" />
          <ShortcutBtn href="/forms/half-day" icon="½"  label="Submit Half-Day Form" />
          <ShortcutBtn href="/forms/file"     icon="📎" label="File Signed Form" />
        </div>
      </div>

      {/* Detail cards */}
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
          href="/forms/file"
          title="File Signed Form"
          urdu="دستخط شدہ فارم درج کریں"
          desc="Upload a scan or photo of a signed paper form against an employee."
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

function ShortcutBtn({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "10px 16px", borderRadius: 8,
        background: "rgba(255,255,255,0.15)", color: "#fff",
        border: "1px solid rgba(255,255,255,0.35)",
        fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
        textDecoration: "none",
        transition: "background 0.15s",
      }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </Link>
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
