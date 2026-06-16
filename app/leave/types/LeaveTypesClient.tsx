"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type LeaveType = {
  id: number; name: string; daysAllowed: number;
  isPaid: boolean; color: string | null; description: string | null;
};

const empty = { name: "", daysAllowed: "0", isPaid: true, color: "#185FA5", description: "" };

export default function LeaveTypesClient({ initial }: { initial: LeaveType[] }) {
  const router = useRouter();
  const [types, setTypes] = useState<LeaveType[]>(initial);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); setErr(null); };
  const openEdit = (t: LeaveType) => {
    setEditing(t);
    setForm({ name: t.name, daysAllowed: String(t.daysAllowed), isPaid: t.isPaid, color: t.color || "#185FA5", description: t.description || "" });
    setOpen(true); setErr(null);
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const url = editing ? `/api/leave/types/${editing.id}` : "/api/leave/types";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      const data = await res.json();
      if (editing) setTypes(prev => prev.map(t => t.id === editing.id ? data : t));
      else setTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setOpen(false);
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (t: LeaveType) => {
    if (!confirm(`Delete "${t.name}"? Existing requests of this type will remain but may not display correctly.`)) return;
    const res = await fetch(`/api/leave/types/${t.id}`, { method: "DELETE" });
    if (res.ok) setTypes(prev => prev.filter(x => x.id !== t.id));
  };

  return (
    <>
      <div className="no-print" style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={openCreate} className="btn btn-primary">＋ Add Leave Type</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        {types.map(t => (
          <div key={t.id} className="card card-hover" style={{ borderLeft: `4px solid ${t.color || "#185FA5"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  <strong style={{ color: t.color || "#185FA5" }}>{t.daysAllowed}</strong> days/year ·{" "}
                  {t.isPaid ? <span style={{ color: "var(--success)" }}>Paid</span> : <span style={{ color: "#888" }}>Unpaid</span>}
                </div>
                {t.description && (
                  <div style={{ fontSize: 12, color: "#888", marginTop: 8, lineHeight: 1.5 }}>{t.description}</div>
                )}
              </div>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => openEdit(t)} className="btn" style={{ padding: "5px 12px", fontSize: 12 }}>Edit</button>
              <button onClick={() => remove(t)} className="btn btn-danger-soft" style={{ padding: "5px 12px", fontSize: 12 }}>Delete</button>
            </div>
          </div>
        ))}
        {types.length === 0 && <div className="empty">No leave types defined. Click "Add Leave Type" to create one.</div>}
      </div>

      {/* Modal */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: 460, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editing ? "Edit Leave Type" : "Add Leave Type"}</h3>
            {err && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{err}</div>}
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="form-label">Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maternity Leave" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">Days/Year</label>
                  <input type="number" value={form.daysAllowed} onChange={e => setForm({ ...form, daysAllowed: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Color</label>
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ padding: 4, height: 38 }} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.isPaid} onChange={e => setForm({ ...form, isPaid: e.target.checked })} />
                Paid leave
              </label>
              <div>
                <label className="form-label">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional explanation…" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setOpen(false)} className="btn">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="btn btn-primary">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
