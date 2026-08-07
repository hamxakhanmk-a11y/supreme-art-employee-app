"use client";
import { useEffect, useMemo, useState } from "react";

interface ModuleDef { key: string; label: string; hint: string }
interface RolePerm { role: string; label: string; color: string; builtin: boolean; modules: string[]; editModules: string[] }

type Level = "none" | "view" | "edit";
// Mirrors moduleEditKind() in lib/permissions: reports are view-only, purchase.*
// permissions are actions (grant = edit), everything else has view vs edit.
type Kind = "view" | "action" | "section";
function kindOf(key: string): Kind {
  if (key.startsWith("reports.")) return "view";
  if (key.startsWith("purchase")) return "action";
  if (key === "station.delete") return "action";
  return "section";
}

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
    case "capa":       return "Forms & Leave";
    case "salary":     return "Salary";
    case "kpi":        return "KPI";
    case "station":    return "Station";
    case "station.delete": return "Station";
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

  // New-role form
  const [showNew, setShowNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#0F766E");
  const [creating, setCreating] = useState(false);

  async function load() {
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
  }
  useEffect(() => { load(); }, []);

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true); setError("");
    try {
      const res = await fetch("/api/roles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), color: newColor }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Could not create role"); }
      else { setNewLabel(""); setShowNew(false); await load(); }
    } catch { setError("Could not create role"); }
    setCreating(false);
  }

  async function deleteRole(role: string, label: string) {
    if (!confirm(`Delete the "${label}" role? This can't be undone.`)) return;
    setError("");
    const res = await fetch("/api/roles", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not delete role"); return; }
    await load();
  }

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

  const levelOf = (r: RolePerm, key: string): Level =>
    r.editModules.includes(key) ? "edit" : r.modules.includes(key) ? "view" : "none";

  // Apply a level to one module, honouring its kind (view-kind can't reach
  // "edit"; edit implies access).
  function applyLevel(r: RolePerm, key: string, level: Level): RolePerm {
    const mod = new Set(r.modules);
    const ed = new Set(r.editModules);
    const k = kindOf(key);
    const wantEdit = level === "edit" && k !== "view";
    const wantView = level !== "none";
    if (wantView) mod.add(key); else mod.delete(key);
    if (wantEdit) ed.add(key); else ed.delete(key);
    return { ...r, modules: [...mod], editModules: [...ed] };
  }
  function setLevel(role: string, key: string, level: Level) {
    setSavedRole(null);
    setRoles(rs => rs.map(r => (r.role === role ? applyLevel(r, key, level) : r)));
  }
  // Bulk-set every module in the current sub-tab. "edit" grants edit where the
  // kind allows (actions/sections) and view for reports; "view" grants view for
  // sections/reports and clears actions (they have no view-only state).
  function setTabLevel(role: string, level: Level) {
    setSavedRole(null);
    setRoles(rs => rs.map(r => {
      if (r.role !== role) return r;
      let out = r;
      for (const m of tabModules) {
        const k = kindOf(m.key);
        const lvl: Level = level === "view" && k === "action" ? "none" : level;
        out = applyLevel(out, m.key, lvl);
      }
      return out;
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
        body: JSON.stringify({ role: r.role, modules: r.modules, editModules: r.editModules }),
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
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Role Permissions</h1>
          <p style={{ color: "var(--text2)", marginTop: 4, fontSize: 13 }}>
            Pick a section tab, then choose which roles can open it. <b>Read-only</b> lets a role
            view its sections but not make changes. The Owner (Super Admin) always has full access.
          </p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
          {showNew ? "✕ Close" : "＋ New role"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={createRole} style={{
          display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap",
          background: "var(--bg)", border: "1px dashed var(--border-strong, var(--border))",
          borderRadius: 12, padding: 14, marginBottom: 16,
        }}>
          <div>
            <label className="form-label" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text2)", marginBottom: 4 }}>Role name</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} maxLength={80}
              placeholder="e.g. Warehouse" style={{ padding: "8px 11px", minWidth: 220 }} />
          </div>
          <div>
            <label className="form-label" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text2)", marginBottom: 4 }}>Colour</label>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              style={{ width: 48, height: 38, padding: 2, cursor: "pointer" }} />
          </div>
          <button type="submit" disabled={creating || !newLabel.trim()} className="btn btn-primary">
            {creating ? "Creating…" : "Create role"}
          </button>
          <span style={{ fontSize: 11.5, color: "var(--text3)" }}>
            New roles start with <b>no access</b> — grant sections below, then set it on the Users page.
          </span>
        </form>
      )}

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
            Set each section to <b>View</b> (open, read-only) or <b>Edit</b> (make changes). A role can be
            View here and Edit on another tab.
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {roles.map(r => {
              const accent = r.color || "var(--brand)";
              const viewCount = tabModules.filter(m => r.modules.includes(m.key)).length;
              const editCount = tabModules.filter(m => r.editModules.includes(m.key)).length;
              return (
                <div key={r.role} style={{
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: 16, borderTop: `3px solid ${accent}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: accent }}>{r.label}</span>
                    {!r.builtin && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: `${accent}18`, padding: "1px 7px", borderRadius: 999 }}>CUSTOM</span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{viewCount} view · {editCount} edit in {activeTab}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setTabLevel(r.role, "edit")} style={linkBtn}>Edit all</button>
                    <button onClick={() => setTabLevel(r.role, "view")} style={linkBtn}>View all</button>
                    <button onClick={() => setTabLevel(r.role, "none")} style={linkBtn}>None</button>
                    {!r.builtin && (
                      <button onClick={() => deleteRole(r.role, r.label)} style={{ ...linkBtn, color: "#A32D2D" }}>Delete role</button>
                    )}
                  </div>

                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8,
                  }}>
                    {tabModules.map(m => (
                      <ModuleRow key={m.key} m={m} level={levelOf(r, m.key)}
                        onSet={lvl => setLevel(r.role, m.key, lvl)} />
                    ))}
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

// One permission row: a label + hint, and a control whose shape depends on the
// module's kind — reports get View/Off, purchase actions get Allow/Off, and
// normal sections get the full None / View / Edit segmented control.
function ModuleRow({ m, level, onSet }: { m: ModuleDef; level: Level; onSet: (l: Level) => void }) {
  const kind = kindOf(m.key);
  const on = level !== "none";
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
      border: "1px solid var(--border)", borderRadius: 8,
      background: on ? "var(--bg2)" : "transparent",
    }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--text2)", marginTop: 1 }}>{m.hint}</span>
      </span>
      <div style={{ display: "flex", flexShrink: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
        <Seg label="Off" active={kind === "action" ? level !== "edit" : level === "none"} onClick={() => onSet("none")} />
        {kind === "action" ? (
          <Seg label="Allow" active={level === "edit"} onClick={() => onSet("edit")} color="#15803D" />
        ) : (
          <>
            <Seg label="View" active={level === "view"} onClick={() => onSet("view")} color="#185FA5" />
            {kind === "section" && (
              <Seg label="Edit" active={level === "edit"} onClick={() => onSet("edit")} color="#15803D" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
function Seg({ label, active, onClick, color = "#475569" }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
      padding: "5px 9px", background: active ? color : "transparent",
      color: active ? "#fff" : "var(--text3)",
    }}>{label}</button>
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
