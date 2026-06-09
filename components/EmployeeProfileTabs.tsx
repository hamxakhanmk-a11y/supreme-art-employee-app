"use client";
import { useState } from "react";

type Edu = { id: number; degree: string; institution: string | null; yearCompleted: string | null; grade: string | null; certificateUrl: string | null; };
type Exp = { id: number; company: string; position: string | null; fromDate: string | null; toDate: string | null; description: string | null; };

export default function EmployeeProfileTabs({
  employee, education, experience,
}: { employee: any; education: Edu[]; experience: Exp[]; }) {
  const [tab, setTab] = useState<"personal" | "job" | "contact" | "documents" | "education" | "experience" | "banking">("personal");

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "personal", label: "Personal" },
    { key: "contact", label: "Contact" },
    { key: "job", label: "Job" },
    { key: "banking", label: "Banking" },
    { key: "documents", label: "Documents" },
    { key: "education", label: "Education" },
    { key: "experience", label: "Experience" },
  ];

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 1rem", overflowX: "auto" }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              color: tab === t.key ? "var(--primary)" : "#666",
              borderBottom: `2px solid ${tab === t.key ? "var(--primary)" : "transparent"}`,
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
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
          ["Basic Salary", employee.basicSalary ? `PKR ${Number(employee.basicSalary).toLocaleString()}` : null],
        ]} />}

        {tab === "banking" && <Grid items={[
          ["Bank Name", employee.bankName],
          ["Account Title", employee.accountTitle],
          ["Account Number", employee.accountNumber],
          ["IBAN", employee.iban],
        ]} />}

        {tab === "documents" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            <DocCard label="Profile Photo" url={employee.photoUrl} />
            <DocCard label="CNIC (Front)" url={employee.cnicFrontUrl} />
            <DocCard label="CNIC (Back)" url={employee.cnicBackUrl} />
            <DocCard label="Passport" url={employee.passportUrl} />
            <DocCard label="SSI" url={employee.ssiUrl} />
            <DocCard label="UBI" url={employee.ubiUrl} />
          </div>
        )}

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

function DocCard({ label, url }: { label: string; url: string | null }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "#fafafa" }}>
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
