"use client";
import { downloadRegisterXlsx } from "@/lib/xlsx";

// Section-header rows (blank value) act as a visual divider — same grouping
// as the print form and the profile tabs.
const section = (title: string): [string, string] => [`— ${title} —`, ""];

export default function ProfileExportButton({ employee }: { employee: any }) {
  const exportXlsx = () => {
    const rows: [string, any][] = [
      ["Employee ID", employee.employeeId],

      section("PERSONAL"),
      ["First Name", employee.firstName],
      ["Last Name", employee.lastName],
      ["Father's Name", employee.fatherName],
      ["Date of Birth", employee.dob],
      ["Gender", employee.gender],
      ["Marital Status", employee.maritalStatus],
      ["Nationality", employee.nationality],
      ["Religion", employee.religion],
      ["Blood Group", employee.bloodGroup],

      section("IDENTIFICATION"),
      ["CNIC", employee.cnic],
      ["CNIC Expiry", employee.cnicExpiry],
      ["Passport Number", employee.passportNumber],
      ["Passport Expiry", employee.passportExpiry],
      ["EOBI Number", employee.ssiNumber],
      ["EOBI Expiry", employee.ssiExpiry],
      ["ESSI Number", employee.ubiNumber],
      ["ESSI Expiry", employee.ubiExpiry],

      section("CONTACT"),
      ["Phone", employee.phone],
      ["Alternate Phone", employee.altPhone],
      ["Email", employee.email],
      ["Current Address", employee.currentAddress],
      ["Permanent Address", employee.permanentAddress],
      ["City", employee.city],
      ["Emergency Name", employee.emergencyName],
      ["Emergency Relationship", employee.emergencyRelation],
      ["Emergency Phone", employee.emergencyPhone],

      section("JOB"),
      ["Designation", employee.designation],
      ["Department", employee.department],
      ["Joining Date", employee.joiningDate],
      ["Employment Type", employee.employmentType],
      ["Reporting Manager", employee.reportingManager],
      ["Work Location", employee.workLocation],
      ["Shift", employee.shift],
      ["Status", employee.status],
      ["Contract Expiry", employee.contractExpiry],
      ["Resignation Date", employee.resignationDate],
      ["KPI Template", employee.kpiTemplate],

      section("SALARY"),
      ["Basic Salary (PKR)", employee.basicSalary],
      ["Conveyance (PKR)", employee.conveyance],
      ["Accommodation (PKR)", employee.accommodation],
      ["Food (PKR)", employee.food],
      ["House Rent %", employee.houseRentPercent],
      ["Medical %", employee.medicalPercent],
      ["Income Tax %", employee.incomeTaxPercent],
      ["Income Tax Amount (PKR)", employee.incomeTaxAmount],
      ["EOBI Employee %", employee.eobiEmployeePercent],
      ["EOBI Employee Amount (PKR)", employee.eobiEmployeeAmount],
      ["EOBI Employer %", employee.eobiEmployerPercent],
      ["EOBI Employer Amount (PKR)", employee.eobiEmployerAmount],
      ["Minimum Wage (PKR)", employee.minimumWage],
      ["ESSI Contribution (PKR)", employee.essiContribution],

      section("BANKING"),
      ["Bank Name", employee.bankName],
      ["Account Title", employee.accountTitle],
      ["Account Number", employee.accountNumber],
      ["IBAN", employee.iban],

      section("NOTES"),
      ["Notes", employee.notes],
    ];
    downloadRegisterXlsx({
      filename: `employee-${employee.employeeId}`,
      sheetName: "Profile",
      title: `${employee.firstName || ""} ${employee.lastName || ""} — Employee Profile`.trim(),
      headers: ["Field", "Value"],
      colWidths: [26, 34],
      freezeCols: 0,
      // CNIC/phone/account numbers etc. are already stored as strings and
      // passed straight through (not run through Number()), so ExcelJS
      // writes them as text cells — that's what stops Excel from
      // reinterpreting a long digit string as a number and mangling it into
      // scientific notation.
      rows,
    });
  };

  return <button onClick={exportXlsx} className="btn">⬇ Excel</button>;
}
