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
    dutiesAssignedTo: "",
    medicalCertAttached: "" as "" | "yes" | "no",
    department: "",
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

  const printBlank = () => {
    document.body.classList.add("print-blank");
    // Let the class apply, then trigger print. Cleanup after print dialog closes.
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("print-blank"), 200);
    }, 30);
  };

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
        <button onClick={printBlank} className="btn">🖨 Print Blank</button>
        <button onClick={() => window.print()} className="btn btn-print">🖨 Print Form</button>
      </div>

      <div className="card" style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2.5px solid var(--brand)", paddingBottom: 12, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" style={{ height: 100, width: "auto", maxWidth: 320, objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--brand)" }}>Leave Application Form</div>
            <div className="urdu" style={{ fontSize: 17, color: "var(--brand)", fontWeight: 600, marginTop: 4 }}>رخصت کی درخواست فارم</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {err && <div className="no-print" style={{ color: "var(--danger)", fontSize: 12, padding: "8px 12px", background: "var(--danger-bg)", borderRadius: 6 }}>{err}</div>}
          {ok && <div className="no-print" style={{ color: "var(--success)", fontSize: 12, padding: "8px 12px", background: "var(--success-bg)", borderRadius: 6 }}>✓ Leave request submitted! Redirecting…</div>}

          {/* === Employee block === */}
          <Field en="Employee Name" ur="ملازم نام">
            <select required value={form.employeeId} onChange={e => {
              const id = e.target.value;
              const emp = employees.find(x => String(x.id) === id);
              setForm({ ...form, employeeId: id, department: emp?.department || "" });
            }}>
              <option value="">— Select Employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
            </select>
          </Field>

          <Field en="Designation" ur="عہدہ">
            <input value={selectedEmp?.designation || ""} readOnly placeholder=" " />
          </Field>

          <Field en="Employee ID" ur="ملازم ای ڈی">
            <input value={selectedEmp?.employeeId || ""} readOnly placeholder=" " />
          </Field>

          <Field en="Department" ur="ڈیپارٹمنٹ یا شعبہ">
            <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder=" " />
          </Field>

          {/* === Type of Leave (with inline manager) === */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <BiLabel en="Type of Leave" ur="" />
              <button type="button"
                onClick={() => setShowAddType(v => !v)}
                className="no-print"
                style={{ background: "transparent", border: "none", color: "var(--brand)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                {showAddType ? "✕ Close" : "＋ Add custom type"}
              </button>
            </div>
            <select required value={form.leaveTypeId} onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}>
              <option value="">— Select Leave Type —</option>
              {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.daysAllowed} days · {t.isPaid ? "Paid" : "Unpaid"})</option>)}
            </select>

            {leaveTypes.length > 0 && (
              <div className="no-print" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {leaveTypes.map(t => (
                  <div key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 10px", borderRadius: 999, background: "var(--bg2)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text2)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color || "#185FA5" }} />
                    <span>{t.name}</span>
                    <button type="button" onClick={() => deleteType(t)} title={`Delete ${t.name}`}
                      style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer", padding: "0 4px", fontSize: 13, lineHeight: 1 }}>🗑</button>
                  </div>
                ))}
              </div>
            )}

            {showAddType && (
              <div className="no-print" style={{ marginTop: 10, padding: 12, border: "1px dashed var(--border-strong)", borderRadius: 8, background: "var(--bg2)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)", marginBottom: 8 }}>Add a new leave type</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end" }}>
                  <div><label className="form-label">Name *</label><input value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} placeholder="e.g. Maternity Leave" /></div>
                  <div><label className="form-label">Days/Year</label><input type="number" value={newType.daysAllowed} onChange={e => setNewType({ ...newType, daysAllowed: e.target.value })} /></div>
                  <div><label className="form-label">&nbsp;</label><button type="button" onClick={addType} disabled={addingType || !newType.name.trim()} className="btn btn-primary">{addingType ? "Adding…" : "Add"}</button></div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", marginTop: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={newType.isPaid} onChange={e => setNewType({ ...newType, isPaid: e.target.checked })} />Paid leave
                </label>
              </div>
            )}
          </div>

          {/* === Leave Duration === */}
          <BiLabel en="Leave Duration" ur="رخصت کی مدت" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: -6 }}>
            <Field en="From" ur="کب سے" compact>
              <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field en="To" ur="کب تک" compact>
              <input type="date" required value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </Field>
            <Field en="Total Days" ur="کل دنوں کی تعداد" compact>
              <div className="calc-readout" style={{ padding: "8px 11px", border: "1px solid var(--border2)", borderRadius: 7, background: "var(--bg2)", fontWeight: 700, color: "var(--brand)" }}>{days}</div>
            </Field>
          </div>

          {/* === Reason === */}
          <Field en="Reason for Leave" ur="رخصت کی وجہ">
            <textarea rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe the reason for leave…" />
          </Field>

          {/* === Sick leave medical cert === */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                If Sick Leave, is a medical certificate attached?
              </span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>اگر طبی رخصت ھو تو میڈیکل سرٹیفیکیٹ منسلک کریں۔</div>
            </div>
            <div style={{ display: "flex", gap: 22 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.medicalCertAttached === "yes"} onChange={e => setForm({ ...form, medicalCertAttached: e.target.checked ? "yes" : "" })} />
                Yes <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>ھاں</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.medicalCertAttached === "no"} onChange={e => setForm({ ...form, medicalCertAttached: e.target.checked ? "no" : "" })} />
                No <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>نہیں</span>
              </label>
            </div>
          </div>

          {/* === Duties assigned to === */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                Duties assigned to ____________ when on leave
              </span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>رخصت کی صورت میں ذمہ داریاں جن کے سپرد کی گئیں ھوں۔</div>
            </div>
            <input value={form.dutiesAssignedTo} onChange={e => setForm({ ...form, dutiesAssignedTo: e.target.value })} placeholder=" " />
          </div>

          {/* === Employee signature + date === */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
            <Field en="Employee Signature" ur="ملازم دستخط">
              <div style={{ height: 38, borderBottom: "1.5px solid #000" }} />
            </Field>
            <Field en="Date" ur="تاریخ">
              <div style={{ height: 38, borderBottom: "1.5px solid #000", display: "flex", alignItems: "flex-end", padding: "0 4px 6px", fontFamily: "monospace", color: "#555", fontSize: 14 }}>
                ____  /  ____  /  ______
              </div>
            </Field>
          </div>

          {/* === FOR OFFICE USE ONLY === */}
          <div style={{ marginTop: 24, padding: "8px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 1.2 }}>For Office Use Only</span>
            <span className="urdu" style={{ fontSize: 15, color: "var(--brand)", fontWeight: 600 }}>صرف دفتری استعمال کے لیے</span>
          </div>

          {/* Supervisor comments — blank for handwriting */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                Supervisor / Manager&apos;s Comments
              </span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>سپروائزر یا مینیجر کی رائے</div>
            </div>
            <BlankLines count={3} />
          </div>

          {/* Approval status */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>Approval Status</span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>منظوری کی حیثیت</div>
            </div>
            <div style={{ display: "flex", gap: 28 }}>
              <CheckLabel en="Approved" ur="منظور" />
              <CheckLabel en="Not Approved" ur="نا منظور" />
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>Reason (if not approved)</span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>وجہ اگر منظور نہ ھو</div>
            </div>
            <BlankLines count={2} />
          </div>

          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
            <Field en="Admin Assistant Signature" ur="">
              <div style={{ height: 38, borderBottom: "1.5px solid #000" }} />
            </Field>
            <Field en="Date" ur="تاریخ">
              <div style={{ height: 38, borderBottom: "1.5px solid #000", display: "flex", alignItems: "flex-end", padding: "0 4px 6px", fontFamily: "monospace", color: "#555", fontSize: 14 }}>
                ____  /  ____  /  ______
              </div>
            </Field>
          </div>

          {/* Final approval */}
          <div style={{ marginTop: 18, padding: "10px 12px", background: "var(--brand-soft)", border: "1px solid var(--brand)", borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Final Approval by HEAD HR &amp; ADMINISTRATION
            </div>
            <div className="urdu" style={{ fontSize: 15, color: "var(--brand)", fontWeight: 600, marginTop: 2 }}>حتمی منظوری برائے سربراہ ایچ آر</div>
          </div>

          <div style={{ marginTop: 4 }}>
            <Field en="Signature" ur="دستخط">
              <div style={{ height: 50, borderBottom: "1.5px solid #000" }} />
            </Field>
          </div>

          <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
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

/* Bilingual label: bold English on the left, Nastaliq Urdu on the right */
function BiLabel({ en, ur }: { en: string; ur: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>{en}</span>
      {ur && <span className="urdu" style={{ fontSize: 15, color: "var(--text2)" }}>{ur}</span>}
    </div>
  );
}

/* A labelled form field: bilingual label above, input below */
function Field({ en, ur, children, compact }: { en: string; ur: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div>
      <div style={{ marginBottom: compact ? 4 : 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>{en}</span>
        {ur && <span className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginLeft: 10 }}>{ur}</span>}
      </div>
      {children}
    </div>
  );
}

/* Empty dotted lines for handwriting blocks */
function BlankLines({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ borderBottom: "1px dotted #555", height: 22, marginTop: i === 0 ? 0 : 4 }} />
      ))}
    </div>
  );
}

/* Checkbox + bilingual label, blank by default for handwriting in print */
function CheckLabel({ en, ur }: { en: string; ur: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span style={{ display: "inline-block", width: 14, height: 14, border: "1.5px solid #000", borderRadius: 2 }} />
      <span style={{ fontWeight: 600 }}>{en}</span>
      <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>{ur}</span>
    </span>
  );
}
