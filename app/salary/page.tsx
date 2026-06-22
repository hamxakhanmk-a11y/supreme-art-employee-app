"use client";
import { useState, useEffect, useRef } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

type Employee = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  joiningDate: string | null;
  status: string | null;
  basicSalary: number | null;
};

type Slip = {
  // inputs
  employeeId: string;
  month: string;
  year: number;
  // employee info (auto-filled)
  name: string;
  designation: string;
  department: string;
  phone: string;
  email: string;
  cnic: string;
  joiningDate: string;
  empStatus: string;
  basicSalary: number;
  // attendance (auto-filled / editable)
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  weekOffs: number;
  // earnings overrides
  conveyance: number;
  overtime: number;
  // deductions overrides
  otherDeduction: number;
};

const emptySlip = (): Slip => ({
  employeeId: "",
  month: MONTHS[new Date().getMonth()],
  year: CURRENT_YEAR,
  name: "", designation: "", department: "", phone: "", email: "", cnic: "", joiningDate: "", empStatus: "",
  basicSalary: 0,
  daysPresent: 0, daysAbsent: 0, daysLeave: 0, weekOffs: 0,
  conveyance: 6000, overtime: 0, otherDeduction: 0,
});

// ── Formulas (mirrors Excel) ──────────────────────────────────────────────────
const houseRent     = (basic: number) => Math.round(basic * 0.40);
const medicalAllow  = (basic: number) => Math.round(basic * 0.10);
const grossEarnings = (s: Slip) =>
  s.basicSalary + houseRent(s.basicSalary) + medicalAllow(s.basicSalary) + s.conveyance + s.overtime;

const incomeTax     = (basic: number) => Math.round(basic * 0.05);
const eobiEmployee  = (basic: number) => Math.round(basic * 0.01);
const eobiEmployer  = (basic: number) => Math.round(basic * 0.02);
const absentDeduct  = (s: Slip) => {
  const workingDays = s.daysPresent + s.daysAbsent + s.daysLeave;
  if (workingDays === 0 || s.daysAbsent === 0) return 0;
  return Math.round((grossEarnings(s) / workingDays) * s.daysAbsent);
};
const totalDeductions = (s: Slip) =>
  incomeTax(s.basicSalary) + eobiEmployee(s.basicSalary) + eobiEmployer(s.basicSalary) + absentDeduct(s) + s.otherDeduction;
const netPay = (s: Slip) => grossEarnings(s) - totalDeductions(s);
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-PK");

export default function SalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slip, setSlip] = useState<Slip>(emptySlip());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(setEmployees).catch(() => {});
  }, []);

  const set = (k: keyof Slip, v: any) => setSlip(p => ({ ...p, [k]: v }));

  const loadEmployee = async (empId: string, month?: string, year?: number) => {
    const emp = employees.find(e => e.employeeId === empId);
    if (!emp) return;
    setLoading(true);
    setError(null);
    const m = month ?? slip.month;
    const y = year ?? slip.year;
    try {
      const recRes = await fetch(`/api/salary-records?employeeId=${emp.id}`);
      const records: any[] = await recRes.json();
      const rec = Array.isArray(records) ? records.find((r: any) => r.month === m && r.year === y) : null;

      setSlip(p => ({
        ...p,
        employeeId: empId,
        name: `${emp.firstName} ${emp.lastName}`,
        designation: emp.designation || "",
        department: emp.department || "",
        phone: emp.phone || "",
        email: emp.email || "",
        cnic: emp.cnic || "",
        joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
        empStatus: emp.status || "Active",
        basicSalary: rec ? rec.basicSalary : (emp.basicSalary || 0),
        conveyance: rec ? rec.conveyance : 6000,
        overtime: rec ? rec.overtime : 0,
        daysPresent: rec ? rec.daysPresent : 0,
        daysAbsent: rec ? rec.daysAbsent : 0,
        daysLeave: rec ? rec.daysLeave : 0,
        weekOffs: rec ? rec.weekOffs : 0,
        otherDeduction: rec ? rec.otherDeduction : 0,
        _noRecord: !rec,
      } as any));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = (empId: string) => {
    set("employeeId", empId);
    if (empId) loadEmployee(empId);
  };

  const handleMonthYearChange = (k: "month" | "year", v: any) => {
    const next = { ...slip, [k]: v };
    setSlip(next);
    if (slip.employeeId) loadEmployee(slip.employeeId, next.month, next.year);
  };

  const handlePrint = () => window.print();

  const gross = grossEarnings(slip);
  const deductions = totalDeductions(slip);
  const net = netPay(slip);

  return (
    <div className="fade-up">
      {/* ── Controls (no-print) ── */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Salary Slip</h1>
            <p style={{ color: "#888", fontSize: 13, marginTop: 4 }}>Generate and print employee salary slips</p>
          </div>
          <button onClick={handlePrint} className="btn btn-primary" style={{ gap: 6 }}>
            🖨 Print / Save PDF
          </button>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            <div>
              <label className="form-label">Employee</label>
              <select value={slip.employeeId} onChange={e => handleEmployeeChange(e.target.value)}>
                <option value="">— Select Employee —</option>
                {employees.map(e => (
                  <option key={e.id} value={e.employeeId}>{e.employeeId} — {e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Month</label>
              <select value={slip.month} onChange={e => handleMonthYearChange("month", e.target.value)}>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Year</label>
              <select value={slip.year} onChange={e => handleMonthYearChange("year", parseInt(e.target.value))}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {(slip as any)._noRecord && slip.employeeId && !loading && (
            <div style={{ marginTop: 12, padding: "9px 14px", background: "#fff8e1", border: "1px solid #e0c96e", borderRadius: 6, fontSize: 13, color: "#7a5800" }}>
              No salary record found for <strong>{slip.month} {slip.year}</strong>. Go to the employee's profile → <em>Salary History</em> tab to add one.
            </div>
          )}
        </div>

        {error && <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginTop: 12 }}>{error}</div>}
        {loading && <div style={{ textAlign: "center", color: "#888", marginTop: 12 }}>Loading employee data...</div>}
      </div>

      {/* ── Printable Salary Slip ── */}
      {slip.employeeId && (
        <div ref={printRef} style={{
          background: "#fff",
          maxWidth: 900,
          margin: "0 auto",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: 13,
          color: "#1a1a1a",
          border: "1px solid #ddd",
          borderRadius: 8,
        }}>
          {/* Header */}
          <div style={{ background: "#A32D2D", color: "#fff", padding: "10px 24px", textAlign: "center", borderRadius: "8px 8px 0 0" }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Supreme Art (Pvt.) Ltd. | HR Department</div>
          </div>
          <div style={{ background: "#7C1F1F", color: "#fff", padding: "12px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3 }}>SALARY SLIP</div>
          </div>

          {/* Employee ID / Month / Year */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderBottom: "2px solid #A32D2D", background: "#fafafa", padding: "12px 24px", fontSize: 13 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Employee ID:</span>
              <span style={{ background: "#fff3cd", padding: "3px 14px", borderRadius: 4, fontWeight: 700, border: "1px solid #e0c96e" }}>{slip.employeeId}</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Month:</span>
              <span style={{ background: "#fff3cd", padding: "3px 14px", borderRadius: 4, fontWeight: 700, border: "1px solid #e0c96e" }}>{slip.month}</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
              <span style={{ fontWeight: 600 }}>Year:</span>
              <span style={{ background: "#fff3cd", padding: "3px 14px", borderRadius: 4, fontWeight: 700, border: "1px solid #e0c96e" }}>{slip.year}</span>
            </div>
          </div>

          {/* Employee Info */}
          <SectionHeader>Employee Information</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "0 24px 4px" }}>
            <InfoRow label="Employee Name" value={slip.name} />
            <InfoRow label="Department" value={slip.department} />
            <InfoRow label="Designation" value={slip.designation} />
            <InfoRow label="Date of Joining" value={slip.joiningDate} />
            <InfoRow label="Contact No." value={slip.phone} />
            <InfoRow label="Email" value={slip.email} />
            <InfoRow label="CNIC / Passport" value={slip.cnic} />
            <InfoRow label="Status" value={slip.empStatus} />
          </div>

          {/* Attendance */}
          <SectionHeader color="#2e6b4f">Attendance Summary</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "0 24px 4px", background: "#f6fbf8" }}>
            <AttRow label="Days Present" value={slip.daysPresent} color="#15803D" />
            <AttRow label="Days Absent" value={slip.daysAbsent} color="#DC2626" />
            <AttRow label="Days on Leave" value={slip.daysLeave} color="#D97706" />
            <AttRow label="Week Offs" value={slip.weekOffs} color="#15803D" />
          </div>

          {/* Earnings & Deductions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: "0 24px 0", marginTop: 12 }}>
            {/* Earnings */}
            <div style={{ paddingRight: 12 }}>
              <div style={{ background: "#2e6b4f", color: "#fff", fontWeight: 700, fontSize: 12, padding: "7px 12px", textAlign: "center", borderRadius: 4, marginBottom: 4, letterSpacing: 1 }}>
                EARNINGS
              </div>
              <EarningRow label="Basic Salary" value={slip.basicSalary} />
              <EarningRow label="House Rent (40%)" value={houseRent(slip.basicSalary)} />
              <EarningRow label="Medical Allow. (10%)" value={medicalAllow(slip.basicSalary)} />
              <EarningRow label="Conveyance Allow." value={slip.conveyance} />
              <EarningRow label="Overtime / Bonus" value={slip.overtime} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#e8f4e8", borderRadius: 4, marginTop: 4, fontWeight: 700 }}>
                <span style={{ color: "#2e6b4f" }}>GROSS EARNINGS</span>
                <span style={{ color: "#2e6b4f" }}>{fmt(gross)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div style={{ paddingLeft: 12 }}>
              <div style={{ background: "#A32D2D", color: "#fff", fontWeight: 700, fontSize: 12, padding: "7px 12px", textAlign: "center", borderRadius: 4, marginBottom: 4, letterSpacing: 1 }}>
                DEDUCTIONS
              </div>
              <EarningRow label="Income Tax (5%)" value={incomeTax(slip.basicSalary)} />
              <EarningRow label="EOBI (Employee 1%)" value={eobiEmployee(slip.basicSalary)} />
              <EarningRow label="EOBI (Employer 2%)" value={eobiEmployer(slip.basicSalary)} />
              <EarningRow label="Absent Deduction" value={absentDeduct(slip)} />
              <EarningRow label="Other Deduction" value={slip.otherDeduction} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#fde8e8", borderRadius: 4, marginTop: 4, fontWeight: 700 }}>
                <span style={{ color: "#A32D2D" }}>TOTAL DEDUCTIONS</span>
                <span style={{ color: "#A32D2D" }}>{fmt(deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", margin: "16px 24px 0", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ background: "#7C1F1F", color: "#fff", padding: "14px 20px", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              💰 NET PAY (PKR)
            </div>
            <div style={{ background: "#A32D2D", color: "#fff", padding: "14px 20px", fontWeight: 800, fontSize: 22, textAlign: "center" }}>
              {fmt(net)}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "28px 40px 16px", gap: 40, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontStyle: "italic" }}>Employee Signature: ________________________</div>
              <div style={{ fontSize: 12, marginTop: 16, fontStyle: "italic" }}>Name: ______________________</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontStyle: "italic" }}>Authorized Signatory: ________________________</div>
              <div style={{ fontSize: 12, marginTop: 16, fontStyle: "italic" }}>Name & Stamp: __________________</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: "#f5f5f5", borderTop: "1px solid #e0e0e0", padding: "8px 24px", textAlign: "center", fontSize: 11, color: "#888", borderRadius: "0 0 8px 8px" }}>
            ⚠ This is a computer-generated salary slip. For queries contact HR department.
          </div>
        </div>
      )}

      {!slip.employeeId && (
        <div className="card empty" style={{ marginTop: 0 }}>
          Select an employee and month above to generate the salary slip.
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          header { display: none !important; }
          main { padding: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ children, color = "#A32D2D" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: color, color: "#fff", fontWeight: 700, fontSize: 12, padding: "7px 24px", textAlign: "center", letterSpacing: 1, marginTop: 8 }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontWeight: 600, minWidth: 160, fontSize: 12 }}>{label}:</span>
      <span style={{ fontSize: 12 }}>{value || "—"}</span>
    </div>
  );
}

function AttRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eaf4ee" }}>
      <span style={{ fontWeight: 600, fontSize: 12 }}>{label}:</span>
      <span style={{ fontWeight: 700, color, fontSize: 13 }}>{value}</span>
    </div>
  );
}

function EarningRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid #f3f3f3", fontSize: 12 }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString("en-PK")}</span>
    </div>
  );
}
