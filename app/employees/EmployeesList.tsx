"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";
import EmployeesToolbar from "./EmployeesToolbar";
import PrintHeader from "@/components/PrintHeader";

type Row = {
  id: number; employeeId: string;
  firstName: string; lastName: string;
  fatherName: string | null;
  designation: string | null; department: string | null;
  cnic: string | null; phone: string | null; email: string | null;
  joiningDate: string | null;
  status: string;
  photoUrl: string | null;
};

export default function EmployeesList({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => {
      const fields = [
        e.firstName, e.lastName, e.employeeId, e.designation, e.department,
        e.cnic, e.phone, e.email, e.fatherName,
        `${e.firstName} ${e.lastName}`,
      ];
      return fields.some((f) => f && String(f).toLowerCase().includes(q));
    });
  }, [rows, query]);

  return (
    <>
      <PrintHeader title="Employee Directory" subtitle={`${filtered.length} record${filtered.length !== 1 ? "s" : ""}`} />
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Employees</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {filtered.length} of {rows.length} record{rows.length !== 1 ? "s" : ""}
            {query && <span style={{ marginLeft: 6, color: "var(--primary)" }}>· filtered by "{query}"</span>}
          </p>
        </div>
        <EmployeesToolbar rows={filtered} />
      </div>

      {/* Search bar */}
      <div className="no-print" style={{ marginBottom: 14, position: "relative" }}>
        <input
          type="text"
          placeholder="🔍  Search by name, ID, CNIC, designation, department, phone, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", padding: "11px 16px", fontSize: 13 }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", color: "#888", cursor: "pointer",
              fontSize: 14, padding: 4,
            }}
            title="Clear search"
          >✕</button>
        )}
      </div>

      <div className="table-summary no-print">
        <strong>{filtered.length}</strong> rows · <strong>{rows.filter(r => r.status === "active").length}</strong> active · <strong>{rows.filter(r => r.status === "inactive").length}</strong> inactive
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div className="empty">
            {query ? <>No employees match "<strong>{query}</strong>".</> : <>No employees yet.</>}
          </div>
        ) : (
          <table className="emp-dir-table">
            <thead>
              <tr>
                <th className="col-photo" style={{ width: 60 }}>Photo</th>
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
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="col-photo">
                    {e.photoUrl ? (
                      <Image src={e.photoUrl} alt={e.firstName} width={52} height={52} className="avatar" style={{ width: 52, height: 52, objectFit: "cover" }} loading="lazy" />
                    ) : (
                      <div className="avatar" style={{ width: 52, height: 52, background: "linear-gradient(135deg, var(--brand), var(--brand-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
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
                    <Link href={`/employees/${e.id}`}
                      style={{
                        padding: "7px 16px", fontSize: 12, fontWeight: 700,
                        background: "var(--primary)", color: "#fff",
                        borderRadius: 8, textDecoration: "none",
                        boxShadow: "0 2px 6px rgba(163,45,45,0.25)",
                        letterSpacing: 0.3,
                      }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx global>{`
        @media print {
          /* Employee directory prints landscape so all columns fit on one row.
             Drop the photo column and shrink padding so CNIC / Phone / Status
             don't get clipped at the right edge. */
          @page { size: A4 landscape; margin: 10mm 8mm; }
          .emp-dir-table { font-size: 9.5pt; table-layout: fixed; width: 100%; }
          .emp-dir-table .col-photo { display: none !important; }
          .emp-dir-table th, .emp-dir-table td { padding: 5px 6px !important; word-break: break-word; }
          .emp-dir-table th { font-size: 8pt !important; letter-spacing: 0.04em; }
        }
      `}</style>
    </>
  );
}

