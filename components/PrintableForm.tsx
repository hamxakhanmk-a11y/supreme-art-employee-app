"use client";

type Data = {
  employeeId?: string;
  firstName?: string; lastName?: string; fatherName?: string; dob?: string;
  gender?: string; maritalStatus?: string; nationality?: string; religion?: string; bloodGroup?: string;
  cnic?: string; cnicExpiry?: string; passportNumber?: string; passportExpiry?: string;
  phone?: string; altPhone?: string; email?: string;
  currentAddress?: string; permanentAddress?: string; city?: string;
  emergencyName?: string; emergencyRelation?: string; emergencyPhone?: string;
  designation?: string; department?: string; joiningDate?: string; employmentType?: string;
  reportingManager?: string; workLocation?: string; shift?: string;
  basicSalary?: any;
  bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string;
  notes?: string;
  photoUrl?: string;
  education?: { degree?: string; institution?: string; yearCompleted?: string; grade?: string; }[];
  experience?: { company?: string; position?: string; fromDate?: string; toDate?: string; }[];
};

function fmt(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export default function PrintableForm({ data = {} }: { data?: Data }) {
  const v = (x?: any) => x ? String(x) : "";

  return (
    <>
      {/* Print controls (hidden when printing) */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <a href="/employees" style={{ fontSize: 12, color: "var(--primary)" }}>← Back</a>
        <button className="btn btn-print" onClick={() => window.print()}>🖨 Print Form</button>
      </div>

      <div className="print-page" style={{ background: "#fff", border: "1px solid var(--border)", padding: "28px 32px", maxWidth: 850, margin: "0 auto", color: "#000", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
        {/* Header with logo */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2.5px solid #A32D2D", paddingBottom: 14, marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" style={{ height: 64, width: "auto", objectFit: "contain" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "#A32D2D" }}>
              Employee Information Form
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
              Employee ID: <strong style={{ color: "#000" }}>{v(data.employeeId) || "____________"}</strong>
            </div>
            <div style={{ fontSize: 10, color: "#555" }}>
              Date: <strong style={{ color: "#000" }}>{fmt(new Date().toISOString()) || "____________"}</strong>
            </div>
          </div>
        </div>

        {/* Photo + Personal */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 14, marginBottom: 10 }}>
          <Section title="Personal Information">
            <Pair label="Full Name" value={`${v(data.firstName)} ${v(data.lastName)}`.trim()} />
            <Pair label="Father's Name" value={data.fatherName} />
            <PairRow>
              <Pair label="Date of Birth" value={fmt(data.dob)} flex />
              <Pair label="Gender" value={data.gender} flex />
              <Pair label="Marital Status" value={data.maritalStatus} flex />
            </PairRow>
            <PairRow>
              <Pair label="Nationality" value={data.nationality} flex />
              <Pair label="Religion" value={data.religion} flex />
              <Pair label="Blood Group" value={data.bloodGroup} flex />
            </PairRow>
          </Section>
          <div className="photo-box" style={{ border: "1.5px dashed #777", borderRadius: 6, height: 140, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#888", textAlign: "center", background: "#fafafa", overflow: "hidden" }}>
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <>PASSPORT<br />SIZE<br />PHOTO</>
            )}
          </div>
        </div>

        {/* Identification */}
        <Section title="Identification">
          <PairRow>
            <Pair label="CNIC Number" value={data.cnic} flex />
            <Pair label="CNIC Expiry" value={fmt(data.cnicExpiry)} flex />
          </PairRow>
          <PairRow>
            <Pair label="Passport Number" value={data.passportNumber} flex />
            <Pair label="Passport Expiry" value={fmt(data.passportExpiry)} flex />
          </PairRow>
        </Section>

        {/* Contact */}
        <Section title="Contact Information">
          <PairRow>
            <Pair label="Phone" value={data.phone} flex />
            <Pair label="Alt. Phone" value={data.altPhone} flex />
            <Pair label="Email" value={data.email} flex />
          </PairRow>
          <Pair label="Current Address" value={data.currentAddress} />
          <Pair label="Permanent Address" value={data.permanentAddress} />
          <Pair label="City" value={data.city} />
        </Section>

        {/* Emergency */}
        <Section title="Emergency Contact">
          <PairRow>
            <Pair label="Name" value={data.emergencyName} flex />
            <Pair label="Relationship" value={data.emergencyRelation} flex />
            <Pair label="Phone" value={data.emergencyPhone} flex />
          </PairRow>
        </Section>

        {/* Job */}
        <Section title="Job Details">
          <PairRow>
            <Pair label="Designation" value={data.designation} flex />
            <Pair label="Department" value={data.department} flex />
            <Pair label="Joining Date" value={fmt(data.joiningDate)} flex />
          </PairRow>
          <PairRow>
            <Pair label="Employment Type" value={data.employmentType} flex />
            <Pair label="Reporting Manager" value={data.reportingManager} flex />
            <Pair label="Work Location" value={data.workLocation} flex />
          </PairRow>
          <PairRow>
            <Pair label="Shift" value={data.shift} flex />
            <Pair label="Basic Salary (PKR)" value={data.basicSalary ? Number(data.basicSalary).toLocaleString() : ""} flex />
          </PairRow>
        </Section>

        {/* Education table */}
        <Section title="Education">
          <table style={{ border: "1px solid #777", fontSize: 10 }}>
            <thead>
              <tr>
                <th style={pthHead}>Degree / Certification</th>
                <th style={pthHead}>Institution</th>
                <th style={pthHead}>Year</th>
                <th style={pthHead}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {(data.education && data.education.length > 0 ? data.education : Array(4).fill({})).map((e: any, i: number) => (
                <tr key={i}>
                  <td style={ptd}>{v(e.degree)}</td>
                  <td style={ptd}>{v(e.institution)}</td>
                  <td style={ptd}>{v(e.yearCompleted)}</td>
                  <td style={ptd}>{v(e.grade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Experience table */}
        <Section title="Work Experience">
          <table style={{ border: "1px solid #777", fontSize: 10 }}>
            <thead>
              <tr>
                <th style={pthHead}>Company</th>
                <th style={pthHead}>Position</th>
                <th style={pthHead}>From</th>
                <th style={pthHead}>To</th>
              </tr>
            </thead>
            <tbody>
              {(data.experience && data.experience.length > 0 ? data.experience : Array(3).fill({})).map((e: any, i: number) => (
                <tr key={i}>
                  <td style={ptd}>{v(e.company)}</td>
                  <td style={ptd}>{v(e.position)}</td>
                  <td style={ptd}>{fmt(e.fromDate)}</td>
                  <td style={ptd}>{fmt(e.toDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Banking */}
        <Section title="Banking Details">
          <PairRow>
            <Pair label="Bank Name" value={data.bankName} flex />
            <Pair label="Account Title" value={data.accountTitle} flex />
          </PairRow>
          <PairRow>
            <Pair label="Account Number" value={data.accountNumber} flex />
            <Pair label="IBAN" value={data.iban} flex />
          </PairRow>
        </Section>

        {/* Documents checklist */}
        <Section title="Documents Attached (Tick if attached)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, fontSize: 11 }}>
            {["CNIC Copy (Front & Back)", "Passport Copy", "Educational Certificates", "Experience Letters", "Recent Photograph", "Reference Letter"].map(d => (
              <div key={d}>☐ {d}</div>
            ))}
          </div>
        </Section>

        {/* Declaration + signatures */}
        <div style={{ marginTop: 16, fontSize: 10, lineHeight: 1.5, borderTop: "1px solid #777", paddingTop: 10 }}>
          <strong>Declaration:</strong> I hereby declare that the information furnished above is true, complete and correct to the best of my knowledge. I understand that any false information may result in termination of employment.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 30 }}>
          <div>
            <div style={{ borderTop: "1px solid #000", paddingTop: 4, fontSize: 10, textAlign: "center" }}>
              Employee Signature & Date
            </div>
          </div>
          <div>
            <div style={{ borderTop: "1px solid #000", paddingTop: 4, fontSize: 10, textAlign: "center" }}>
              HR Authorized Signature & Date
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="print-section" style={{ border: "1px solid #bbb", borderRadius: 4, marginBottom: 8, padding: "6px 10px 8px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "#A32D2D", borderBottom: "1.5px solid #A32D2D", paddingBottom: 4, marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Pair({ label, value, flex }: { label: string; value?: string; flex?: boolean }) {
  return (
    <div style={{ flex: flex ? 1 : undefined, marginBottom: 4 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ borderBottom: "1px solid #999", minHeight: 18, padding: "1px 2px", fontSize: 11 }}>{value || " "}</div>
    </div>
  );
}

function PairRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>{children}</div>;
}

const pthHead: React.CSSProperties = {
  border: "1px solid #999", padding: 4, fontSize: 9, background: "#f0f0f0",
  textTransform: "uppercase", letterSpacing: 0.4, color: "#000",
};
const ptd: React.CSSProperties = {
  border: "1px solid #999", padding: 6, fontSize: 10, height: 22,
};
