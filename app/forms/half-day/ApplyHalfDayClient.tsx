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

  const printBlank = () => {
    document.body.classList.add("print-blank");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("print-blank"), 200);
    }, 30);
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
        <button onClick={printBlank} className="btn">🖨 Print Blank</button>
        <button onClick={() => window.print()} className="btn btn-print">🖨 Print Form</button>
      </div>

      <div className="card" style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2.5px solid var(--brand)", paddingBottom: 12, marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" style={{ height: 100, width: "auto", maxWidth: 320, objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--brand)" }}>Half Day Leave Application Form</div>
            <div className="urdu" style={{ fontSize: 17, color: "var(--brand)", fontWeight: 600, marginTop: 4 }}>آدھے دن کی رخصت کا درخواست فارم</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {err && <div className="no-print" style={{ color: "var(--danger)", fontSize: 12, padding: "8px 12px", background: "var(--danger-bg)", borderRadius: 6 }}>{err}</div>}
          {ok && <div className="no-print" style={{ color: "var(--success)", fontSize: 12, padding: "8px 12px", background: "var(--success-bg)", borderRadius: 6 }}>✓ Half-day request submitted! Redirecting…</div>}

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

          <Field en="Date" ur="تاریخ">
            <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </Field>

          {/* === MANDATORY policy notice === */}
          <div style={{
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
            <textarea rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe the reason…" />
          </Field>

          {/* === Employee signature + date === */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
            <Field en="Employee Signature" ur="ملازم کے دستخط">
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
            <span className="urdu" style={{ fontSize: 15, color: "var(--brand)", fontWeight: 600 }}>دفتری استعمال کے لیے</span>
          </div>

          {/* Supervisor comments */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>Supervisor / Manager&apos;s Comments</span>
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

          {/* Admin assistant */}
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
    <div>
      <div style={{ marginBottom: 6 }}>
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
        <div key={i} style={{ borderBottom: "1px dotted #555", height: 22, marginTop: i === 0 ? 0 : 4 }} />
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
