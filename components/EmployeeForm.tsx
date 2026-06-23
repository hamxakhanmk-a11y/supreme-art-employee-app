"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Education = { degree: string; institution: string; yearCompleted: string; grade: string; certificateUrl: string; };
type Experience = { company: string; position: string; fromDate: string; toDate: string; description: string; };
type OtherDoc = { label: string; url: string; };

export type EmployeePayload = {
  employeeId: string;
  firstName: string; lastName: string; fatherName: string; dob: string;
  gender: string; maritalStatus: string; nationality: string; religion: string; bloodGroup: string;
  cnic: string; cnicExpiry: string; passportNumber: string; passportExpiry: string;
  ssiNumber: string; ssiExpiry: string; ubiNumber: string; ubiExpiry: string;
  phone: string; altPhone: string; email: string;
  currentAddress: string; permanentAddress: string; city: string;
  emergencyName: string; emergencyRelation: string; emergencyPhone: string;
  designation: string; department: string; joiningDate: string; employmentType: string;
  reportingManager: string; workLocation: string; shift: string; status: string;
  contractExpiry: string;
  basicSalary: string;
  conveyance: string;
  houseRentPercent: string;
  medicalPercent: string;
  incomeTaxPercent: string;
  incomeTaxAmount: string;
  eobiEmployeePercent: string;
  eobiEmployeeAmount: string;
  eobiEmployerPercent: string;
  accommodation: string;
  food: string;
  bankName: string; accountTitle: string; accountNumber: string; iban: string;
  photoUrl: string; cnicFrontUrl: string; cnicBackUrl: string; passportUrl: string;
  ssiUrl: string; ubiUrl: string;
  notes: string;
  education: Education[];
  experience: Experience[];
  otherDocuments: OtherDoc[];
};

const empty: EmployeePayload = {
  employeeId: "",
  firstName: "", lastName: "", fatherName: "", dob: "",
  gender: "", maritalStatus: "", nationality: "Pakistani", religion: "", bloodGroup: "",
  cnic: "", cnicExpiry: "", passportNumber: "", passportExpiry: "",
  ssiNumber: "", ssiExpiry: "", ubiNumber: "", ubiExpiry: "",
  phone: "", altPhone: "", email: "",
  currentAddress: "", permanentAddress: "", city: "",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",
  designation: "", department: "", joiningDate: "", employmentType: "Full-time",
  reportingManager: "", workLocation: "", shift: "", status: "active",
  contractExpiry: "",
  basicSalary: "",
  conveyance: "0",
  houseRentPercent: "0",
  medicalPercent: "0",
  incomeTaxPercent: "0",
  incomeTaxAmount: "0",
  eobiEmployeePercent: "0",
  eobiEmployeeAmount: "0",
  eobiEmployerPercent: "0",
  accommodation: "0",
  food: "0",
  bankName: "", accountTitle: "", accountNumber: "", iban: "",
  photoUrl: "", cnicFrontUrl: "", cnicBackUrl: "", passportUrl: "",
  ssiUrl: "", ubiUrl: "",
  notes: "",
  education: [],
  experience: [],
  otherDocuments: [],
};

export default function EmployeeForm({
  initial, mode, employeeId,
}: { initial?: Partial<EmployeePayload>; mode: "create" | "edit"; employeeId?: number; }) {
  const router = useRouter();
  const [form, setForm] = useState<EmployeePayload>({ ...empty, ...(initial as any) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof EmployeePayload, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Upload failed");
    }
    const data = await res.json();
    return data.url as string;
  };

  const handleFile = async (key: keyof EmployeePayload, f: File | undefined) => {
    if (!f) return;
    try {
      const url = await uploadFile(f);
      set(key, url);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addEducation = () =>
    set("education", [...form.education, { degree: "", institution: "", yearCompleted: "", grade: "", certificateUrl: "" }]);
  const updEducation = (i: number, k: keyof Education, v: string) => {
    const next = [...form.education]; (next[i] as any)[k] = v; set("education", next);
  };
  const rmEducation = (i: number) => set("education", form.education.filter((_, idx) => idx !== i));

  const addExperience = () =>
    set("experience", [...form.experience, { company: "", position: "", fromDate: "", toDate: "", description: "" }]);
  const updExperience = (i: number, k: keyof Experience, v: string) => {
    const next = [...form.experience]; (next[i] as any)[k] = v; set("experience", next);
  };
  const rmExperience = (i: number) => set("experience", form.experience.filter((_, idx) => idx !== i));

  const addOtherDoc = () => set("otherDocuments", [...form.otherDocuments, { label: "", url: "" }]);
  const updOtherDoc = (i: number, k: keyof OtherDoc, v: string) => {
    const next = [...form.otherDocuments]; (next[i] as any)[k] = v; set("otherDocuments", next);
  };
  const rmOtherDoc = (i: number) => set("otherDocuments", form.otherDocuments.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const url = mode === "create" ? "/api/employees" : `/api/employees/${employeeId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
      const data = await res.json();
      router.push(`/employees/${data.id ?? employeeId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* === Personal === */}
      <div className="card">
        <div className="section-title">Personal Information</div>
        <Row>
          <Field label="Employee ID *"><input required value={form.employeeId} onChange={e => set("employeeId", e.target.value)} placeholder="e.g. EMP-001" /></Field>
          <Field label="First Name *"><input required value={form.firstName} onChange={e => set("firstName", e.target.value)} /></Field>
          <Field label="Last Name *"><input required value={form.lastName} onChange={e => set("lastName", e.target.value)} /></Field>
          <Field label="Father's Name"><input value={form.fatherName} onChange={e => set("fatherName", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Date of Birth"><input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} /></Field>
          <Field label="Gender">
            <select value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </Field>
          <Field label="Marital Status">
            <select value={form.maritalStatus} onChange={e => set("maritalStatus", e.target.value)}>
              <option value="">—</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Nationality"><input value={form.nationality} onChange={e => set("nationality", e.target.value)} /></Field>
          <Field label="Religion"><input value={form.religion} onChange={e => set("religion", e.target.value)} /></Field>
          <Field label="Blood Group">
            <select value={form.bloodGroup} onChange={e => set("bloodGroup", e.target.value)}>
              <option value="">—</option>{["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(b => <option key={b}>{b}</option>)}
            </select>
          </Field>
        </Row>
      </div>

      {/* === Identification === */}
      <div className="card">
        <div className="section-title">Identification</div>
        <Row>
          <Field label="CNIC No"><input placeholder="00000-0000000-0" value={form.cnic} onChange={e => set("cnic", e.target.value)} /></Field>
          <Field label="CNIC Expiry"><input type="date" value={form.cnicExpiry} onChange={e => set("cnicExpiry", e.target.value)} /></Field>
          <Field label="Passport No"><input value={form.passportNumber} onChange={e => set("passportNumber", e.target.value)} /></Field>
          <Field label="Passport Expiry"><input type="date" value={form.passportExpiry} onChange={e => set("passportExpiry", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="EOBI No"><input value={form.ssiNumber} onChange={e => set("ssiNumber", e.target.value)} placeholder="EOBI number" /></Field>
          <Field label="EOBI Expiry"><input type="date" value={form.ssiExpiry} onChange={e => set("ssiExpiry", e.target.value)} /></Field>
          <Field label="ESSI No"><input value={form.ubiNumber} onChange={e => set("ubiNumber", e.target.value)} placeholder="ESSI number" /></Field>
          <Field label="ESSI Expiry"><input type="date" value={form.ubiExpiry} onChange={e => set("ubiExpiry", e.target.value)} /></Field>
        </Row>
      </div>

      {/* === Contact === */}
      <div className="card">
        <div className="section-title">Contact Information</div>
        <Row>
          <Field label="Phone"><input value={form.phone} onChange={e => set("phone", e.target.value)} /></Field>
          <Field label="Alternate Phone"><input value={form.altPhone} onChange={e => set("altPhone", e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Current Address" wide><textarea rows={2} value={form.currentAddress} onChange={e => set("currentAddress", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Permanent Address" wide><textarea rows={2} value={form.permanentAddress} onChange={e => set("permanentAddress", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="City"><input value={form.city} onChange={e => set("city", e.target.value)} /></Field>
        </Row>
      </div>

      {/* === Emergency === */}
      <div className="card">
        <div className="section-title">Emergency Contact</div>
        <Row>
          <Field label="Name"><input value={form.emergencyName} onChange={e => set("emergencyName", e.target.value)} /></Field>
          <Field label="Relationship"><input value={form.emergencyRelation} onChange={e => set("emergencyRelation", e.target.value)} /></Field>
          <Field label="Phone"><input value={form.emergencyPhone} onChange={e => set("emergencyPhone", e.target.value)} /></Field>
        </Row>
      </div>

      {/* === Job === */}
      <div className="card">
        <div className="section-title">Job Details</div>
        <Row>
          <Field label="Designation"><input value={form.designation} onChange={e => set("designation", e.target.value)} /></Field>
          <Field label="Department"><input value={form.department} onChange={e => set("department", e.target.value)} /></Field>
          <Field label="Joining Date"><input type="date" value={form.joiningDate} onChange={e => set("joiningDate", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Employment Type">
            <select value={form.employmentType} onChange={e => set("employmentType", e.target.value)}>
              <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option>
            </select>
          </Field>
          <Field label="Reporting Manager"><input value={form.reportingManager} onChange={e => set("reportingManager", e.target.value)} /></Field>
          <Field label="Work Location"><input value={form.workLocation} onChange={e => set("workLocation", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Shift"><input placeholder="e.g. 9 AM – 6 PM" value={form.shift} onChange={e => set("shift", e.target.value)} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Contract Expiry"><input type="date" value={form.contractExpiry} onChange={e => set("contractExpiry", e.target.value)} /></Field>
        </Row>
      </div>

      {/* === Salary Structure === */}
      <div className="card">
        <div className="section-title">Salary Structure</div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: -4, marginBottom: 12 }}>
          These values are reused every month when generating this employee's salary slips.
        </div>
        <Row>
          <Field label="Basic Salary (PKR)"><input type="number" value={form.basicSalary} onChange={e => set("basicSalary", e.target.value)} /></Field>
          <Field label="Conveyance (PKR)"><input type="number" value={form.conveyance} onChange={e => set("conveyance", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Income Tax">
            <AmountOrPercent
              percent={form.incomeTaxPercent} amount={form.incomeTaxAmount}
              onChange={(p, a) => { set("incomeTaxPercent", p); set("incomeTaxAmount", a); }}
            />
          </Field>
          <Field label="EOBI Employee">
            <AmountOrPercent
              percent={form.eobiEmployeePercent} amount={form.eobiEmployeeAmount}
              onChange={(p, a) => { set("eobiEmployeePercent", p); set("eobiEmployeeAmount", a); }}
            />
          </Field>
        </Row>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16, marginBottom: 6 }}>Not-Deducted Benefits</div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: -4, marginBottom: 8 }}>
          ESSI (PKR 2,400) and EOBI Employer (PKR 1,850 = 5% of min wage) are fixed and added automatically on every slip.
        </div>
        <Row>
          <Field label="Accommodation (PKR)"><input type="number" value={form.accommodation} onChange={e => set("accommodation", e.target.value)} /></Field>
          <Field label="Food (PKR)"><input type="number" value={form.food} onChange={e => set("food", e.target.value)} /></Field>
        </Row>
      </div>

      {/* === Banking === */}
      <div className="card">
        <div className="section-title">Banking Details</div>
        <Row>
          <Field label="Bank Name"><input value={form.bankName} onChange={e => set("bankName", e.target.value)} /></Field>
          <Field label="Account Title"><input value={form.accountTitle} onChange={e => set("accountTitle", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Account Number"><input value={form.accountNumber} onChange={e => set("accountNumber", e.target.value)} /></Field>
          <Field label="IBAN"><input value={form.iban} onChange={e => set("iban", e.target.value)} /></Field>
        </Row>
      </div>

      {/* === Documents === */}
      <div className="card">
        <div className="section-title">Documents</div>
        <Row>
          <FileField label="Profile Photo" url={form.photoUrl} onUpload={f => handleFile("photoUrl", f)} onClear={() => set("photoUrl", "")} accept="image/*" />
          <FileField label="CNIC (Front)" url={form.cnicFrontUrl} onUpload={f => handleFile("cnicFrontUrl", f)} onClear={() => set("cnicFrontUrl", "")} accept="image/*" />
        </Row>
        <Row>
          <FileField label="CNIC (Back)" url={form.cnicBackUrl} onUpload={f => handleFile("cnicBackUrl", f)} onClear={() => set("cnicBackUrl", "")} accept="image/*" />
          <FileField label="Passport" url={form.passportUrl} onUpload={f => handleFile("passportUrl", f)} onClear={() => set("passportUrl", "")} accept="image/*,application/pdf" />
          <FileField label="EOBI" url={form.ssiUrl} onUpload={f => handleFile("ssiUrl", f)} onClear={() => set("ssiUrl", "")} accept="image/*,application/pdf" />
          <FileField label="ESSI" url={form.ubiUrl} onUpload={f => handleFile("ubiUrl", f)} onClear={() => set("ubiUrl", "")} accept="image/*,application/pdf" />
        </Row>

        {/* Other Documents — flexible list */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Other Documents
            </div>
            <button type="button" className="btn btn-sm" onClick={addOtherDoc}>＋ Add Document</button>
          </div>
          {form.otherDocuments.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text3)", padding: "8px 0" }}>
              Driving license, contract copy, NDA, medical certificate, training certs, joining letter — anything else goes here.
            </div>
          )}
          {form.otherDocuments.map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto", gap: 10, alignItems: "end", padding: "10px 0", borderTop: i === 0 ? "none" : "1px dashed var(--border)" }}>
              <div>
                <label className="form-label">Label</label>
                <input value={d.label} placeholder="e.g. Driving License" onChange={e => updOtherDoc(i, "label", e.target.value)} />
              </div>
              <FileField
                label="File"
                url={d.url}
                onUpload={async f => { const url = await uploadFile(f); updOtherDoc(i, "url", url); }}
                onClear={() => updOtherDoc(i, "url", "")}
                accept="image/*,application/pdf"
              />
              <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => rmOtherDoc(i)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      {/* === Education === */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="section-title" style={{ margin: 0, paddingBottom: 0, border: "none" }}>Education</div>
          <button type="button" className="btn" onClick={addEducation}>＋ Add Education</button>
        </div>
        {form.education.length === 0 && <div className="empty" style={{ padding: "1rem 0" }}>No education records added.</div>}
        {form.education.map((ed, i) => (
          <div key={i} style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 12, marginTop: 10 }}>
            <Row>
              <Field label="Degree / Certification"><input value={ed.degree} onChange={e => updEducation(i, "degree", e.target.value)} /></Field>
              <Field label="Institution"><input value={ed.institution} onChange={e => updEducation(i, "institution", e.target.value)} /></Field>
              <Field label="Year"><input value={ed.yearCompleted} onChange={e => updEducation(i, "yearCompleted", e.target.value)} /></Field>
              <Field label="Grade / CGPA"><input value={ed.grade} onChange={e => updEducation(i, "grade", e.target.value)} /></Field>
            </Row>
            <Row>
              <FileField label="Certificate / Proof" url={ed.certificateUrl} onUpload={async f => { const url = await uploadFile(f); updEducation(i, "certificateUrl", url); }} onClear={() => updEducation(i, "certificateUrl", "")} accept="image/*,application/pdf" />
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button" className="btn btn-danger-soft" onClick={() => rmEducation(i)}>Remove</button>
              </div>
            </Row>
          </div>
        ))}
      </div>

      {/* === Experience === */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="section-title" style={{ margin: 0, paddingBottom: 0, border: "none" }}>Work Experience</div>
          <button type="button" className="btn" onClick={addExperience}>＋ Add Experience</button>
        </div>
        {form.experience.length === 0 && <div className="empty" style={{ padding: "1rem 0" }}>No experience records added.</div>}
        {form.experience.map((ex, i) => (
          <div key={i} style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 12, marginTop: 10 }}>
            <Row>
              <Field label="Company"><input value={ex.company} onChange={e => updExperience(i, "company", e.target.value)} /></Field>
              <Field label="Position"><input value={ex.position} onChange={e => updExperience(i, "position", e.target.value)} /></Field>
              <Field label="From"><input type="date" value={ex.fromDate} onChange={e => updExperience(i, "fromDate", e.target.value)} /></Field>
              <Field label="To"><input type="date" value={ex.toDate} onChange={e => updExperience(i, "toDate", e.target.value)} /></Field>
            </Row>
            <Row>
              <Field label="Description" wide><textarea rows={2} value={ex.description} onChange={e => updExperience(i, "description", e.target.value)} /></Field>
            </Row>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button type="button" className="btn btn-danger-soft" onClick={() => rmExperience(i)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* === Notes === */}
      <div className="card">
        <div className="section-title">Notes</div>
        <textarea rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional information…" />
      </div>

      {/* === Submit === */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg)", padding: "12px 0" }}>
        <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create Employee" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 10 }}>{children}</div>;
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? "1/-1" : "auto" }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function PercentSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // 0..100 in steps of 1
  return (
    <select value={value || "0"} onChange={e => onChange(e.target.value)}>
      {Array.from({ length: 101 }, (_, i) => (
        <option key={i} value={String(i)}>{i}%</option>
      ))}
    </select>
  );
}

// A single field that lets the user enter either a percentage (of basic
// salary) OR a fixed PKR amount. The two are kept in lockstep — switching
// unit clears the other field so the compute step never sees both set.
function AmountOrPercent({ percent, amount, onChange }: {
  percent: string; amount: string; onChange: (p: string, a: string) => void;
}) {
  const initialUnit: "PKR" | "%" = (parseInt(amount) || 0) > 0 ? "PKR" : "%";
  const [unit, setUnit] = useState<"PKR" | "%">(initialUnit);
  const value = unit === "PKR" ? amount : percent;
  const handleValue = (v: string) => {
    if (unit === "PKR") onChange("0", v || "0");
    else onChange(v || "0", "0");
  };
  const handleUnit = (u: "PKR" | "%") => {
    setUnit(u);
    if (u === "PKR") onChange("0", percent === "0" ? "0" : "0");
    else onChange(amount === "0" ? "0" : "0", "0");
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "85px 1fr", gap: 6 }}>
      <select value={unit} onChange={e => handleUnit(e.target.value as "PKR" | "%")}>
        <option value="%">% of basic</option>
        <option value="PKR">PKR</option>
      </select>
      <input type="number" min={0} value={value} onChange={e => handleValue(e.target.value)} placeholder="0" />
    </div>
  );
}

function FileField({ label, url, onUpload, onClear, accept }: {
  label: string; url: string; onUpload: (f: File) => void | Promise<void>; onClear: () => void; accept: string;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {url ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "#fafafa" }}>
          {/\.(png|jpe?g|gif|webp|svg)$/i.test(url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" style={{ height: 48, borderRadius: 6, border: "1px solid var(--border)" }} />
          ) : (
            <span style={{ fontSize: 12, color: "#555" }}>📄 File uploaded</span>
          )}
          <a href={url} target="_blank" className="btn" style={{ padding: "4px 10px", fontSize: 12 }}>Open</a>
          <button type="button" className="btn btn-danger-soft" onClick={onClear} style={{ padding: "4px 10px", fontSize: 12 }}>Remove</button>
        </div>
      ) : (
        <input type="file" accept={accept} onChange={e => onUpload(e.target.files?.[0] as any)} />
      )}
    </div>
  );
}
