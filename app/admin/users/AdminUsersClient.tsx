"use client";
import { useEffect, useState } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "hr" | "ceo";
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  hasPassword: boolean;
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", ceo: "CEO" };
const ROLE_COLOR: Record<string, string> = { admin: "#A32D2D", hr: "#185FA5", ceo: "#0F766E" };

export default function AdminUsersClient({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iRole, setIRole] = useState<"admin" | "hr" | "ceo">("hr");
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
            <form onSubmit={invite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: 10, alignItems: "end" }}>
              <Field label="Name"><input className="auth-input" required value={iName} onChange={e => setIName(e.target.value)} /></Field>
              <Field label="Email"><input className="auth-input" type="email" required value={iEmail} onChange={e => setIEmail(e.target.value)} /></Field>
              <Field label="Role">
                <select className="auth-input" value={iRole} onChange={e => setIRole(e.target.value as any)}>
                  <option value="admin">Admin</option>
                  <option value="hr">HR</option>
                  <option value="ceo">CEO (view-only)</option>
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

      {loading ? (
        <div style={{ color: "var(--text2)" }}>Loading…</div>
      ) : (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
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
              {users.map(u => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Td><b>{u.name}</b>{isSelf && <span style={{ color: "var(--text2)", fontWeight: 400 }}> (you)</span>}</Td>
                    <Td>{u.email}</Td>
                    <Td>
                      <select disabled={isSelf} value={u.role}
                        onChange={e => patch(u.id, { role: e.target.value })}
                        style={{
                          padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                          border: `1px solid ${ROLE_COLOR[u.role]}`, color: ROLE_COLOR[u.role],
                          background: "transparent", cursor: isSelf ? "not-allowed" : "pointer",
                        }}>
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
                      {" · "}
                      {!isSelf && (
                        <>
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
