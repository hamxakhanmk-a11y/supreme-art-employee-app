// The actual one-employee printed form — every field from Personal through
// Notes, laid out as Section/PairRow blocks that wrap to a new row on their
// own once a group doesn't fit one line. Shared by the single-employee print
// (components/PrintableForm.tsx, which adds the interactive document picker
// around it) and the bulk "print all" page (app/employees/print-all), which
// renders one of these per employee with no picker — just the plain,
// nothing-ticked documents checklist.
export type AttachDoc = { id: string; label: string; url: string };

export type EmployeePrintData = {
  employeeId?: string | null;
  firstName?: string | null; lastName?: string | null; fatherName?: string | null; dob?: string | null;
  gender?: string | null; maritalStatus?: string | null; nationality?: string | null; religion?: string | null; bloodGroup?: string | null;
  cnic?: string | null; cnicExpiry?: string | null; passportNumber?: string | null; passportExpiry?: string | null;
  ssiNumber?: string | null; ssiExpiry?: string | null; ubiNumber?: string | null; ubiExpiry?: string | null;
  phone?: string | null; altPhone?: string | null; email?: string | null;
  currentAddress?: string | null; permanentAddress?: string | null; city?: string | null;
  emergencyName?: string | null; emergencyRelation?: string | null; emergencyPhone?: string | null;
  designation?: string | null; department?: string | null; joiningDate?: string | null; employmentType?: string | null;
  reportingManager?: string | null; workLocation?: string | null; shift?: string | null;
  status?: string | null; contractExpiry?: string | null; resignationDate?: string | null; kpiTemplate?: string | null;
  basicSalary?: any; conveyance?: any; houseRentPercent?: any; medicalPercent?: any;
  incomeTaxPercent?: any; incomeTaxAmount?: any;
  eobiEmployeePercent?: any; eobiEmployeeAmount?: any; eobiEmployerPercent?: any; eobiEmployerAmount?: any;
  minimumWage?: any; essiContribution?: any; accommodation?: any; food?: any;
  bankName?: string | null; accountTitle?: string | null; accountNumber?: string | null; iban?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  cnicFrontUrl?: string | null; cnicBackUrl?: string | null; passportUrl?: string | null;
  ssiUrl?: string | null; ubiUrl?: string | null;
  education?: { degree?: string | null; institution?: string | null; yearCompleted?: string | null; grade?: string | null; certificateUrl?: string | null; }[];
  experience?: { company?: string | null; position?: string | null; fromDate?: string | null; toDate?: string | null; }[];
  otherDocuments?: { id: number; label: string; url: string; category?: string | null }[];
};

export function fmt(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export default function EmployeePrintPage({ data = {}, attached = [] }: { data?: EmployeePrintData; attached?: AttachDoc[] }) {
  const v = (x?: any) => x ? String(x) : "";
  const money = (x?: any) => (x != null && x !== "" ? Number(x).toLocaleString() : "");
  const pct = (x?: any) => (x != null && x !== "" ? `${x}%` : "");

  return (
    <div className="print-page" style={{ background: "#fff", border: "1px solid var(--border)", padding: "28px 32px", maxWidth: 850, margin: "0 auto", color: "#000", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
      {/* Header with logo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2.5px solid #A32D2D", paddingBottom: 14, marginBottom: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Supreme Art" style={{ height: 110, width: "auto", maxWidth: 320, objectFit: "contain" }} />
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
        <PairRow>
          <Pair label="EOBI Number" value={data.ssiNumber} flex />
          <Pair label="EOBI Expiry" value={fmt(data.ssiExpiry)} flex />
        </PairRow>
        <PairRow>
          <Pair label="ESSI Number" value={data.ubiNumber} flex />
          <Pair label="ESSI Expiry" value={fmt(data.ubiExpiry)} flex />
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
          <Pair label="Status" value={data.status} flex />
          <Pair label="KPI Template" value={data.kpiTemplate} flex />
        </PairRow>
        <PairRow>
          <Pair label="Contract Expiry" value={fmt(data.contractExpiry)} flex />
          <Pair label="Resignation Date" value={fmt(data.resignationDate)} flex />
        </PairRow>
      </Section>

      {/* Compensation */}
      <Section title="Compensation / Salary Details">
        <PairRow>
          <Pair label="Basic Salary (PKR)" value={money(data.basicSalary)} flex />
          <Pair label="Conveyance (PKR)" value={money(data.conveyance)} flex />
          <Pair label="Accommodation (PKR)" value={money(data.accommodation)} flex />
          <Pair label="Food (PKR)" value={money(data.food)} flex />
        </PairRow>
        <PairRow>
          <Pair label="House Rent %" value={pct(data.houseRentPercent)} flex />
          <Pair label="Medical %" value={pct(data.medicalPercent)} flex />
          <Pair label="Income Tax %" value={pct(data.incomeTaxPercent)} flex />
          <Pair label="Income Tax Amount (PKR)" value={money(data.incomeTaxAmount)} flex />
        </PairRow>
        <PairRow>
          <Pair label="EOBI Employee %" value={pct(data.eobiEmployeePercent)} flex />
          <Pair label="EOBI Employee Amount (PKR)" value={money(data.eobiEmployeeAmount)} flex />
          <Pair label="EOBI Employer %" value={pct(data.eobiEmployerPercent)} flex />
          <Pair label="EOBI Employer Amount (PKR)" value={money(data.eobiEmployerAmount)} flex />
        </PairRow>
        <PairRow>
          <Pair label="Minimum Wage (PKR)" value={money(data.minimumWage)} flex />
          <Pair label="ESSI Contribution (PKR)" value={money(data.essiContribution)} flex />
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

      {/* Notes */}
      <Section title="Notes">
        <Pair label="Notes" value={data.notes} />
      </Section>

      {/* Documents checklist — auto-ticked from the picker, where one exists */}
      <Section title="Documents Attached">
        {attached.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, fontSize: 11 }}>
            {["CNIC Copy (Front & Back)", "Passport Copy", "Educational Certificates", "Experience Letters", "Recent Photograph", "Reference Letter"].map(d => (
              <div key={d}>☐ {d}</div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, fontSize: 11 }}>
            {attached.map(a => (
              <div key={a.id}>☑ {a.label}</div>
            ))}
          </div>
        )}
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
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="print-section" style={{ border: "1px solid #bbb", borderRadius: 4, marginBottom: 8, padding: "6px 10px 8px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "#A32D2D", borderBottom: "1.5px solid #A32D2D", paddingBottom: 4, marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function Pair({ label, value, flex }: { label: string; value?: string | null; flex?: boolean }) {
  return (
    <div style={{ flex: flex ? 1 : undefined, marginBottom: 4 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ borderBottom: "1px solid #999", minHeight: 18, padding: "1px 2px", fontSize: 11 }}>{value || " "}</div>
    </div>
  );
}

export function PairRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>{children}</div>;
}

const pthHead: React.CSSProperties = {
  border: "1px solid #999", padding: 4, fontSize: 9, background: "#f0f0f0",
  textTransform: "uppercase", letterSpacing: 0.4, color: "#000",
};
const ptd: React.CSSProperties = {
  border: "1px solid #999", padding: 6, fontSize: 10, height: 22,
};
