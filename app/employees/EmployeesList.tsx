"use client";
import Link from "next/link";
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
              {filtered.map((e) => (
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
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <TextPill href={`/employees/${e.id}/attendance`} color="#1D4ED8">Attendance</TextPill>
                      <TextPill href={`/employees/${e.id}/leave`} color="#D97706">Leave</TextPill>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function TextPill({ href, color, children }: { href: string; color: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "7px 14px", borderRadius: 8,
        background: color, color: "#fff",
        fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
        boxShadow: `0 2px 6px ${color}55`,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}>
      {children}
    </Link>
  );
}
