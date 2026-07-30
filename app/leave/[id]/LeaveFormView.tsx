"use client";
import Link from "next/link";

type Req = {
  id: number; startDate: string; endDate: string; days: number;
  halfSegment: string | null; reason: string | null;
  dutiesAssignedTo: string | null; medicalCertAttached: string | null;
  status: string; decidedBy: string | null; decisionNote: string | null;
};
type Emp = {
  id: number; employeeId: string; firstName: string; lastName: string;
  designation: string | null; department: string | null;
};
type LT = { id: number; name: string };

const fmtDate = (d: string | null) => d
  ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

export default function LeaveFormView({ req, emp, leaveType }: { req: Req; emp: Emp; leaveType: LT }) {
  const doPrint = () => {
    document.body.classList.add("print-scaled");
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-scaled");
    }, { once: true });
    setTimeout(() => window.print(), 30);
  };

  const isApproved = req.status === "approved";
  const isRejected = req.status === "rejected";

  return (
    <>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/reports/leaves" className="btn">← Back to Leave History</Link>
        <button onClick={doPrint} className="btn btn-print">🖨 Print</button>
      </div>

      <div className="card leave-form-wrap print-page-bg" style={{ maxWidth: 780, margin: "0 auto", position: "relative" }}>
        <div className="lf-letterhead" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid var(--brand)", paddingBottom: 12, marginBottom: 14, gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" style={{ height: 120, width: "auto", maxWidth: 380, objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div className="lf-title" style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--brand)", lineHeight: 1.1 }}>Leave Application Form</div>
            <div className="urdu lf-title-ur" style={{ fontSize: 22, color: "var(--brand)", fontWeight: 600, marginTop: 4, marginBottom: 8 }}>رخصت کی درخواست فارم</div>
            <div style={{ display: "inline-flex", gap: 14, padding: "5px 10px", border: "1.5px solid var(--brand)", borderRadius: 6, background: "var(--brand-soft)", marginTop: 2 }}>
              <CheckLabel en="Approved" ur="منظور" checked={isApproved} />
              <CheckLabel en="Not Approved" ur="نا منظور" checked={isRejected} />
            </div>
          </div>
        </div>

        <div className="leave-form" style={{ display: "grid", gap: 14 }}>
          <div className="lf-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field en="Employee Name" ur="ملازم نام">
              <ReadValue value={`${emp.firstName} ${emp.lastName}`} />
            </Field>
            <Field en="Employee ID" ur="ملازم ای ڈی">
              <ReadValue value={emp.employeeId} />
            </Field>
          </div>
          <div className="lf-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field en="Designation" ur="عہدہ">
              <ReadValue value={emp.designation || ""} />
            </Field>
            <Field en="Department" ur="ڈیپارٹمنٹ یا شعبہ">
              <ReadValue value={emp.department || ""} />
            </Field>
          </div>

          <div className="lf-4col" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr", gap: 12 }}>
            <Field en="Type of Leave" ur="رخصت کی قسم" compact>
              <ReadValue value={leaveType.name} />
            </Field>
            <Field en="From" ur="کب سے" compact>
              <ReadValue value={fmtDate(req.startDate)} />
            </Field>
            <Field en="To" ur="کب تک" compact>
              <ReadValue value={fmtDate(req.endDate)} />
            </Field>
            <Field en="Total Days" ur="کل دن" compact>
              <div className="calc-readout" style={{ padding: "8px 11px", border: "1px solid var(--border2)", borderRadius: 7, background: "var(--bg2)", fontWeight: 700, color: "var(--brand)", textAlign: "center" }}>
                {req.halfSegment ? "0.5" : req.days}
              </div>
            </Field>
          </div>

          {req.halfSegment && (
            <Field en="Which half of the day?" ur="دن کا کونسا حصہ؟">
              <div style={{ display: "flex", gap: 22 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <span style={boxStyle(req.halfSegment === "first")} />
                  First half <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>پہلا حصہ</span>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>(morning)</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <span style={boxStyle(req.halfSegment === "second")} />
                  Second half <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>دوسرا حصہ</span>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>(afternoon)</span>
                </label>
              </div>
            </Field>
          )}

          <Field en="Reason for Leave" ur="رخصت کی وجہ">
            <div className="lf-reason" style={{ padding: "10px 12px", border: "1px solid var(--border2)", borderRadius: 7, background: "var(--bg2)", minHeight: 80, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5 }}>
              {req.reason || "—"}
            </div>
          </Field>

          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                If Sick Leave, is a medical certificate attached?
              </span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>اگر طبی رخصت ھو تو میڈیکل سرٹیفیکیٹ منسلک کریں۔</div>
            </div>
            <div style={{ display: "flex", gap: 22 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span style={boxStyle(req.medicalCertAttached === "yes")} />
                Yes <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>ھاں</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span style={boxStyle(req.medicalCertAttached === "no")} />
                No <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>نہیں</span>
              </label>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                Duties assigned to ____________ when on leave
              </span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>رخصت کی صورت میں ذمہ داریاں جن کے سپرد کی گئیں ھوں۔</div>
            </div>
            <ReadValue value={req.dutiesAssignedTo || ""} />
          </div>

          <div className="lf-office-banner" style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 1.2 }}>For Office Use Only</span>
            <span className="urdu" style={{ fontSize: 15, color: "var(--brand)", fontWeight: 600 }}>صرف دفتری استعمال کے لیے</span>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                Supervisor / Manager&apos;s Comments
              </span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>سپروائزر یا مینیجر کی رائے</div>
            </div>
            {req.decisionNote
              ? <div style={{ padding: "8px 10px", border: "1px solid var(--border2)", borderRadius: 6, background: "var(--bg2)", whiteSpace: "pre-wrap", fontSize: 13, minHeight: 60 }}>{req.decisionNote}</div>
              : <BlankLines count={4} />
            }
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.4 }}>Reason (if not approved)</span>
              <div className="urdu" style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>وجہ اگر منظور نہ ھو</div>
            </div>
            <BlankLines count={3} />
          </div>

          <div className="lf-sign-row" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.85fr", gap: 16 }}>
            <Field en="Employee Sig." ur="ملازم دستخط" compact>
              <SignLine text={`${emp.firstName} ${emp.lastName}`} />
            </Field>
            <Field en="Admin Asst. Sig." ur="" compact>
              <SignLine />
            </Field>
            <Field en="HR Head Sig." ur="ایچ آر دستخط" compact>
              <SignLine text={req.decidedBy || ""} />
            </Field>
            <Field en="Date" ur="تاریخ" compact>
              <SignLine text={fmtDate(req.startDate)} />
            </Field>
          </div>
        </div>
      </div>
    </>
  );
}

function ReadValue({ value }: { value: string }) {
  return (
    <div style={{
      padding: "8px 11px", border: "1px solid var(--border2)", borderRadius: 7,
      background: "var(--bg2)", minHeight: 36, fontSize: 13, display: "flex", alignItems: "center",
    }}>{value || "—"}</div>
  );
}

function SignLine({ text }: { text?: string }) {
  return (
    <div style={{ height: 36, borderBottom: "1.5px solid #000", display: "flex", alignItems: "flex-end", padding: "0 4px 4px", fontSize: 13, color: "#333" }}>
      {text || ""}
    </div>
  );
}

function Field({ en, ur, children, compact }: { en: string; ur: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className="lf-field">
      <div className="lf-field-label" style={{ marginBottom: compact ? 4 : 6 }}>
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

function CheckLabel({ en, ur, checked }: { en: string; ur: string; checked: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <span style={boxStyle(checked)} />
      <span style={{ fontWeight: 600 }}>{en}</span>
      <span className="urdu" style={{ fontSize: 14, color: "var(--text2)" }}>{ur}</span>
    </span>
  );
}

function boxStyle(checked: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 14, height: 14, border: "1.5px solid #000", borderRadius: 2,
    background: checked ? "#000" : "transparent",
    color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1,
  };
}
