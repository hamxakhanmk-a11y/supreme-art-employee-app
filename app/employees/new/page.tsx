import Link from "next/link";
import EmployeeForm from "@/components/EmployeeForm";
import { isViewOnly } from "@/lib/pageGuard";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  if (await isViewOnly()) return <ViewOnlyNotice />;
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/employees" style={{ fontSize: 12, color: "var(--primary)" }}>← Back to Employees</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 4px" }}>Add New Employee</h1>
        <p style={{ color: "#888", fontSize: 13 }}>Fill in the employee details across all sections.</p>
      </div>
      <EmployeeForm mode="create" />
    </div>
  );
}
