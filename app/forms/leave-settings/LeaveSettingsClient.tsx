"use client";
import { useEffect, useState } from "react";

type LeaveType = {
  id: number;
  name: string;
  daysAllowed: number;
  isPaid: boolean;
  color: string | null;
  description: string | null;
};

const DEFAULT_COLORS = ["#185FA5", "#A32D2D", "#0F766E", "#D97706", "#5B21B6", "#0E7490", "#475569"];

export default function LeaveSettingsClient() {
  const [rows, setRows] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | "new" | null>(null);

  const [nName, setNName] = useState("");
  const [nDays, setNDays] = useState("0");
  const [nPaid, setNPaid] = useState(true);
  const [nColor, setNColor] = useState(DEFAULT_COLORS[0]);
  const [nDesc, setNDesc] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/leave/types");
      const d = await r.json();
      if (Array.isArray(d)) setRows(d);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function update(id: number, patch: Partial<LeaveType>) {
    setSaving(id);
    setError(null);
    const cur = rows.find(r => r.id === id);
    if (!cur) { setSaving(null); return; }
    const body = { ...cur, ...patch };
    const r = await fetch(`/api/leave/types/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(null);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Update failed"); return; }
    refresh();
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Delete leave type "${name}"? Existing leave requests using it are kept but the type can't be picked anymore.`)) return;
    const r = await fetch(`/api/leave/types/${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Delete failed"); return; }
    refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!nName.trim()) return;
    setSaving("new");
    setError(null);
    const r = await fetch("/api/leave/types", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nName.trim(),
        daysAllowed: parseInt(nDays) || 0,
        isPaid: nPaid,
        color: nColor,
        description: nDesc.trim() || null,
      }),
    });
    setSaving(null);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Create failed"); return; }
    setNName(""); setNDays("0"); setNPaid(true); setNColor(DEFAULT_COLORS[0]); setNDesc("");
    refresh();
  }

  return (
    <>
      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 12 }}>{error}</div>
      )}

      {/* === Add new leave type === */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-title">Add Custom Leave Type</div>
        <form onSubmit={create} style={{ display: "grid", gridTemplateColumns: "2fr 110px 110px 120px 2fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label className="form-label">Name *</label>
            <input required value={nName} onChange={e => setNName(e.target.value)} placeholder="e.g. Maternity Leave" />
          </div>
          <div>
            <label className="form-label">Days / year</label>
            <input type="number" min={0} value={nDays} onChange={e => setNDays(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Paid?</label>
            <select value={nPaid ? "yes" : "no"} onChange={e => setNPaid(e.target.value === "yes")}>
              <option value="yes">Paid</option>
              <option value="no">Unpaid</option>
            </select>
          </div>
          <div>
            <label className="form-label">Color</label>
            <ColorPicker value={nColor} onChange={setNColor} />
          </div>
          <div>
            <label className="form-label">Description</label>
            <input value={nDesc} onChange={e => setNDesc(e.target.value)} placeholder="Optional note" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving === "new"} style={{ height: 38 }}>
            {saving === "new" ? "Adding…" : "＋ Add"}
          </button>
        </form>
      </div>

      {/* === Existing leave types === */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
          Configured Leave Types
        </div>
        {loading ? (
          <div style={{ padding: 16, color: "var(--text2)" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, color: "var(--text2)", fontSize: 13, textAlign: "center" }}>
            No leave types yet. Add one above.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
                <Th>Name</Th>
                <Th style={{ width: 110, textAlign: "center" }}>Days / year</Th>
                <Th style={{ width: 110, textAlign: "center" }}>Paid</Th>
                <Th style={{ width: 130 }}>Color</Th>
                <Th>Description</Th>
                <Th style={{ width: 80, textAlign: "right" }}></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <Td>
                    <input defaultValue={r.name}
                      onBlur={e => e.target.value.trim() && e.target.value.trim() !== r.name && update(r.id, { name: e.target.value.trim() })}
                      style={cellInput} />
                  </Td>
                  <Td style={{ textAlign: "center" }}>
                    <input type="number" min={0} defaultValue={r.daysAllowed}
                      onBlur={e => parseInt(e.target.value) !== r.daysAllowed && update(r.id, { daysAllowed: parseInt(e.target.value) || 0 })}
                      style={{ ...cellInput, width: 70, textAlign: "center" }} />
                  </Td>
                  <Td style={{ textAlign: "center" }}>
                    <select value={r.isPaid ? "yes" : "no"}
                      onChange={e => update(r.id, { isPaid: e.target.value === "yes" })}
                      style={{ ...cellInput, width: 90 }}>
                      <option value="yes">Paid</option>
                      <option value="no">Unpaid</option>
                    </select>
                  </Td>
                  <Td>
                    <ColorPicker value={r.color || DEFAULT_COLORS[0]} onChange={c => update(r.id, { color: c })} />
                  </Td>
                  <Td>
                    <input defaultValue={r.description || ""}
                      onBlur={e => e.target.value !== (r.description || "") && update(r.id, { description: e.target.value || null })}
                      style={cellInput} placeholder="—" />
                  </Td>
                  <Td style={{ textAlign: "right" }}>
                    <button onClick={() => remove(r.id, r.name)} className="btn btn-danger-soft btn-sm">Delete</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text2)" }}>
          Changes save automatically when you tab out of a field. Saving: {saving ? <span style={{ color: "var(--brand)" }}>writing…</span> : "idle"}
        </div>
      </div>
    </>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 36, height: 28, padding: 0, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }} />
      <div style={{
        padding: "3px 10px", borderRadius: 999, background: `${value}22`, color: value,
        fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
      }}>Preview</div>
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--text2)", ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "8px 14px", verticalAlign: "middle", ...style }}>{children}</td>;
}

const cellInput: React.CSSProperties = {
  width: "100%", padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12,
};
