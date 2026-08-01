import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import FileFormClient from "./FileFormClient";
import { isViewOnly } from "@/lib/pageGuard";
import { ViewOnlyNotice } from "@/components/MeProvider";

export const dynamic = "force-dynamic";

export default async function FileFormPage() {
  if (await isViewOnly("forms")) return <ViewOnlyNotice />;
  const emps = await db.select({
    id: employees.id, employeeId: employees.employeeId,
    firstName: employees.firstName, lastName: employees.lastName,
    designation: employees.designation,
  }).from(employees).where(eq(employees.status, "active")).orderBy(asc(employees.firstName));

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>File a Signed Form</h1>
        <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
          Upload a scan or photo of a signed Leave / Half-Day / Other form. Tied to the employee&apos;s profile under
          <strong> Documents → Filed Forms</strong>.
        </p>
      </div>
      <FileFormClient employees={emps} />
    </div>
  );
}
