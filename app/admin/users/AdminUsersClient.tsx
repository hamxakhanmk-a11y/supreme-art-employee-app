"use client";
import { useEffect, useMemo, useState } from "react";

type Role = "superadmin" | "admin" | "hr" | "ceo";
interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  hasPassword: boolean;
}

const ROLE_LABEL: Record<Role, string> = { superadmin: "Super Admin", admin: "Admin", hr: "HR", ceo: "CEO" };
const ROLE_COLOR: Record<Role, string> = { superadmin: "#5B21B6", admin: "#A32D2D", hr: "#185FA5", ceo: "#0F766E" };

type TabKey = "all" | "superadmin" | "admin" | "hr" | "ceo" | "disabled";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All Users" },
  { key: "superadmin", label: "Super Admin" },
  { key: "admin", label: "Admin" },
  { key: "hr", label: "HR" },
  { key: "ceo", label: "CEO" },
  { key: "disabled", label: "Disabled" },
];

export default function AdminUsersClient({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("all");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iRole, setIRole] = useState<Role>("hr");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string; emailSent: boolean } | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/users");
    if (!r.ok) { setError("Failed to load users"); setLoading(false); return; }
    const d = await r.json();
    setUsers(d.users);
    setEmailConfigured(!!d.emailConfigured);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError("");
    setInviteResult(null);
    const r = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: iName, email: iEmail, role: iRole }),
    });
    const d = await r.json().catch(() => ({}));
    setInviting(false);
    if (!r.ok) { setError(d.error || "Failed to invite"); return; }
    setInviteResult({ url: d.setupUrl, emailSent: d.emailSent });
    setIName(""); setIEmail(""); setIRole("hr");
    refresh();
  }

  async function patch(id: number, body: any) {
    const r = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Update failed");
      return;
    }
    refresh();
  }

  async function reInvite(id: number, name: string) {
    if (!confirm(`Send a fresh invite link to ${name}?`)) return;
    const r = await fetch(`/api/users/${id}/invite`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) { alert(d.error || "Failed"); return; }
    if (d.emailSent) alert("Invite email sent.");
    else prompt("Email not configured — copy this link and send it manually:", d.setupUrl);
  }

  async function del(id: number, name: string) {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Delete failed"); return; }
    refresh();
  }

  async function promoteToSuperAdmin(u: User) {
    if (!confirm(`Promote ${u.name} to Super Admin? They will gain full user-management access.`)) return;
    await patch(u.id, { role: "superadmin" });
  }

  // Counts per tab
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, superadmin: 0, admin: 0, hr: 0, ceo: 0, disabled: 0 };
    for (const u of users) {
      c.all++;
      if (!u.active) c.disabled++;
      else c[u.role]++;
    }
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    if (tab === "all") return users;
    if (tab === "disabled") return users.filter(u => !u.active);
    return users.filter(u => u.active && u.role === tab);
  }, [users, tab]);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Users</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Invite, edit roles, or deactivate portal users.</p>
        </div>
        <button onClick={() => { setInviteOpen(true); setInviteResult(null); }}
          style={btnPrimary}>+ Invite User</button>
      </div>

      {!emailConfigured && (
        <div style={{ padding: "10px 14px", background: "#FFF7E6", border: "1px solid #FBBF24",
          borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#7C4A03" }}>
          <b>Resend not configured.</b> Set the <code>RESEND_API_KEY</code> env var on Vercel to send invite/reset emails automatically. Until then, the app will give you a setup link to send to invitees manually.
        </div>
      )}

      {error && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {inviteOpen && (
        <div style={{
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 18, marginBottom: 20, boxShadow: "var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.04))"
        }}>
          {inviteResult ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand)" }}>Invite created ✓</div>
              {inviteResult.emailSent
                ? <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>Email sent. The user has 72 hours to set their password.</p>
                : <>
                  <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>Email wasn't sent. Copy this link and give it to the user (valid for 72 hours):</p>
                  <input readOnly value={inviteResult.url}
                    style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 6, fontFamily: "monospace", fontSize: 12 }}
                    onFocus={(e) => e.currentTarget.select()} />
                </>}
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button onClick={() => setInviteResult(null)} style={btnSecondary}>Invite another</button>
                <button onClick={() => { setInviteOpen(false); setInviteResult(null); }} style={btnSecondary}>Close</button>
              </div>
            </div>
          ) : (
            <form onSubmit={invite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px auto", gap: 10, alignItems: "end" }}>
              <Field label="Name"><input className="auth-input" required value={iName} onChange={e => setIName(e.target.value)} /></Field>
              <Field label="Email"><input className="auth-input" type="email" required value={iEmail} onChange={e => setIEmail(e.target.value)} /></Field>
              <Field label="Role">
                <select className="auth-input" value={iRole} onChange={e => setIRole(e.target.value as Role)}>
                  <option value="superadmin">Super Admin</option>
                  <option value="admin">Admin (full access)</option>
                  <option value="hr">HR (full access)</option>
                  <option value="ceo">CEO (view & print only)</option>
                </select>
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={inviting} style={btnPrimary}>{inviting ? "Sending…" : "Send Invite"}</button>
                <button type="button" onClick={() => setInviteOpen(false)} style={btnSecondary}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* === Tabs === */}
      <div style={{
        display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 0,
        overflowX: "auto",
      }}>
        {TABS.map(t => {
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                background: isActive ? "var(--bg)" : "transparent",
                border: "1px solid var(--border)",
                borderBottomColor: isActive ? "var(--bg)" : "var(--border)",
                borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                padding: "8px 14px", fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--brand)" : "var(--text2)",
                cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
              }}>
              {t.label}
              <span style={{
                marginLeft: 6, padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: isActive ? ROLE_COLOR[t.key as Role] || "var(--text2)" : "var(--bg2, #f4f4f4)",
                color: isActive ? "#fff" : "var(--text2)",
              }}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ color: "var(--text2)", padding: 16 }}>Loading…</div>
      ) : (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderTop: "none", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
              No users in this tab.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Last login</Th>
                  <Th style={{ textAlign: "right" }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <Td><b>{u.name}</b>{isSelf && <span style={{ color: "var(--text2)", fontWeight: 400 }}> (you)</span>}</Td>
                      <Td>{u.email}</Td>
                      <Td>
                        <select value={u.role}
                          onChange={e => patch(u.id, { role: e.target.value })}
                          style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                            border: `1px solid ${ROLE_COLOR[u.role]}`, color: ROLE_COLOR[u.role],
                            background: "transparent", cursor: "pointer",
                          }}>
                          <option value="superadmin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="hr">HR</option>
                          <option value="ceo">CEO</option>
                        </select>
                      </Td>
                      <Td>
                        {u.active
                          ? <span style={pill("#0F766E", "#D1FAE5")}>{u.hasPassword ? "Active" : "Invited"}</span>
                          : <span style={pill("#7C1F1F", "#FEE2E2")}>Disabled</span>}
                      </Td>
                      <Td style={{ color: "var(--text2)", fontSize: 12 }}>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </Td>
                      <Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => reInvite(u.id, u.name)} style={btnLink}>Send invite</button>
                        {u.role !== "superadmin" && (
                          <>
                            {" · "}
                            <button onClick={() => promoteToSuperAdmin(u)} style={{ ...btnLink, color: ROLE_COLOR.superadmin }}>
                              Make Super Admin
                            </button>
                          </>
                        )}
                        {!isSelf && (
                          <>
                            {" · "}
                            <button onClick={() => patch(u.id, { active: !u.active })} style={btnLink}>
                              {u.active ? "Disable" : "Enable"}
                            </button>
                            {" · "}
                            <button onClick={() => del(u.id, u.name)} style={{ ...btnLink, color: "#7C1F1F" }}>Delete</button>
                          </>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="auth-field-label">{label}</span>
      {children}
    </label>
  );
}
function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--text2)", ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 14px", verticalAlign: "middle", ...style }}>{children}</td>;
}
function pill(fg: string, bg: string): React.CSSProperties {
  return { padding: "2px 8px", borderRadius: 999, background: bg, color: fg, fontSize: 11, fontWeight: 700, display: "inline-block" };
}
const btnPrimary: React.CSSProperties = { background: "var(--brand)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", padding: "9px 14px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" };
const btnLink: React.CSSProperties = { background: "none", border: "none", color: "var(--brand)", fontWeight: 600, fontSize: 12, cursor: "pointer", padding: 0 };
