"use client";
import Link from "next/link";
import { downloadCSV } from "@/lib/csv";

type Row = {
  id: number; employeeId: string;
  firstName: string; lastName: string;
  fatherName: string | null;
  designation: string | null; department: string | null;
  cnic: string | null; phone: string | null; email: string | null;
  joiningDate: string | null;
  status: string;
};

export default function EmployeesToolbar({ rows }: { rows: Row[] }) {
  const exportCSV = () => {
    downloadCSV("employees",
      ["Employee ID", "First Name", "Last Name", "Father's Name", "Designation", "Department", "CNIC", "Phone", "Email", "Joining Date", "Status"],
      rows.map(r => [
        r.employeeId, r.firstName, r.lastName, r.fatherName || "",
        r.designation || "", r.department || "",
        r.cnic || "", r.phone || "", r.email || "",
        r.joiningDate || "", r.status,
      ])
    );
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
