import Link from "next/link";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { desc } from "drizzle-orm";

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
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Employees</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>{rows.length} record{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/employees/form/print" className="btn btn-print">🖨 Print Blank Form</Link>
          <Link href="/employees/new" className="btn btn-primary">＋ Add Employee</Link>
        </div>
      </div>

      {dbError && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 16 }}>
          <strong>Database not ready:</strong> {dbError}
          <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
            Run <code>npx drizzle-kit push</code> to create tables.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 && !dbError ? (
          <div className="empty">
            No employees yet. Click <strong>＋ Add Employee</strong> to create the first record.
          </div>
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
                <th style={{ textAlign: "right" }}>Actions</th>
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
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 12, fontWeight: 600 }}>
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
                    <span className={`badge ${e.status === "active" ? "badge-active" : "badge-inactive"}`}>
                      {e.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/employees/${e.id}`} className="btn" style={{ padding: "5px 10px", fontSize: 12 }}>View</Link>
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
