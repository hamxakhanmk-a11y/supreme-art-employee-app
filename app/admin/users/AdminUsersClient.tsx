"use client";
import { useEffect, useMemo, useState } from "react";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { cmpText, matchesQuery } from "@/lib/listTools";
import { usePageState } from "@/lib/usePageState";

type UserSort = "listed" | "name" | "role" | "login" | "status";
const USER_SORT_OPTIONS: SortOption<UserSort>[] = [
  { value: "listed", label: "As listed" },
  { value: "name", label: "Name" },
  { value: "role", label: "Role" },
  { value: "login", label: "Last login (latest)" },
  { value: "status", label: "Active first" },
];

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
  // Search and sort are kept for when the user comes back to this screen.
  const [q, setQ] = usePageState("q", "");
  const [sort, setSort] = usePageState<UserSort>("sort", "listed");

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

  // Search + sort are client-side only; "As listed" keeps the order the server sends.
  const visibleUsers = useMemo(() => {
    const out = users.filter(u => matchesQuery(q, [u.name, u.email, u.role, labelFor(u.role)]));
    switch (sort) {
      case "name": return out.sort((a, b) => cmpText(a.name, b.name));
      case "role": return out.sort((a, b) => cmpText(labelFor(a.role), labelFor(b.role)) || cmpText(a.name, b.name));
      case "login": return out.sort((a, b) => (b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0) - (a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0));
      case "status": return out.sort((a, b) => Number(b.active) - Number(a.active) || cmpText(a.name, b.name));
      default: return out;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, q, sort, roleList]);

  return (
    <div className="fade-up">
      {/* === One row: the counts, search and sort, then the add button at the right === */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
          <UserStat label="Total users" value={counts.total} />
          {roleList.map(r => (
            <UserStat key={r.key} label={r.label} value={counts.byRole[r.key] || 0} accent={r.color} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox width={250} value={q} onChange={setQ} placeholder="🔍  Search name, email, role…" />
          <SortBy options={USER_SORT_OPTIONS} value={sort} onChange={setSort} minWidth={170} />
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          <button onClick={() => setAddOpen(o => !o)} style={btnDark}>
            {addOpen ? "Cancel" : "+ Add User"}
          </button>
        </div>
      </div>

      {error && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {addOpen && (
        <div style={{
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 18, marginBottom: 16,
        }}>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 10 }}>
            Sign-in is via <b>Google</b>. The email you add must match their Google account exactly.
          </div>
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
      ) : visibleUsers.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text2)", fontSize: 13, border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg)" }}>
          {users.length === 0 ? "No users yet." : "No users match your search."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {visibleUsers.map(u => {
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
                      <button onClick={() => del(u.id, u.name)} className="btn btn-sm btn-restricted" style={{ flexShrink: 0 }}>
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

function UserStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 10px", borderRadius: 8, background: "#fafaf6", border: "1px solid var(--border)", borderLeft: accent ? `3px solid ${accent}` : "1px solid var(--border)" }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: accent || "var(--text)" }}>{value}</span>
      <span style={{ fontSize: 10.5, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
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

const btnPrimary: React.CSSProperties = { background: "#111", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnDark: React.CSSProperties = { background: "#111", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnOutline: React.CSSProperties = { background: "#111", color: "#fff", border: "1px solid #111", padding: "4px 10px", borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: "pointer" };
const btnOutlineDanger: React.CSSProperties = { background: "#111", color: "#fff", border: "1px solid #111", padding: "4px 10px", borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: "pointer" };
