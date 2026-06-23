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
          const accom = Number(employee.accommodation || 0);
          const food = Number(employee.food || 0);
          const itAmt = Number(employee.incomeTaxAmount || 0);
          const itPct = Number(employee.incomeTaxPercent || 0);
          const eobiAmt = Number(employee.eobiEmployeeAmount || 0);
          const eobiPct = Number(employee.eobiEmployeePercent || 0);
          const fmtPKR = (n: number) => n ? `PKR ${n.toLocaleString()}` : "—";
          const fmtPctOrPkr = (amt: number, pct: number) =>
            amt > 0 ? `PKR ${amt.toLocaleString()}` : `${pct}%`;
          return <Grid items={[
            ["Basic Salary", fmtPKR(basic)],
            ["Income Tax", fmtPctOrPkr(itAmt, itPct)],
            ["EOBI Employee", fmtPctOrPkr(eobiAmt, eobiPct)],
            ["Conveyance", fmtPKR(conv)],
            ["Accommodation", fmtPKR(accom)],
            ["Food", fmtPKR(food)],
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

const fmtPKR = (n: number) => Number(n || 0).toLocaleString("en-PK");

type SalaryRecord = {
  id: number; month: string; year: number;
  basicSalary: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  createdAt: string;
};

function SalaryHistory({ employeeDbId, basicSalary }: { employeeDbId: number; basicSalary: number | null }) {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/salary-records?employeeId=${employeeDbId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRecords(data); else setError(data?.error || "Failed to load records"); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [employeeDbId]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text2)" }}>{records.length} slip{records.length !== 1 ? "s" : ""}</div>
        <a href="/salary" className="btn btn-primary btn-sm">＋ Generate Slip</a>
      </div>

      {error && <div style={{ color: "var(--danger)", marginBottom: 10, fontSize: 12 }}>{error}</div>}

      {loading ? <div className="empty">Loading…</div> : records.length === 0 ? (
        <div className="empty">No salary slips for this employee yet. <a href="/salary" style={{ color: "var(--brand)" }}>Generate one →</a></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th className="num">Basic</th>
                <th className="num">Gross</th>
                <th className="num" style={{ color: "var(--danger)" }}>Total Ded.</th>
                <th className="num" style={{ color: "var(--success)" }}>Net Pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.month} {r.year}</td>
                  <td className="num">{fmtPKR(r.basicSalary)}</td>
                  <td className="num">{fmtPKR(r.grossEarnings)}</td>
                  <td className="num" style={{ color: "var(--danger)", fontWeight: 600 }}>{fmtPKR(r.totalDeductions)}</td>
                  <td className="num" style={{ color: "var(--success)", fontWeight: 700 }}>{fmtPKR(r.netPay)}</td>
                  <td><a href={`/salary/${r.id}`} className="btn btn-sm">View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
