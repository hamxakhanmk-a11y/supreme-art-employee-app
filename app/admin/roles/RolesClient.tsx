"use client";
// The Access Register (the Tracker app's, brought over): one grid per section tab, a row for the section
// itself and one for each of its buttons, a column per role. Each box is a small sliding switch (as the
// Tracker's, 2026-11-11): click a side and the knob slides there at once, then it saves — no Save button,
// and a failed save slides it back. The Owner (Super Admin) always has everything.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePageState } from "@/lib/usePageState";

// kind (from lib/permissions moduleEditKind): "section" has View and Edit, "view" is a report (View only),
// "action" is a button (on or off). parent: for a button, the section it sits in.
interface ModuleDef { key: string; label: string; hint: string; kind: Kind; parent: string | null }
interface RolePerm { role: string; label: string; color: string; builtin: boolean; modules: string[]; editModules: string[] }

type Kind = "view" | "action" | "section";
type Level = "none" | "view" | "edit";

// Which tab a row sits under. Prefix rules first, then exact keys, so new keys slot in (any future
// purchase.* or reports.*). Order follows the top navigation.
const GROUP_ORDER = [
  "Profile", "Employees", "Attendance", "Forms & Leave", "Salary", "Purchase",
  "Station", "Procurement", "Store", "Reports",
];
function groupOf(key: string): string {
  if (key.startsWith("reports.")) return "Reports";
  if (key.startsWith("purchase")) return "Purchase";
  if (/^(demand|po|grn|suppliers)(\.|$)/.test(key)) return "Procurement";
  if (key.startsWith("station")) return "Station";
  if (key.startsWith("store")) return "Store";
  if (key.startsWith("employees")) return "Employees";
  if (key.startsWith("attendance")) return "Attendance";
  if (key.startsWith("forms") || key.startsWith("capa")) return "Forms & Leave";
  if (key.startsWith("dashboard")) return "Profile";
  if (key === "salary") return "Salary";
  return "Other";
}

const LABEL: Record<Level, string> = { edit: "EDIT", view: "VIEW", none: "HIDDEN" };
// The sides of each kind of row's switch, left to right: a section Edit | View | Hide, a page or report
// View | Hide, a button Edit | Hide.
const TOGGLE: Record<Kind, [Level, string][]> = {
  section: [["edit", "Edit"], ["view", "View"], ["none", "Hide"]],
  view: [["view", "View"], ["none", "Hide"]],
  action: [["edit", "Edit"], ["none", "Hide"]],
};
const TIP: Record<Level, string> = { edit: "Edit — open it and use it", view: "View — open it, look only", none: "Hidden — not shown at all" };
// The knob's colour: green for full access (Edit, or View on a page that is only looked at), amber for
// look-only, red for hidden.
function tone(kind: Kind, level: Level): "allow" | "partial" | "deny" {
  if (level === "none") return "deny";
  return level === "edit" || kind === "view" ? "allow" : "partial";
}

function Toggle({ kind, level, locked, onPick }: { kind: Kind; level: Level; locked?: boolean; onPick?: (l: Level) => void }) {
  const opts = TOGGLE[kind];
  const i = Math.max(0, opts.findIndex(o => o[0] === level));
  return (
    <div className={`acc-tg acc-tg-${tone(kind, opts[i][0])}${locked ? " is-locked" : ""}`}
      style={{ "--n": opts.length, "--i": i } as React.CSSProperties}>
      {opts.map(([v, label], j) => (
        <button key={v} type="button" className={j === i ? "is-on" : ""} aria-pressed={j === i} disabled={locked}
          title={kind === "view" && v === "view" ? "View — the page is shown" : TIP[v]}
          onClick={() => { if (j !== i) onPick?.(v); }}>{label}</button>
      ))}
    </div>
  );
}

export default function RolesClient() {
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [roles, setRoles] = useState<RolePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tab, setTab] = usePageState("tab", ""); // kept for when the user comes back

  // New-role form
  const [showNew, setShowNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#0F766E");
  const [creating, setCreating] = useState(false);

  // Saves go out one at a time per role, each with that role's whole list as it stands then, so quick
  // clicks can't land out of order.
  const rolesRef = useRef<RolePerm[]>([]);
  useEffect(() => { rolesRef.current = roles; }, [roles]);
  const queue = useRef<Record<string, Promise<void>>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/roles");
      if (!r.ok) { setError("Failed to load the Access Register"); setLoading(false); return; }
      const d = await r.json();
      setModules(d.modules);
      setRoles(d.roles);
    } catch {
      setError("Failed to load the Access Register");
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

  const tabs = useMemo(() => {
    const present = new Set(modules.map(m => groupOf(m.key)));
    const ordered = GROUP_ORDER.filter(g => present.has(g));
    for (const g of present) if (!ordered.includes(g)) ordered.push(g);
    return ordered;
  }, [modules]);
  const activeTab = (tabs.includes(tab) ? tab : tabs[0]) || "";
  const rows = useMemo(() => modules.filter(m => groupOf(m.key) === activeTab), [modules, activeTab]);

  // A button can only be used (EDIT) or not (HIDDEN): one that is merely "viewable" does nothing, so it reads HIDDEN.
  const kindOf = (key: string) => modules.find(m => m.key === key)?.kind;
  // A page that is only looked at (View / Hidden) never reads EDIT, even when a default's edit list holds it.
  const levelOf = (r: RolePerm, key: string): Level =>
    kindOf(key) === "view" ? (r.modules.includes(key) ? "view" : "none")
      : r.editModules.includes(key) ? "edit" : r.modules.includes(key) && kindOf(key) !== "action" ? "view" : "none";

  function withLevel(r: RolePerm, m: ModuleDef, level: Level): RolePerm {
    const mod = new Set(r.modules), ed = new Set(r.editModules);
    if (level === "none") mod.delete(m.key); else mod.add(m.key);
    if (level === "edit" && m.kind !== "view") ed.add(m.key); else ed.delete(m.key);
    return { ...r, modules: [...mod], editModules: [...ed] };
  }

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }

  // The ref is moved on at once (not after the next render), so a save queued behind this one sends it.
  function put(role: string, m: ModuleDef, level: Level) {
    rolesRef.current = rolesRef.current.map(x => (x.role === role ? withLevel(x, m, level) : x));
    setRoles(rolesRef.current);
  }

  function setLevel(r: RolePerm, m: ModuleDef, next: Level) {
    const role = r.role;
    const before = levelOf(rolesRef.current.find(x => x.role === role) ?? r, m.key);
    if (next === before) return;
    setError("");
    put(role, m, next);
    queue.current[role] = (queue.current[role] || Promise.resolve()).then(async () => {
      const cur = rolesRef.current.find(x => x.role === role);
      if (!cur) return;
      try {
        const res = await fetch("/api/roles", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, modules: cur.modules, editModules: cur.editModules }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
        flash(`${r.label}: ${m.label} → ${LABEL[next]}`);
      } catch (e) {
        // Put the box back and say so; the grid then matches what is saved.
        put(role, m, before);
        setError(`${r.label}: ${m.label} was not saved — ${e instanceof Error ? e.message : "Save failed"}`);
      }
    });
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Access Register</h1>
          <p className="acc-reg-dek">
            Who can open each section and use each of its buttons. <b>Click a side of a switch</b> to change it —
            it saves straight away. The Owner (Super Admin) always has everything.
          </p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="btn btn-restricted" style={{ whiteSpace: "nowrap" }}>
          {showNew ? "✕ Close" : "＋ New role"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={createRole} style={{
          display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap",
          background: "var(--bg)", border: "1px dashed var(--border-strong, var(--border))",
          borderRadius: 12, padding: 14, marginBottom: 14,
        }}>
          <div>
            <label className="form-label">Role name</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} maxLength={80}
              placeholder="e.g. Warehouse" style={{ minWidth: 220 }} />
          </div>
          <div>
            <label className="form-label">Colour</label>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              style={{ width: 48, height: 36, padding: 2, cursor: "pointer" }} />
          </div>
          <button type="submit" disabled={creating || !newLabel.trim()} className="btn btn-restricted">
            {creating ? "Creating…" : "Create role"}
          </button>
          <span style={{ fontSize: 11.5, color: "var(--text3)" }}>
            A new role starts with <b>everything hidden</b> — open it up below, then give it to people on the Users page.
          </span>
        </form>
      )}

      <div className="acc-reg-legend">
        <span><i className="acc-swatch acc-swatch-tg allow" /> <b>Edit</b> — open it and use it (a report: <b>View</b>)</span>
        <span><i className="acc-swatch acc-swatch-tg partial" /> <b>View</b> — open it, look only</span>
        <span><i className="acc-swatch acc-swatch-tg deny" /> <b>Hide</b> — not shown at all</span>
        <span>Buttons are <b>Edit</b> or <b>Hide</b>; reports and pages <b>View</b> or <b>Hide</b>.</span>
      </div>

      {error && <div role="alert" style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "var(--text2)", padding: 16 }}>Loading…</div>
      ) : (
        <>
          <div className="tabs" style={{ flexWrap: "wrap", marginBottom: 12 }}>
            {tabs.map(t => (
              <button key={t} className={`tab ${t === activeTab ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          <div className="acc-tablewrap">
            <table className="acc-table acc-table-tg">
              <thead>
                <tr>
                  <th>{activeTab}</th>
                  <th title="The Owner always has everything">Super Admin</th>
                  {roles.map(r => (
                    <th key={r.role} style={{ borderTop: `3px solid ${r.color || "var(--brand)"}` }}>
                      {r.label}
                      {!r.builtin && (
                        <button className="acc-del" title={`Delete the ${r.label} role`} onClick={() => deleteRole(r.role, r.label)}>✕</button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(m => {
                  const parent = m.parent ? modules.find(p => p.key === m.parent) : null;
                  return (
                    <tr key={m.key} className={m.kind === "action" ? "acc-btn-row" : "acc-sec-row"}>
                      <th className="acc-rowlabel">
                        {m.kind === "action" && <span className="acc-tag">Button</span>}
                        {m.kind === "view" && <span className="acc-tag">Report</span>}
                        {m.label}
                        <span className="acc-rowlabel-sub">{m.hint}</span>
                      </th>
                      <td className="acc-cell acc-cell-tg" title="Super Admin always has this">
                        <Toggle kind={m.kind} level={m.kind === "view" ? "view" : "edit"} locked />
                      </td>
                      {roles.map(r => {
                        const lvl = levelOf(r, m.key);
                        // A button whose section the role can't open does nothing yet: said, not hidden.
                        const idle = !!parent && lvl !== "none" && levelOf(r, parent.key) === "none";
                        return (
                          <td key={r.role} className={`acc-cell acc-cell-tg${idle ? " idle" : ""}`}
                            title={idle ? `No effect until ${r.label} can open ${parent!.label}` : undefined}>
                            <Toggle kind={m.kind} level={lvl} onPick={l => setLevel(r, m, l)} />
                            {idle && <span className="acc-idle-mark">! no effect</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="acc-foot">
            A change reaches people the next time their page loads (or when they come back to the tab).
            The server checks every button too, so a hidden button can&rsquo;t be used another way.
          </p>
        </>
      )}

      {toast && <div className="acc-toast" role="status">{toast}</div>}
    </div>
  );
}
