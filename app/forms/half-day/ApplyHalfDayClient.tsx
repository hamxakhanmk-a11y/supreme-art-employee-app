"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string; designation: string | null; department: string | null };

export default function ApplyHalfDayClient({ employees, halfDayTypeId }: { employees: Emp[]; halfDayTypeId: number | null }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    employeeId: "",
    date: today,
    reason: "",
    department: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const selectedEmp = employees.find(e => String(e.id) === form.employeeId);

  const scaledPrint = (blank = false) => {
    if (blank) document.body.classList.add("print-blank");
    document.body.classList.add("print-scaled");
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-scaled");
      document.body.classList.remove("print-blank");
    }, { once: true });
    setTimeout(() => window.print(), 30);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!halfDayTypeId) { setErr("Half Day leave type not configured. Please run the setup script."); return; }
    setSaving(true); setErr(null); setOk(false);
    try {
      const res = await fetch("/api/leave/requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          leaveTypeId: String(halfDayTypeId),
          startDate: form.date,
          endDate: form.date,
          reason: form.reason,
          halfSegment: "second", // policy: approved half-day = after 1 PM = afternoon
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Failed"); }
      setOk(true);
      setTimeout(() => router.push("/forms"), 800);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "flex-end" }}>
        <button onClick={() => scaledPrint(true)} className="btn">🖨 Print Blank</button>
        <button onClick={() => scaledPrint()} className="btn btn-print">🖨 Print Form</button>
      </div>

      <div className="card leave-form-wrap print-page-bg" style={{ maxWidth: 780, margin: "0 auto", position: "relative" }}>
        {/* Letterhead — logo + title + approval checkboxes (top-right office stamp) */}
        <div className="lf-letterhead" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid var(--brand)", paddingBottom: 12, marginBottom: 14, gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" style={{ height: 120, width: "auto", maxWidth: 380, objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div className="lf-title" style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--brand)", lineHeight: 1.1 }}>Half Day Leave Application Form</div>
            <div className="urdu lf-title-ur" style={{ fontSize: 22, color: "var(--brand)", fontWeight: 600, marginTop: 4, marginBottom: 8 }}>آدھے دن کی رخصت کا درخواست فارم</div>
            <div style={{ display: "inline-flex", gap: 14, padding: "5px 10px", border: "1.5px solid var(--brand)", borderRadius: 6, background: "var(--brand-soft)", marginTop: 2 }}>
              <CheckLabel en="Approved" ur="منظور" />
              <CheckLabel en="Not Approved" ur="نا منظور" />
            </div>
          </div>
        </div>

        <form className="leave-form" onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {err && <div className="no-print" style={{ color: "var(--danger)", fontSize: 12, padding: "8px 12px", background: "var(--danger-bg)", borderRadius: 6 }}>{err}</div>}
          {ok && <div className="no-print" style={{ color: "var(--success)", fontSize: 12, padding: "8px 12px", background: "var(--success-bg)", borderRadius: 6 }}>✓ Half-day request submitted! Redirecting…</div>}

          {/* === Employee block === two-column */}
          <div className="lf-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
            <Field en="Employee ID" ur="ملازم ای ڈی">
              <input value={selectedEmp?.employeeId || ""} readOnly placeholder=" " />
            </Field>
          </div>
          <div className="lf-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field en="Designation" ur="عہدہ">
              <input value={selectedEmp?.designation || ""} readOnly placeholder=" " />
            </Field>
            <Field en="Department" ur="ڈیپارٹمنٹ یا شعبہ">
              <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder=" " />
            </Field>
          </div>
          <Field en="Date" ur="تاریخ">
            <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </Field>

          {/* === MANDATORY policy notice === */}
          <div className="lf-policy-box" style={{
            border: "2px solid var(--brand)",
            background: "var(--brand-soft)",
            borderRadius: 8,
            padding: "12px 14px",
            marginTop: 2,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              ( Mandatory ) <span className="urdu" style={{ fontSize: 14, marginLeft: 6 }}>ضروری</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-dark)" }}>
              HALF DAY LEAVE IF APPROVED WILL BE ONLY AFTER 1:00 PM.
            </div>
            <div className="urdu" style={{ fontSize: 15, color: "var(--brand-dark)", fontWeight: 600, marginTop: 6, lineHeight: 1.6 }}>
              آدھے دن کی رخصت، اگر منظور ہو، تو صرف دوپہر 1:00 بجے کے بعد ہی ہوگی۔
            </div>
          </div>

          {/* === Reason === */}
          <Field en="Reason for Half Day Leave" ur="آدھی چھٹی کی وجہ">
            <textarea className="lf-reason" rows={5} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe the reason…" />
          </Field>

          {/* === FOR OFFICE USE ONLY === */}
          <div className="lf-office-banner" style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 1.2 }}>For Office Use Only</span>
            <span className="urdu" style={{ fontSize: 15, color: "var(--brand)", fontWeight: 600 }}>دفتری استعمال کے لیے</span>
          </div>

          {/* Supervisor comments */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>Supervisor / Manager&apos;s Comments</span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>سپروائزر یا مینیجر کی رائے</div>
            </div>
            <BlankLines count={4} />
          </div>

          {/* Final approval banner */}
          <div className="lf-final-banner" style={{ marginTop: 6, padding: "8px 12px", background: "var(--brand-soft)", border: "1px solid var(--brand)", borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Final Approval by HEAD HR &amp; ADMINISTRATION
            </div>
            <div className="urdu" style={{ fontSize: 15, color: "var(--brand)", fontWeight: 600, marginTop: 2 }}>حتمی منظوری برائے سربراہ ایچ آر</div>
          </div>

          {/* === All signatures on ONE row === */}
          <div className="lf-sign-row" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.85fr", gap: 16 }}>
            <Field en="Employee Sig." ur="ملازم دستخط">
              <div style={{ height: 36, borderBottom: "1.5px solid #000" }} />
            </Field>
            <Field en="Admin Asst. Sig." ur="">
              <div style={{ height: 36, borderBottom: "1.5px solid #000" }} />
            </Field>
            <Field en="HR Head Sig." ur="ایچ آر دستخط">
              <div style={{ height: 36, borderBottom: "1.5px solid #000" }} />
            </Field>
            <Field en="Date" ur="تاریخ">
              <div style={{ height: 36, borderBottom: "1.5px solid #000", display: "flex", alignItems: "flex-end", padding: "0 4px 6px", fontFamily: "monospace", color: "#555", fontSize: 13 }}>
                __ / __ / ____
              </div>
            </Field>
          </div>

          <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={() => router.push("/forms")} className="btn">Cancel</button>
            <button type="submit" disabled={saving || !form.employeeId || !form.date} className="btn btn-primary">
              {saving ? "Submitting…" : "Submit Half-Day Request"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ en, ur, children }: { en: string; ur: string; children: React.ReactNode }) {
  return (
    <div className="lf-field">
      <div className="lf-field-label" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>{en}</span>
        {ur && <span className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginLeft: 10 }}>{ur}</span>}
      </div>
      {children}
    </div>
  );
}

function BlankLines({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lf-blank-line" style={{ borderBottom: "1px dotted #555", height: 22, marginTop: i === 0 ? 0 : 4 }} />
      ))}
    </div>
  );
}

function CheckLabel({ en, ur }: { en: string; ur: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span style={{ display: "inline-block", width: 14, height: 14, border: "1.5px solid #000", borderRadius: 2 }} />
      <span style={{ fontWeight: 600 }}>{en}</span>
      <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>{ur}</span>
    </span>
  );
}
