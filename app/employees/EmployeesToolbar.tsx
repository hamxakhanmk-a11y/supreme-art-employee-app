"use client";
import Link from "next/link";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import type { employees } from "@/lib/schema";

type Row = typeof employees.$inferSelect & { exitReason: string | null };

const HEADERS = [
  "Employee ID",
  // Personal
  "First Name", "Last Name", "Father's Name", "Date of Birth", "Gender", "Marital Status", "Nationality", "Religion", "Blood Group",
  // Identification
  "CNIC", "CNIC Expiry", "Passport Number", "Passport Expiry", "EOBI Number", "EOBI Expiry", "ESSI Number", "ESSI Expiry",
  // Contact
  "Phone", "Alternate Phone", "Email", "Current Address", "Permanent Address", "City",
  "Emergency Name", "Emergency Relationship", "Emergency Phone",
  // Job
  "Designation", "Department", "Joining Date", "Employment Type", "Reporting Manager", "Work Location", "Shift",
  "Status", "Contract Expiry", "Resignation Date", "Exit Reason", "KPI Template",
  // Salary
  "Basic Salary (PKR)", "Conveyance (PKR)", "Accommodation (PKR)", "Food (PKR)",
  "House Rent %", "Medical %", "Income Tax %", "Income Tax Amount (PKR)",
  "EOBI Employee %", "EOBI Employee Amount (PKR)", "EOBI Employer %", "EOBI Employer Amount (PKR)",
  "Minimum Wage (PKR)", "ESSI Contribution (PKR)",
  // Banking
  "Bank Name", "Account Title", "Account Number", "IBAN",
  // Notes
  "Notes",
];

// Wide columns for free-text fields, narrower for codes/percentages, default
// otherwise — wide enough that a real .xlsx's own header text doesn't get
// clipped either (unlike plain CSV, which carries no column-width info at
// all and always opens at Excel's narrow default).
function widthFor(h: string): number {
  if (h.includes("Address") || h === "Notes" || h === "Email") return 28;
  if (h === "First Name" || h === "Last Name" || h === "Father's Name" || h.includes("Name") || h.includes("Manager")) return 18;
  if (h.includes("%")) return 10;
  if (h === "Employee ID") return 14;
  return 15;
}
const COL_WIDTHS = HEADERS.map(widthFor);

export default function EmployeesToolbar({ rows }: { rows: Row[] }) {
  const exportXlsx = () => {
    downloadRegisterXlsx({
      filename: "employees",
      sheetName: "Employees",
      title: `Employee Directory — ${rows.length} record${rows.length === 1 ? "" : "s"}`,
      headers: HEADERS,
      colWidths: COL_WIDTHS,
      freezeCols: 1,
      // CNIC/phone/account numbers etc. are stored as strings on purpose —
      // passed straight through (not run through Number()) so ExcelJS writes
      // them as text cells. That's what stops Excel from "helpfully"
      // reinterpreting a 13-digit CNIC as a number and mangling it into
      // scientific notation.
      rows: rows.map(r => [
        r.employeeId,
        r.firstName, r.lastName, r.fatherName || "", r.dob || "", r.gender || "", r.maritalStatus || "", r.nationality || "", r.religion || "", r.bloodGroup || "",
        r.cnic || "", r.cnicExpiry || "", r.passportNumber || "", r.passportExpiry || "", r.ssiNumber || "", r.ssiExpiry || "", r.ubiNumber || "", r.ubiExpiry || "",
        r.phone || "", r.altPhone || "", r.email || "", r.currentAddress || "", r.permanentAddress || "", r.city || "",
        r.emergencyName || "", r.emergencyRelation || "", r.emergencyPhone || "",
        r.designation || "", r.department || "", r.joiningDate || "", r.employmentType || "", r.reportingManager || "", r.workLocation || "", r.shift || "",
        r.status, r.contractExpiry || "", r.resignationDate || "", r.exitReason || "", r.kpiTemplate || "",
        r.basicSalary ?? "", r.conveyance ?? "", r.accommodation ?? "", r.food ?? "",
        r.houseRentPercent ?? "", r.medicalPercent ?? "", r.incomeTaxPercent ?? "", r.incomeTaxAmount ?? "",
        r.eobiEmployeePercent ?? "", r.eobiEmployeeAmount ?? "", r.eobiEmployerPercent ?? "", r.eobiEmployerAmount ?? "",
        r.minimumWage ?? "", r.essiContribution ?? "",
        r.bankName || "", r.accountTitle || "", r.accountNumber || "", r.iban || "",
        r.notes || "",
      ]),
    });
  };

  // Bulk print: one full detail form per employee, in whatever's currently
  // filtered/searched here — same fields as the single-employee Print
  // Profile, not the compact table. Built from the ids so the print-all page
  // can pull each employee's full record itself.
  const printHref = `/employees/print-all?ids=${rows.map(r => r.id).join(",")}`;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {rows.length > 0 ? (
        <Link href={printHref} className="btn btn-print">🖨 Print</Link>
      ) : (
        <button className="btn btn-print" disabled>🖨 Print</button>
      )}
      <button onClick={exportXlsx} className="btn" disabled={!rows.length}>⬇ Excel</button>
      <Link href="/employees/form/print" className="btn">📄 Blank Form</Link>
      <Link href="/employees/new" className="btn btn-primary">＋ Add Employee</Link>
    </div>
  );
}
