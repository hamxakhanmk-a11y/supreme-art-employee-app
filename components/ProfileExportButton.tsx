"use client";
import { downloadCSV } from "@/lib/csv";

export default function ProfileExportButton({ employee }: { employee: any }) {
  const exportCSV = () => {
    const rows: [string, any][] = [
      ["Employee ID", employee.employeeId],
      ["First Name", employee.firstName],
      ["Last Name", employee.lastName],
      ["Father's Name", employee.fatherName],
      ["Date of Birth", employee.dob],
      ["Gender", employee.gender],
      ["Marital Status", employee.maritalStatus],
      ["Nationality", employee.nationality],
      ["Religion", employee.religion],
      ["Blood Group", employee.bloodGroup],
      ["CNIC", employee.cnic],
      ["CNIC Expiry", employee.cnicExpiry],
      ["Passport Number", employee.passportNumber],
      ["Passport Expiry", employee.passportExpiry],
      ["EOBI Number", employee.ssiNumber],
      ["ESSI Number", employee.ubiNumber],
      ["Phone", employee.phone],
      ["Alternate Phone", employee.altPhone],
      ["Email", employee.email],
      ["Current Address", employee.currentAddress],
      ["Permanent Address", employee.permanentAddress],
      ["City", employee.city],
      ["Emergency Name", employee.emergencyName],
      ["Emergency Relationship", employee.emergencyRelation],
      ["Emergency Phone", employee.emergencyPhone],
      ["Designation", employee.designation],
      ["Department", employee.department],
      ["Joining Date", employee.joiningDate],
      ["Employment Type", employee.employmentType],
      ["Reporting Manager", employee.reportingManager],
      ["Work Location", employee.workLocation],
      ["Shift", employee.shift],
      ["Status", employee.status],
      ["Basic Salary", employee.basicSalary],
      ["Bank Name", employee.bankName],
      ["Account Title", employee.accountTitle],
      ["Account Number", employee.accountNumber],
      ["IBAN", employee.iban],
      ["Notes", employee.notes],
    ];
    downloadCSV(`employee-${employee.employeeId}`, ["Field", "Value"], rows);
  };

  return <button onClick={exportCSV} className="btn">⬇ Excel (CSV)</button>;
}
