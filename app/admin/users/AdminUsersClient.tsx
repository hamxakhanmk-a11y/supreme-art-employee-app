"use client";
import { useEffect, useMemo, useState } from "react";

type Role = string;
interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
interface RoleMeta { key: string; label: string; color: string; builtin: boolean }

const FALLBACK_COLOR = "#64748B";

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
  const [error, setError] = useState("");

  const [roleList, setRoleList] = useState<RoleMeta[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iRole, setIRole] = useState<Role>("hr");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/users");
    if (!r.ok) { setError("Failed to load users"); setLoading(false); return; }
    const d = await r.json();
    setUsers(d.users);
    setLoading(false);
  }
  async function loadRoles() {
    try {
      const r = await fetch("/api/roles");
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.allRoles)) setRoleList(d.allRoles);
    } catch { /* keep whatever we have */ }
  }
  useEffect(() => { refresh(); loadRoles(); }, []);

  const colorFor = (role: string) => roleList.find(r => r.key === role)?.color || FALLBACK_COLOR;
  const labelFor = (role: string) => roleList.find(r => r.key === role)?.label || role;

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    const r = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: iName, email: iEmail, role: iRole }),
    });
    const d = await r.json().catch(() => ({}));
    setAdding(false);
    if (!r.ok) { setError(d.error || "Failed to add user"); return; }
    setIName(""); setIEmail(""); setIRole("hr"); setAddOpen(false);
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

  async function del(id: number, name: string) {
    if (!confirm(`Remove "${name}" from the allowlist? They'll lose access at their next sign-in.`)) return;
    const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Delete failed"); return; }
    refresh();
  }

  // Active-user counts per role (for the summary tiles).
  const counts = useMemo(() => {
    const byRole: Record<string, number> = {};
    for (const u of users) if (u.active) byRole[u.role] = (byRole[u.role] || 0) + 1;
    return { total: users.length, byRole };
  }, [users]);

  return (
    <div className="fade-up">
      {/* === Header === */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Users</h1>
          <p style={{ color: "var(--text2)", marginTop: 4, fontSize: 13 }}>
            Approved Google accounts. Add an email here and that person can sign in with Google.
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
        {roleList.map(r => (
          <Tile key={r.key} label={r.label.toUpperCase()} value={counts.byRole[r.key] || 0} accent={r.color} />
        ))}
      </div>

      <div style={{ padding: "10px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE",
        borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#1E3A8A" }}>
        Sign-in is via <b>Google</b>. The email you add below must match their Google account exactly.
      </div>

      {error && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* === Authorized users header + add button === */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>Authorized Users</div>
        <button onClick={() => setAddOpen(o => !o)} style={btnDark}>
          {addOpen ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {addOpen && (
        <div style={{
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 18, marginBottom: 16,
        }}>
          <form onSubmit={addUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px auto", gap: 10, alignItems: "end" }}>
            <Field label="Name"><input className="auth-input" required value={iName} onChange={e => setIName(e.target.value)} /></Field>
            <Field label="Google email"><input className="auth-input" type="email" required value={iEmail} onChange={e => setIEmail(e.target.value)} placeholder="person@gmail.com" /></Field>
            <Field label="Role">
              <select className="auth-input" value={iRole} onChange={e => setIRole(e.target.value)}>
                {roleList.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={adding} style={btnPrimary}>{adding ? "Adding…" : "Add"}</button>
            </div>
          </form>
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
                  background: colorFor(u.role), color: "#fff",
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
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.email} · Last login: {fmtDate(u.lastLoginAt)}
                  </div>
                </div>
                <select value={u.role}
                  onChange={e => patch(u.id, { role: e.target.value })}
                  style={{
                    padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: "1px solid var(--border)", color: colorFor(u.role),
                    background: "var(--bg)", cursor: "pointer",
                    width: 150, flexShrink: 0,
                  }}>
                  {/* Keep the current role selectable even if the list hasn't loaded yet */}
                  {!roleList.some(r => r.key === u.role) && <option value={u.role}>{labelFor(u.role)}</option>}
                  {roleList.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
                {!isSelf && (
                  u.active ? (
                    <button onClick={() => patch(u.id, { active: false })} style={{ ...btnOutlineDanger, flexShrink: 0 }}>
                      Disable
                    </button>
                  ) : (
                    <>
                      <button onClick={() => patch(u.id, { active: true })} style={{ ...btnOutline, flexShrink: 0 }}>
                        Enable
                      </button>
                      <button onClick={() => del(u.id, u.name)} style={{ ...btnOutlineDanger, flexShrink: 0 }}>
                        Remove
                      </button>
                    </>
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
const btnOutline: React.CSSProperties = { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: "pointer" };
const btnOutlineDanger: React.CSSProperties = { background: "var(--bg)", color: "#A32D2D", border: "1px solid #E5B8B8", padding: "4px 10px", borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: "pointer" };
