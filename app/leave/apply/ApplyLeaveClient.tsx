"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string; designation: string | null; department: string | null };
type LT = { id: number; name: string; daysAllowed: number; isPaid: boolean; color: string | null };

export default function ApplyLeaveClient({ employees, leaveTypes: initialTypes }: { employees: Emp[]; leaveTypes: LT[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [leaveTypes, setLeaveTypes] = useState<LT[]>(initialTypes);
  const [form, setForm] = useState({
    employeeId: "", leaveTypeId: "",
    startDate: today, endDate: today,
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Inline "add new type" UI state
  const [showAddType, setShowAddType] = useState(false);
  const [newType, setNewType] = useState({ name: "", daysAllowed: "0", isPaid: true });
  const [addingType, setAddingType] = useState(false);

  const days = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const s = new Date(form.startDate), e = new Date(form.endDate);
    return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [form.startDate, form.endDate]);

  const selectedEmp = employees.find(e => String(e.id) === form.employeeId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null); setOk(false);
    try {
      const res = await fetch("/api/leave/requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Failed"); }
      setOk(true);
      setTimeout(() => router.push("/leave"), 800);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const addType = async () => {
    if (!newType.name.trim()) return;
    setAddingType(true); setErr(null);
    try {
      const res = await fetch("/api/leave/types", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newType),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Failed"); }
      const data = await res.json();
      setLeaveTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewType({ name: "", daysAllowed: "0", isPaid: true });
      setShowAddType(false);
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setAddingType(false); }
  };

  const deleteType = async (t: LT) => {
    if (!confirm(`Delete "${t.name}"? Existing requests of this type will keep their reference but may not display correctly.`)) return;
    const res = await fetch(`/api/leave/types/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      setLeaveTypes(prev => prev.filter(x => x.id !== t.id));
      if (form.leaveTypeId === String(t.id)) setForm(f => ({ ...f, leaveTypeId: "" }));
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Cannot delete (it may be referenced by existing requests).");
    }
  };

  return (
    <>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "flex-end" }}>
        <button onClick={() => window.print()} className="btn btn-print">🖨 Print Form</button>
      </div>

      <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2.5px solid var(--primary)", paddingBottom: 12, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" style={{ height: 110, width: "auto", maxWidth: 320, objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--primary)" }}>Leave Application Form</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
              Date: <strong>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>
            </div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {err && <div style={{ color: "var(--danger)", fontSize: 12, padding: "8px 12px", background: "var(--danger-bg)", borderRadius: 6 }}>{err}</div>}
          {ok && <div style={{ color: "var(--success)", fontSize: 12, padding: "8px 12px", background: "var(--success-bg)", borderRadius: 6 }}>✓ Leave request submitted! Redirecting…</div>}

          {/* Employee */}
          <div>
            <label className="form-label">Employee *</label>
            <select required value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">— Select Employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId}) — {e.designation || "—"}</option>)}
            </select>
          </div>

          {selectedEmp && (
            <div style={{ background: "#fafaf6", padding: 12, borderRadius: 8, fontSize: 12, color: "#555" }}>
              <strong>{selectedEmp.firstName} {selectedEmp.lastName}</strong> · {selectedEmp.designation || "—"} · {selectedEmp.department || "—"}
            </div>
          )}

          {/* Leave type — dropdown with inline management */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label className="form-label">Type of Leave *</label>
              <button type="button"
                onClick={() => setShowAddType(v => !v)}
                className="no-print"
                style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "0 0 5px" }}>
                {showAddType ? "✕ Close" : "＋ Add custom type"}
              </button>
            </div>
            <select required value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}>
              <option value="">— Select Leave Type —</option>
              {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.daysAllowed} days · {t.isPaid ? "Paid" : "Unpaid"})</option>)}
            </select>

            {/* Existing types with delete buttons */}
            {leaveTypes.length > 0 && (
              <div className="no-print" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {leaveTypes.map(t => (
                  <div key={t.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 8px 4px 10px", borderRadius: 999,
                      background: "#fafaf6", border: "1px solid var(--border)",
                      fontSize: 11, color: "#555",
                    }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color || "#185FA5" }} />
                    <span>{t.name}</span>
                    <button type="button" onClick={() => deleteType(t)}
                      title={`Delete ${t.name}`}
                      style={{
                        background: "transparent", border: "none", color: "#aaa", cursor: "pointer",
                        padding: "0 4px", fontSize: 13, lineHeight: 1, transition: "color 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#aaa")}>
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline add-new-type form */}
            {showAddType && (
              <div className="no-print" style={{ marginTop: 10, padding: 12, border: "1px dashed var(--border-strong)", borderRadius: 8, background: "#fafafa" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>Add a new leave type</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end" }}>
                  <div>
                    <label className="form-label">Name *</label>
                    <input value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} placeholder="e.g. Maternity Leave" />
                  </div>
                  <div>
                    <label className="form-label">Days/Year</label>
                    <input type="number" value={newType.daysAllowed} onChange={e => setNewType({ ...newType, daysAllowed: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">&nbsp;</label>
                    <button type="button" onClick={addType} disabled={addingType || !newType.name.trim()} className="btn btn-primary">
                      {addingType ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555", marginTop: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={newType.isPaid} onChange={e => setNewType({ ...newType, isPaid: e.target.checked })} />
                  Paid leave
                </label>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label className="form-label">From *</label>
              <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="form-label">To *</label>
              <input type="date" required value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Total Days</label>
              <div style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "#fafafa", fontWeight: 700, color: "var(--primary)" }}>
                {days}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Reason</label>
            <textarea rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe the reason for leave…" />
          </div>

          {/* Declaration */}
          <div style={{ marginTop: 24, fontSize: 10.5, lineHeight: 1.55, color: "#333", borderTop: "1px solid #999", paddingTop: 10 }}>
            <strong>Declaration:</strong> I confirm that the information provided above is accurate and I undertake to resume duty
            on the date specified. Approval of this leave is subject to my work being adequately handed over and to the approval
            of my reporting manager and the HR department.
          </div>

          {/* 3-block official signature panel — tall sign-here boxes + Name / Sign / Date lines */}
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
            <SignBlock title="Employee" />
            <SignBlock title="Approving Manager" />
            <SignBlock title="HR / Authorized" />
          </div>

          <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button type="button" onClick={() => router.push("/leave")} className="btn">Cancel</button>
            <button type="submit" disabled={saving || !form.employeeId || !form.leaveTypeId || days <= 0} className="btn btn-primary">
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function SignBlock({ title }: { title: string }) {
  return (
    <div style={{ border: "1px solid #999", borderRadius: 6, padding: "10px 12px 12px", background: "#fff" }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#A32D2D", marginBottom: 8 }}>
        {title}
      </div>
      {/* Tall blank space for the actual pen signature */}
      <div style={{ height: 70, borderBottom: "1.5px solid #000", marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <SignLine label="Name" />
        <SignLine label="Designation" />
        <SignLine label="Signature" />
        <SignLine label="Date" />
      </div>
    </div>
  );
}

function SignLine({ label }: { label: string }) {
  return (
    <div>
      <div style={{ borderBottom: "1px solid #555", height: 18 }} />
      <div style={{ fontSize: 8.5, color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}
