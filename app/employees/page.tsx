import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { desc } from "drizzle-orm";
import EmployeesList from "./EmployeesList";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  let rows: any[] = [];
  let dbError: string | null = null;
  try {
    const result = await db.select().from(employees).orderBy(desc(employees.createdAt));
    rows = result.map((r) => ({
      id: r.id, employeeId: r.employeeId,
      firstName: r.firstName, lastName: r.lastName,
      fatherName: r.fatherName,
      designation: r.designation, department: r.department,
      cnic: r.cnic, phone: r.phone, email: r.email,
      joiningDate: r.joiningDate, status: r.status,
      resignationDate: r.resignationDate,
      photoUrl: r.photoUrl,
    }));
  } catch (e: any) {
    dbError = e?.message ?? "DB error";
  }

  return (
    <div className="fade-up">
      {dbError && (
        <div className="card no-print" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Database not ready:</strong> {dbError}
        </div>
      )}
      <EmployeesList rows={rows} />
    </div>
  );
}
