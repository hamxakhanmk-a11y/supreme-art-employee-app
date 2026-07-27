"use client";
import { useEffect, useState } from "react";

interface ModuleDef { key: string; label: string; hint: string }
interface RolePerm { role: string; label: string; modules: string[]; canEdit: boolean }

const ROLE_COLOR: Record<string, string> = {
  admin: "#A32D2D",
  hr: "#185FA5",
  ceo: "#0F766E",
  procurement: "#B45309",
  engineer: "#0891B2",
  other: "#64748B",
};

export default function RolesClient() {
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [roles, setRoles] = useState<RolePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [savedRole, setSavedRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/roles");
        if (!r.ok) { setError("Failed to load role permissions"); setLoading(false); return; }
        const d = await r.json();
        setModules(d.modules);
        setRoles(d.roles);
      } catch {
        setError("Failed to load role permissions");
      }
      setLoading(false);
    })();
  }, []);

  function toggleModule(role: string, key: string) {
    setSavedRole(null);
    setRoles(rs => rs.map(r => {
      if (r.role !== role) return r;
      const has = r.modules.includes(key);
      return { ...r, modules: has ? r.modules.filter(m => m !== key) : [...r.modules, key] };
    }));
  }
  function setCanEdit(role: string, canEdit: boolean) {
    setSavedRole(null);
    setRoles(rs => rs.map(r => (r.role === role ? { ...r, canEdit } : r)));
  }
  function setAll(role: string, on: boolean) {
    setSavedRole(null);
    setRoles(rs => rs.map(r => (r.role === role ? { ...r, modules: on ? modules.map(m => m.key) : [] } : r)));
  }

  async function save(role: string) {
    const r = roles.find(x => x.role === role);
    if (!r) return;
    setSavingRole(role);
    setError("");
    try {
      const res = await fetch("/api/roles", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: r.role, modules: r.modules, canEdit: r.canEdit }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Save failed");
      } else {
        setSavedRole(role);
        setTimeout(() => setSavedRole(s => (s === role ? null : s)), 2500);
      }
    } catch {
      setError("Save failed");
    }
    setSavingRole(null);
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Role Permissions</h1>
        <p style={{ color: "var(--text2)", marginTop: 4, fontSize: 13 }}>
          Choose which sections each role can open. <b>Read-only</b> lets a role view its
          sections but not make changes. The Owner (Super Admin) always has full access.
        </p>
      </div>

      {error && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "var(--text2)", padding: 16 }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {roles.map(r => {
            const accent = ROLE_COLOR[r.role] || "var(--brand)";
            return (
              <div key={r.role} style={{
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12,
                padding: 16, borderTop: `3px solid ${accent}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: accent }}>{r.label}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={!r.canEdit} onChange={e => setCanEdit(r.role, !e.target.checked)} />
                    Read-only (view but can’t edit)
                  </label>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setAll(r.role, true)} style={linkBtn}>All</button>
                  <button onClick={() => setAll(r.role, false)} style={linkBtn}>None</button>
                </div>

                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8,
                }}>
                  {modules.map(m => {
                    const on = r.modules.includes(m.key);
                    return (
                      <label key={m.key} style={{
                        display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                        border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer",
                        background: on ? "var(--bg2)" : "transparent",
                      }}>
                        <input type="checkbox" checked={on} onChange={() => toggleModule(r.role, m.key)} style={{ marginTop: 2 }} />
                        <span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                          <span style={{ display: "block", fontSize: 11, color: "var(--text2)", marginTop: 1 }}>{m.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => save(r.role)} disabled={savingRole === r.role} style={saveBtn(accent)}>
                    {savingRole === r.role ? "Saving…" : "Save"}
                  </button>
                  {savedRole === r.role && <span style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>Saved ✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--brand)", fontWeight: 600,
  fontSize: 12, cursor: "pointer", padding: "2px 4px",
};
const saveBtn = (accent: string): React.CSSProperties => ({
  background: accent, color: "#fff", border: "none", padding: "8px 20px",
  borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
});
