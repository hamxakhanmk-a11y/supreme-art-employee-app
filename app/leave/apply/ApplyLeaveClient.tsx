"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string; designation: string | null; department: string | null };
type LT = { id: number; name: string; daysAllowed: number; isPaid: boolean; color: string | null };

export default function ApplyLeaveClient({ employees, leaveTypes }: { employees: Emp[]; leaveTypes: LT[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    employeeId: "", leaveTypeId: "",
    startDate: today, endDate: today,
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const days = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const s = new Date(form.startDate), e = new Date(form.endDate);
    return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [form.startDate, form.endDate]);

  const selectedEmp = employees.find(e => String(e.id) === form.employeeId);
  const selectedType = leaveTypes.find(t => String(t.id) === form.leaveTypeId);

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

  return (
    <>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "flex-end" }}>
        <button onClick={() => window.print()} className="btn btn-print">🖨 Print Form</button>
      </div>

      <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Printable header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2.5px solid var(--primary)", paddingBottom: 12, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" style={{ height: 48 }} />
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

          <div>
            <label className="form-label">Type of Leave *</label>
            <select required value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}>
              <option value="">— Select Leave Type —</option>
              {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.daysAllowed} days · {t.isPaid ? "Paid" : "Unpaid"})</option>)}
            </select>
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

          {/* Signature lines (visible for print) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 28 }}>
            <div>
              <div style={{ borderTop: "1px solid #000", paddingTop: 6, fontSize: 11, textAlign: "center", color: "#555" }}>
                Employee Signature & Date
              </div>
            </div>
            <div>
              <div style={{ borderTop: "1px solid #000", paddingTop: 6, fontSize: 11, textAlign: "center", color: "#555" }}>
                Approving Manager Signature & Date
              </div>
            </div>
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
