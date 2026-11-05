import Link from "next/link";
import EmployeeForm from "@/components/EmployeeForm";
import { employeeFieldAccess } from "@/lib/employeeAccess";
import { isViewOnly } from "@/lib/pageGuard";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  if (await isViewOnly("employees.add")) return <ViewOnlyNotice />;
  const access = await employeeFieldAccess();
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/employees" className="btn btn-sm btn-back">← Back to Employees</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 4px" }}>Add New Employee</h1>
        <p style={{ color: "#888", fontSize: 13 }}>Fill in the employee details across all sections.</p>
      </div>
      <EmployeeForm mode="create" hide={{ salary: !access.editSalary, banking: !access.editBanking }} />
    </div>
  );
}
