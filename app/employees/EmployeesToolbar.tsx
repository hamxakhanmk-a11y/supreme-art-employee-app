"use client";
import Link from "next/link";
import { downloadCSV } from "@/lib/csv";
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

export default function EmployeesToolbar({ rows }: { rows: Row[] }) {
  const exportCSV = () => {
    downloadCSV("employees", HEADERS, rows.map(r => [
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
    ]));
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button onClick={() => window.print()} className="btn btn-print">🖨 Print</button>
      <button onClick={exportCSV} className="btn" disabled={!rows.length}>⬇ Excel (CSV)</button>
      <Link href="/employees/form/print" className="btn">📄 Blank Form</Link>
      <Link href="/employees/new" className="btn btn-primary">＋ Add Employee</Link>
    </div>
  );
}
