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

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  ceo: "CEO (view-only)",
};
const ROLE_COLOR: Record<Role, string> = {
  superadmin: "#5B21B6",
  admin: "#A32D2D",
  hr: "#185FA5",
  ceo: "#0F766E",
};

const AVATAR_BG: Record<Role, string> = {
  superadmin: "#5B21B6",
  admin: "#A32D2D",
  hr: "#185FA5",
  ceo: "#0F766E",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
}
function fmtDate(d: string | null) {
  if (!d) return "never";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminUsersClient({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState("");

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
    if (!confirm(`Remove user "${name}"? This cannot be undone.`)) return;
    const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Delete failed"); return; }
    refresh();
  }

  // Counts for summary tiles (only active users counted in role buckets)
  const counts = useMemo(() => {
    const c = { total: 0, superadmin: 0, admin: 0, hr: 0, ceo: 0 };
    for (const u of users) {
      c.total++;
      if (u.active) c[u.role]++;
    }
    return c;
  }, [users]);

  return (
    <div className="fade-up">
      {/* === Header === */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Users</h1>
          <p style={{ color: "var(--text2)", marginTop: 4, fontSize: 13 }}>
            Invite, edit roles, or deactivate portal users.
          </p>
        </div>
      </div>

      {/* === Summary tiles === */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12, marginBottom: 18,
      }}>
        <Tile label="TOTAL USERS" value={counts.total} />
        <Tile label="SUPER ADMINS" value={counts.superadmin} accent={ROLE_COLOR.superadmin} />
        <Tile label="ADMINS" value={counts.admin} accent={ROLE_COLOR.admin} />
        <Tile label="HR" value={counts.hr} accent={ROLE_COLOR.hr} />
        <Tile label="CEO" value={counts.ceo} accent={ROLE_COLOR.ceo} />
      </div>

      {!emailConfigured && (
        <div style={{ padding: "10px 14px", background: "#FFF7E6", border: "1px solid #FBBF24",
          borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#7C4A03" }}>
          <b>Resend not configured.</b> Set the <code>RESEND_API_KEY</code> env var on Vercel to send invite/reset emails automatically. Until then, the app will give you a setup link to send to invitees manually.
        </div>
      )}

      {error && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* === Authorized users header + invite button === */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>Authorized Users</div>
        <button onClick={() => { setInviteOpen(true); setInviteResult(null); }} style={btnDark}>
          + Invite User
        </button>
      </div>

      {inviteOpen && (
        <div style={{
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 18, marginBottom: 16,
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
            <form onSubmit={invite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px auto", gap: 10, alignItems: "end" }}>
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

      {/* === User cards === */}
      {loading ? (
        <div style={{ color: "var(--text2)", padding: 16 }}>Loading…</div>
      ) : users.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13, border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg)" }}>
          No users yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {users.map(u => {
            const isSelf = u.id === currentUserId;
            return (
              <div key={u.id} style={{
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
                padding: "8px 12px", display: "flex", alignItems: "center", gap: 10,
                opacity: u.active ? 1 : 0.6,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: AVATAR_BG[u.role], color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 12, flexShrink: 0,
                }}>{initials(u.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{u.name}</span>
                    {isSelf && (
                      <span style={{
                        padding: "1px 6px", borderRadius: 999, background: "#E0F2FE", color: "#075985",
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                      }}>YOU</span>
                    )}
                    {!u.active && (
                      <span style={{
                        padding: "1px 6px", borderRadius: 999, background: "#FEE2E2", color: "#7C1F1F",
                        fontSize: 9, fontWeight: 700,
                      }}>DISABLED</span>
                    )}
                    {u.active && !u.hasPassword && (
                      <span style={{
                        padding: "1px 6px", borderRadius: 999, background: "#FEF3C7", color: "#92400E",
                        fontSize: 9, fontWeight: 700,
                      }}>INVITED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.email} · Last login: {fmtDate(u.lastLoginAt)}
                  </div>
                </div>
                <select value={u.role}
                  onChange={e => patch(u.id, { role: e.target.value })}
                  style={{
                    padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: "1px solid var(--border)", color: ROLE_COLOR[u.role],
                    background: "var(--bg)", cursor: "pointer", minWidth: 140,
                  }}>
                  <option value="superadmin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="hr">HR</option>
                  <option value="ceo">CEO (view-only)</option>
                </select>
                {u.active ? (
                  <button onClick={() => reInvite(u.id, u.name)} style={btnOutline} title="Resend invite link">
                    Resend
                  </button>
                ) : (
                  <button onClick={() => patch(u.id, { active: true })} style={btnOutline}>
                    Enable
                  </button>
                )}
                {!isSelf && (
                  u.active ? (
                    <button onClick={() => patch(u.id, { active: false })} style={btnOutlineDanger}>
                      Disable
                    </button>
                  ) : (
                    <button onClick={() => del(u.id, u.name)} style={btnOutlineDanger}>
                      Remove
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12,
      padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6,
      borderTop: accent ? `3px solid ${accent}` : "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: 700, color: "var(--text2)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: accent || "var(--text)" }}>{value}</div>
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

const btnPrimary: React.CSSProperties = { background: "var(--brand)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnDark: React.CSSProperties = { background: "#1f1f1f", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", padding: "9px 14px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" };
const btnOutline: React.CSSProperties = { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: "pointer" };
const btnOutlineDanger: React.CSSProperties = { background: "var(--bg)", color: "#A32D2D", border: "1px solid #E5B8B8", padding: "4px 10px", borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: "pointer" };
