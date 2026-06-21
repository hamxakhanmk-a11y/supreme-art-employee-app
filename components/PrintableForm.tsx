"use client";
import { useMemo, useState } from "react";

type AttachDoc = { id: string; label: string; url: string };

type Data = {
  employeeId?: string;
  firstName?: string; lastName?: string; fatherName?: string; dob?: string;
  gender?: string; maritalStatus?: string; nationality?: string; religion?: string; bloodGroup?: string;
  cnic?: string; cnicExpiry?: string; passportNumber?: string; passportExpiry?: string;
  ssiNumber?: string; ubiNumber?: string;
  phone?: string; altPhone?: string; email?: string;
  currentAddress?: string; permanentAddress?: string; city?: string;
  emergencyName?: string; emergencyRelation?: string; emergencyPhone?: string;
  designation?: string; department?: string; joiningDate?: string; employmentType?: string;
  reportingManager?: string; workLocation?: string; shift?: string;
  basicSalary?: any;
  bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string;
  notes?: string;
  photoUrl?: string;
  cnicFrontUrl?: string; cnicBackUrl?: string; passportUrl?: string;
  ssiUrl?: string; ubiUrl?: string;
  education?: { degree?: string; institution?: string; yearCompleted?: string; grade?: string; certificateUrl?: string; }[];
  experience?: { company?: string; position?: string; fromDate?: string; toDate?: string; }[];
  otherDocuments?: { id: number; label: string; url: string; category?: string | null }[];
};

function fmt(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export default function PrintableForm({ data = {} }: { data?: Data }) {
  const v = (x?: any) => x ? String(x) : "";

  // All attachable documents discovered from the employee record.
  const allAttachables: AttachDoc[] = useMemo(() => {
    const list: AttachDoc[] = [];
    if (data.photoUrl)       list.push({ id: "photo",       label: "Profile Photo",       url: data.photoUrl });
    if (data.cnicFrontUrl)   list.push({ id: "cnic-front",  label: "CNIC (Front)",        url: data.cnicFrontUrl });
    if (data.cnicBackUrl)    list.push({ id: "cnic-back",   label: "CNIC (Back)",         url: data.cnicBackUrl });
    if (data.passportUrl)    list.push({ id: "passport",    label: "Passport",            url: data.passportUrl });
    if (data.ssiUrl)         list.push({ id: "eobi",        label: "EOBI Document",       url: data.ssiUrl });
    if (data.ubiUrl)         list.push({ id: "essi",        label: "ESSI Document",       url: data.ubiUrl });
    (data.education || []).forEach((e, i) => {
      if (e.certificateUrl) list.push({ id: `edu-${i}`, label: `Education Certificate — ${e.degree || ("Record " + (i + 1))}`, url: e.certificateUrl });
    });
    (data.otherDocuments || []).forEach(d => {
      list.push({ id: `other-${d.id}`, label: d.label, url: d.url });
    });
    return list;
  }, [data]);

  // Selection state — nothing pre-checked; user picks before printing.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const setAll = (on: boolean) => setSelected(on ? new Set(allAttachables.map(a => a.id)) : new Set());
  const attached = allAttachables.filter(a => selected.has(a.id));
  const isImage = (u: string) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u);

  return (
    <>
      {/* Print controls + document picker (hidden when printing) */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <a href="/employees" style={{ fontSize: 12, color: "var(--primary)" }}>← Back</a>
        <button className="btn btn-print" onClick={() => window.print()}>
          🖨 Print Form{attached.length > 0 ? ` + ${attached.length} doc${attached.length === 1 ? "" : "s"}` : ""}
        </button>
      </div>

      {allAttachables.length > 0 && (
        <div className="no-print card" style={{ maxWidth: 850, margin: "0 auto 16px", borderColor: "var(--brand)", borderWidth: 2, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 0.8 }}>📎 Attach documents to print?</div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>
                Each ticked document will be appended on its own page after the profile form.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setAll(true)} className="btn btn-sm">Select all</button>
              <button onClick={() => setAll(false)} className="btn btn-sm">Clear</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6 }}>
            {allAttachables.map(a => (
              <label key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)", cursor: "pointer", padding: "4px 0" }}>
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} style={{ width: 16, height: 16 }} />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      )}

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
            <Pair label="ESSI Number" value={data.ubiNumber} flex />
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

        {/* Documents checklist — auto-ticked from the picker above */}
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

      {/* Appended document pages — one per selected attachment, each on its own
          printed page. Hidden on screen for non-print use to keep the page clean. */}
      {attached.map(a => (
        <div key={a.id} className="print-page attached-doc" style={{
          background: "#fff",
          maxWidth: 850,
          margin: "16px auto 0",
          padding: "20px 24px",
          border: "1px solid var(--border)",
          pageBreakBefore: "always",
          breakBefore: "page",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #A32D2D", paddingBottom: 8, marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Supreme Art" style={{ height: 56, width: "auto", objectFit: "contain" }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#A32D2D" }}>{a.label}</div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                {v(data.firstName)} {v(data.lastName)} · <strong>{v(data.employeeId)}</strong>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            {isImage(a.url) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={a.url} alt={a.label} style={{ maxWidth: "100%", maxHeight: 940, objectFit: "contain", border: "1px solid #ddd" }} />
            ) : (
              <div style={{ padding: 30, border: "1px dashed #999", borderRadius: 6, color: "#555", fontSize: 12 }}>
                📄 <strong>{a.label}</strong>
                <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                  Non-image attachment ({a.url.split(".").pop()?.toUpperCase()}). Print the file separately from its source.
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
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
