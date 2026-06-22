"use client";
import { useState, useEffect } from "react";

type Edu = { id: number; degree: string; institution: string | null; yearCompleted: string | null; grade: string | null; certificateUrl: string | null; };
type Exp = { id: number; company: string; position: string | null; fromDate: string | null; toDate: string | null; description: string | null; };
type OtherDoc = { id: number; label: string; url: string; category?: string | null; formDate?: string | null };

export default function EmployeeProfileTabs({
  employee, education, experience, otherDocuments = [],
}: { employee: any; education: Edu[]; experience: Exp[]; otherDocuments?: OtherDoc[]; }) {
  const [tab, setTab] = useState<"personal" | "job" | "contact" | "documents" | "education" | "experience" | "banking" | "salary" | "salaryHistory">("personal");

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "personal", label: "Personal" },
    { key: "contact", label: "Contact" },
    { key: "job", label: "Job" },
    { key: "salary", label: "Salary" },
    { key: "salaryHistory", label: "Salary History" },
    { key: "banking", label: "Banking" },
    { key: "documents", label: "Documents" },
    { key: "education", label: "Education" },
    { key: "experience", label: "Experience" },
  ];

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: "flex", gap: 6, padding: "12px 14px", overflowX: "auto", background: "var(--bg2)", borderBottom: "1px solid var(--border)", borderTopLeftRadius: "var(--radius)", borderTopRightRadius: "var(--radius)" }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 16px",
                border: `1px solid ${active ? "#185FA5" : "transparent"}`,
                background: active ? "#185FA5" : "transparent",
                color: active ? "#fff" : "var(--text2)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.3,
                borderRadius: 999,
                whiteSpace: "nowrap",
                boxShadow: active ? "0 2px 6px rgba(24,95,165,0.30)" : "none",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "1.25rem" }}>
        {tab === "personal" && <Grid items={[
          ["First Name", employee.firstName],
          ["Last Name", employee.lastName],
          ["Father's Name", employee.fatherName],
          ["Date of Birth", fmtDate(employee.dob)],
          ["Gender", employee.gender],
          ["Marital Status", employee.maritalStatus],
          ["Nationality", employee.nationality],
          ["Religion", employee.religion],
          ["Blood Group", employee.bloodGroup],
          ["CNIC", employee.cnic],
          ["CNIC Expiry", fmtDate(employee.cnicExpiry)],
          ["Passport No", employee.passportNumber],
          ["Passport Expiry", fmtDate(employee.passportExpiry)],
          ["EOBI No", employee.ssiNumber],
          ["ESSI No", employee.ubiNumber],
        ]} />}

        {tab === "contact" && <Grid items={[
          ["Phone", employee.phone],
          ["Alternate Phone", employee.altPhone],
          ["Email", employee.email],
          ["City", employee.city],
          ["Current Address", employee.currentAddress, true],
          ["Permanent Address", employee.permanentAddress, true],
          ["Emergency Contact Name", employee.emergencyName],
          ["Emergency Relationship", employee.emergencyRelation],
          ["Emergency Phone", employee.emergencyPhone],
        ]} />}

        {tab === "job" && <Grid items={[
          ["Employee ID", employee.employeeId],
          ["Designation", employee.designation],
          ["Department", employee.department],
          ["Joining Date", fmtDate(employee.joiningDate)],
          ["Employment Type", employee.employmentType],
          ["Reporting Manager", employee.reportingManager],
          ["Work Location", employee.workLocation],
          ["Shift", employee.shift],
          ["Status", employee.status],
        ]} />}

        {tab === "salary" && (() => {
          const basic = Number(employee.basicSalary || 0);
          const conv = Number(employee.conveyance || 0);
          const hr = Math.round(basic * (Number(employee.houseRentPercent || 0) / 100));
          const med = Math.round(basic * (Number(employee.medicalPercent || 0) / 100));
          const fmtPKR = (n: number) => n ? `PKR ${n.toLocaleString()}` : "—";
          return <Grid items={[
            ["Basic Salary", fmtPKR(basic)],
            ["Conveyance", fmtPKR(conv)],
            [`House Rent (${employee.houseRentPercent || 0}%)`, fmtPKR(hr)],
            [`Medical (${employee.medicalPercent || 0}%)`, fmtPKR(med)],
            ["Income Tax %", `${employee.incomeTaxPercent || 0}%`],
            ["EOBI Employee %", `${employee.eobiEmployeePercent || 0}%`],
            ["EOBI Employer %", `${employee.eobiEmployerPercent || 0}%`],
          ]} />;
        })()}

        {tab === "banking" && <Grid items={[
          ["Bank Name", employee.bankName],
          ["Account Title", employee.accountTitle],
          ["Account Number", employee.accountNumber],
          ["IBAN", employee.iban],
        ]} />}

        {tab === "documents" && (() => {
          const filed = otherDocuments.filter(d => d.category === "leave-form" || d.category === "half-day-form");
          const misc = otherDocuments.filter(d => !d.category || d.category === "misc");
          return (
            <>
              <DocSectionHeader>Identity Documents</DocSectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                <DocCard label="Profile Photo" url={employee.photoUrl} />
                <DocCard label="CNIC (Front)" url={employee.cnicFrontUrl} />
                <DocCard label="CNIC (Back)" url={employee.cnicBackUrl} />
                <DocCard label="Passport" url={employee.passportUrl} />
                <DocCard label="EOBI" url={employee.ssiUrl} />
                <DocCard label="ESSI" url={employee.ubiUrl} />
              </div>

              <DocSectionHeader action={<a href={`/forms/file`} className="btn btn-sm btn-primary">📎 File Form</a>}>
                Filed Forms {filed.length > 0 && <span style={{ color: "var(--text3)", fontWeight: 500 }}>({filed.length})</span>}
              </DocSectionHeader>
              {filed.length === 0 ? (
                <div className="empty" style={{ padding: "1.5rem" }}>No signed forms filed yet. Click <strong>📎 File Form</strong> to upload one.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                  {filed.map(d => (
                    <DocCard key={d.id} label={d.label} url={d.url}
                      caption={d.category === "leave-form" ? "Leave Form" : d.category === "half-day-form" ? "Half-Day Form" : "Form"} />
                  ))}
                </div>
              )}

              <DocSectionHeader>
                Other Documents {misc.length > 0 && <span style={{ color: "var(--text3)", fontWeight: 500 }}>({misc.length})</span>}
              </DocSectionHeader>
              {misc.length === 0 ? (
                <div className="empty" style={{ padding: "1.5rem" }}>No additional documents uploaded.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                  {misc.map(d => <DocCard key={d.id} label={d.label} url={d.url} />)}
                </div>
              )}
            </>
          );
        })()}

        {tab === "education" && (
          education.length === 0 ? <div className="empty">No education records.</div> :
          <table>
            <thead><tr><th>Degree</th><th>Institution</th><th>Year</th><th>Grade</th><th>Certificate</th></tr></thead>
            <tbody>
              {education.map(e => (
                <tr key={e.id}>
                  <td>{e.degree}</td>
                  <td>{e.institution || "—"}</td>
                  <td>{e.yearCompleted || "—"}</td>
                  <td>{e.grade || "—"}</td>
                  <td>{e.certificateUrl ? <a href={e.certificateUrl} target="_blank" style={{ color: "var(--primary)" }}>View</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "experience" && (
          experience.length === 0 ? <div className="empty">No experience records.</div> :
          <table>
            <thead><tr><th>Company</th><th>Position</th><th>From</th><th>To</th><th>Description</th></tr></thead>
            <tbody>
              {experience.map(e => (
                <tr key={e.id}>
                  <td>{e.company}</td>
                  <td>{e.position || "—"}</td>
                  <td>{fmtDate(e.fromDate)}</td>
                  <td>{fmtDate(e.toDate)}</td>
                  <td>{e.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "salaryHistory" && <SalaryHistory employeeDbId={employee.id} basicSalary={employee.basicSalary} />}
      </div>
    </div>
  );
}

function Grid({ items }: { items: ([string, any] | [string, any, boolean])[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
      {items.map(([label, value, wide], i) => (
        <div key={i} style={{ gridColumn: wide ? "1/-1" : "auto" }}>
          <div className="form-label">{label}</div>
          <div style={{ fontSize: 14, color: value ? "#1a1a1a" : "#bbb", fontWeight: value ? 500 : 400 }}>
            {value || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocSectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: 22, marginBottom: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.6 }}>{children}</div>
      {action}
    </div>
  );
}

function DocCard({ label, url, caption }: { label: string; url: string | null; caption?: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "#fafafa" }}>
      {caption && <div style={{ fontSize: 9, fontWeight: 800, color: "#185FA5", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{caption}</div>}
      <div className="form-label" style={{ marginBottom: 8 }}>{label}</div>
      {url ? (
        /\.(png|jpe?g|gif|webp)$/i.test(url) ? (
          <a href={url} target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
          </a>
        ) : (
          <a href={url} target="_blank" className="btn">📄 Open File</a>
        )
      ) : (
        <div style={{ color: "#bbb", fontSize: 12 }}>Not uploaded</div>
      )}
    </div>
  );
}

function fmtDate(d: any): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(d); }
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - 2 + i);
const fmt = (n: number) => Number(n).toLocaleString("en-PK");

type SalaryRecord = {
  id: number; month: string; year: number;
  basicSalary: number; conveyance: number; overtime: number;
  daysPresent: number; daysAbsent: number; daysLeave: number; weekOffs: number;
  otherDeduction: number; notes: string | null;
};

const houseRent    = (b: number) => Math.round(b * 0.40);
const medicalAllow = (b: number) => Math.round(b * 0.10);
const gross        = (r: SalaryRecord) => r.basicSalary + houseRent(r.basicSalary) + medicalAllow(r.basicSalary) + r.conveyance + r.overtime;
const incomeTax    = (b: number) => Math.round(b * 0.05);
const eobiEmp      = (b: number) => Math.round(b * 0.01);
const eobiEmpr     = (b: number) => Math.round(b * 0.02);
const absentDed    = (r: SalaryRecord) => {
  const wd = r.daysPresent + r.daysAbsent + r.daysLeave;
  return wd === 0 || r.daysAbsent === 0 ? 0 : Math.round((gross(r) / wd) * r.daysAbsent);
};
const totalDed     = (r: SalaryRecord) => incomeTax(r.basicSalary) + eobiEmp(r.basicSalary) + eobiEmpr(r.basicSalary) + absentDed(r) + r.otherDeduction;
const netPay       = (r: SalaryRecord) => gross(r) - totalDed(r);

function SalaryHistory({ employeeDbId, basicSalary }: { employeeDbId: number; basicSalary: number | null }) {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    month: MONTHS[new Date().getMonth()], year: THIS_YEAR,
    basicSalary: basicSalary || 0, conveyance: 6000, overtime: 0,
    daysPresent: 0, daysAbsent: 0, daysLeave: 0, weekOffs: 0,
    otherDeduction: 0, notes: "",
  });

  const load = () => {
    setLoading(true);
    fetch(`/api/salary-records?employeeId=${employeeDbId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRecords(data); else setError(data?.error || "Failed to load records"); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  const fetchAttendance = async (month: string, year: number) => {
    const monthIdx = MONTHS.indexOf(month);
    const from = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const to = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    setAttLoading(true);
    try {
      const res = await fetch(`/api/attendance?from=${from}&to=${to}&employeeId=${employeeDbId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        let present = 0, absent = 0, leave = 0;
        data.forEach((r: any) => {
          if (r.status === "present" || r.status === "half-day") present++;
          else if (r.status === "absent") absent++;
          else if (r.status === "leave") leave++;
        });
        setForm(p => ({ ...p, daysPresent: present, daysAbsent: absent, daysLeave: leave }));
      }
    } catch { /* silently ignore */ }
    finally { setAttLoading(false); }
  };

  useEffect(() => { load(); }, [employeeDbId]);

  const sf = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleMonthYear = (k: "month" | "year", v: any) => {
    const next = { ...form, [k]: v };
    setForm(next);
    fetchAttendance(next.month, next.year);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/salary-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employeeDbId, ...form }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setShowForm(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this salary record?")) return;
    await fetch(`/api/salary-records?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>{records.length} record{records.length !== 1 ? "s" : ""}</div>
        <button className="btn btn-primary btn-sm" onClick={() => {
          if (!showForm) fetchAttendance(form.month, form.year);
          setShowForm(s => !s);
        }}>
          {showForm ? "✕ Cancel" : "＋ Add Salary Record"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, background: "var(--bg2)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>New Salary Record</div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 10 }}>Days present/absent/leave are auto-filled from attendance. You can adjust if needed.</div>
          {error && <div style={{ color: "var(--danger)", marginBottom: 10, fontSize: 12 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <div><label className="form-label">Month</label>
              <select value={form.month} onChange={e => handleMonthYear("month", e.target.value)}>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="form-label">Year</label>
              <select value={form.year} onChange={e => handleMonthYear("year", parseInt(e.target.value))}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div><label className="form-label">Basic Salary</label>
              <input type="number" value={form.basicSalary} onChange={e => sf("basicSalary", Number(e.target.value))} />
            </div>
            <div><label className="form-label">Conveyance</label>
              <input type="number" value={form.conveyance} onChange={e => sf("conveyance", Number(e.target.value))} />
            </div>
            <div><label className="form-label">Overtime / Bonus</label>
              <input type="number" value={form.overtime} onChange={e => sf("overtime", Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Days Present {attLoading && <span style={{ color: "var(--text2)", fontSize: 10 }}>loading…</span>}</label>
              <input type="number" value={form.daysPresent} onChange={e => sf("daysPresent", Number(e.target.value))} style={{ background: "var(--bg2)" }} />
            </div>
            <div>
              <label className="form-label">Days Absent {attLoading && <span style={{ color: "var(--text2)", fontSize: 10 }}>loading…</span>}</label>
              <input type="number" value={form.daysAbsent} onChange={e => sf("daysAbsent", Number(e.target.value))} style={{ background: "var(--bg2)" }} />
            </div>
            <div>
              <label className="form-label">Days on Leave {attLoading && <span style={{ color: "var(--text2)", fontSize: 10 }}>loading…</span>}</label>
              <input type="number" value={form.daysLeave} onChange={e => sf("daysLeave", Number(e.target.value))} style={{ background: "var(--bg2)" }} />
            </div>
            <div><label className="form-label">Other Deduction</label>
              <input type="number" value={form.otherDeduction} onChange={e => sf("otherDeduction", Number(e.target.value))} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="form-label">Notes</label>
            <input value={form.notes} onChange={e => sf("notes", e.target.value)} placeholder="Optional notes" />
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save Record"}
          </button>
        </div>
      )}

      {loading ? <div className="empty">Loading...</div> : records.length === 0 ? (
        <div className="empty">No salary records yet. Click <strong>＋ Add Salary Record</strong> to add one.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Month / Year</th>
                <th className="num">Basic</th>
                <th className="num">Gross</th>
                <th className="num">Income Tax</th>
                <th className="num">EOBI Emp</th>
                <th className="num">EOBI Empr</th>
                <th className="num">Absent Ded.</th>
                <th className="num">Other Ded.</th>
                <th className="num" style={{ color: "var(--danger)" }}>Total Ded.</th>
                <th className="num" style={{ color: "var(--success)" }}>Net Pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.month} {r.year}</td>
                  <td className="num">{fmt(r.basicSalary)}</td>
                  <td className="num">{fmt(gross(r))}</td>
                  <td className="num">{fmt(incomeTax(r.basicSalary))}</td>
                  <td className="num">{fmt(eobiEmp(r.basicSalary))}</td>
                  <td className="num">{fmt(eobiEmpr(r.basicSalary))}</td>
                  <td className="num">{fmt(absentDed(r))}</td>
                  <td className="num">{fmt(r.otherDeduction)}</td>
                  <td className="num" style={{ color: "var(--danger)", fontWeight: 600 }}>{fmt(totalDed(r))}</td>
                  <td className="num" style={{ color: "var(--success)", fontWeight: 700 }}>{fmt(netPay(r))}</td>
                  <td>
                    <button className="btn btn-sm btn-danger-soft" onClick={() => del(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
