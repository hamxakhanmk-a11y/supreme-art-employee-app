"use client";
import { useEffect, useMemo, useState } from "react";

interface ModuleDef { key: string; label: string; hint: string }
interface RolePerm { role: string; label: string; modules: string[]; canEdit: boolean }

const ROLE_COLOR: Record<string, string> = {
  admin: "#A32D2D",
  hr: "#185FA5",
  ceo: "#0F766E",
  procurement: "#B45309",
  engineer: "#0891B2",
  finance: "#047857",
  design: "#7C3AED",
  accounts: "#BE185D",
  other: "#64748B",
};

// Which sub-tab a permission belongs under. Prefix rules first, then exact keys,
// so new module keys slot in automatically (e.g. any future purchase.* or
// reports.*). Order mirrors the top navigation.
const GROUP_ORDER = [
  "Attendance", "Forms & Leave", "Salary", "KPI", "Purchase",
  "Station", "Procurement", "Store", "Reports", "Employees",
];
function groupOf(key: string): string {
  if (key.startsWith("reports.")) return "Reports";
  if (key.startsWith("purchase")) return "Purchase";
  if (["demand", "po", "grn", "inspection"].includes(key)) return "Procurement";
  switch (key) {
    case "employees":  return "Employees";
    case "attendance": return "Attendance";
    case "forms":      return "Forms & Leave";
    case "salary":     return "Salary";
    case "kpi":        return "KPI";
    case "station":    return "Station";
    case "store":      return "Store";
    default:           return "Other";
  }
}

export default function RolesClient() {
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [roles, setRoles] = useState<RolePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [savedRole, setSavedRole] = useState<string | null>(null);
  const [tab, setTab] = useState("");

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

  // The sub-tabs actually present, in nav order (plus any stragglers).
  const tabs = useMemo(() => {
    const present = new Set(modules.map(m => groupOf(m.key)));
    const ordered = GROUP_ORDER.filter(g => present.has(g));
    for (const g of present) if (!ordered.includes(g)) ordered.push(g);
    return ordered;
  }, [modules]);

  // Active tab falls back to the first one until the user picks another — no
  // effect needed, so it stays in sync as modules load.
  const activeTab = tab || tabs[0] || "";

  const tabModules = useMemo(
    () => modules.filter(m => groupOf(m.key) === activeTab),
    [modules, activeTab],
  );

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
  // "All" / "None" act on the modules in the current sub-tab only.
  function setTabAll(role: string, on: boolean) {
    setSavedRole(null);
    const keys = tabModules.map(m => m.key);
    setRoles(rs => rs.map(r => {
      if (r.role !== role) return r;
      const set = new Set(r.modules);
      if (on) keys.forEach(k => set.add(k)); else keys.forEach(k => set.delete(k));
      return { ...r, modules: [...set] };
    }));
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
          Pick a section tab, then choose which roles can open it. <b>Read-only</b> lets a role
          view its sections but not make changes. The Owner (Super Admin) always has full access.
        </p>
      </div>

      {error && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "var(--text2)", padding: 16 }}>Loading…</div>
      ) : (
        <>
          {/* Section sub-tabs (mirror the top nav) */}
          <div style={{
            position: "sticky", top: 0, zIndex: 5, background: "var(--bg1, var(--bg))",
            display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 0 10px",
            borderBottom: "1px solid var(--border)", marginBottom: 14,
          }}>
            {tabs.map(t => {
              const active = t === activeTab;
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                  cursor: "pointer", border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                  background: active ? "var(--brand)" : "transparent",
                  color: active ? "#fff" : "var(--text2)",
                }}>{t}</button>
              );
            })}
          </div>

          <div style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 12 }}>
            Showing <b style={{ color: "var(--text)" }}>{activeTab}</b> permissions for every role.
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {roles.map(r => {
              const accent = ROLE_COLOR[r.role] || "var(--brand)";
              const onCount = tabModules.filter(m => r.modules.includes(m.key)).length;
              return (
                <div key={r.role} style={{
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: 16, borderTop: `3px solid ${accent}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: accent }}>{r.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{onCount}/{tabModules.length} in {activeTab}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", cursor: "pointer" }}>
                      <input type="checkbox" checked={!r.canEdit} onChange={e => setCanEdit(r.role, !e.target.checked)} />
                      Read-only (view but can’t edit)
                    </label>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setTabAll(r.role, true)} style={linkBtn}>All in tab</button>
                    <button onClick={() => setTabAll(r.role, false)} style={linkBtn}>None</button>
                  </div>

                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8,
                  }}>
                    {tabModules.map(m => {
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
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>Saves this role across all tabs.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
