import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { desc } from "drizzle-orm";
import EmployeesToolbar from "./EmployeesToolbar";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  let rows: (typeof employees.$inferSelect)[] = [];
  let dbError: string | null = null;
  try {
    rows = await db.select().from(employees).orderBy(desc(employees.createdAt));
  } catch (e: any) {
    dbError = e?.message ?? "DB error";
  }

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Employees</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>{rows.length} record{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <EmployeesToolbar rows={rows.map(r => ({
          id: r.id, employeeId: r.employeeId,
          firstName: r.firstName, lastName: r.lastName,
          fatherName: r.fatherName, designation: r.designation, department: r.department,
          cnic: r.cnic, phone: r.phone, email: r.email,
          joiningDate: r.joiningDate, status: r.status,
        }))} />
      </div>

      {dbError && (
        <div className="card no-print" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Database not ready:</strong> {dbError}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 && !dbError ? (
          <div className="empty">No employees yet. Click <strong>＋ Add Employee</strong> to create the first record.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Photo</th>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>CNIC</th>
                <th>Phone</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }} className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.photoUrl} alt={e.firstName} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary), var(--primary-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                        {e.firstName[0]}{e.lastName[0]}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--primary)" }}>{e.employeeId}</td>
                  <td>{e.firstName} {e.lastName}</td>
                  <td>{e.designation || "—"}</td>
                  <td>{e.department || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{e.cnic || "—"}</td>
                  <td>{e.phone || "—"}</td>
                  <td>
                    <span className={`badge ${e.status === "active" ? "badge-active" : "badge-inactive"}`}>{e.status}</span>
                  </td>
                  <td className="no-print" style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Link href={`/employees/${e.id}/attendance`} className="btn" title="Attendance history" style={{ padding: "5px 10px", fontSize: 12 }}>📋 History</Link>
                      <Link href={`/employees/${e.id}`} className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 12 }}>View</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
