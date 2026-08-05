"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import EmployeesToolbar from "./EmployeesToolbar";
import PrintHeader from "@/components/PrintHeader";
import { useCanEdit } from "@/components/MeProvider";

type Row = {
  id: number; employeeId: string;
  firstName: string; lastName: string;
  fatherName: string | null;
  designation: string | null; department: string | null;
  cnic: string | null; phone: string | null; email: string | null;
  joiningDate: string | null;
  status: string;
  resignationDate: string | null;
  photoUrl: string | null;
};

type StatusFilter = "active" | "exited" | "all";

export default function EmployeesList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const canEdit = useCanEdit("employees");
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [busyId, setBusyId] = useState<number | null>(null);
  // Exit dialog — lets the owner pick the exit date (today or a past date).
  const [exitFor, setExitFor] = useState<Row | null>(null);
  const [exitDate, setExitDate] = useState(today);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
      if (statusFilter === "active" && e.status !== "active") return false;
      if (statusFilter === "exited" && e.status === "active") return false;
      if (!q) return true;
      const fields = [
        e.firstName, e.lastName, e.employeeId, e.designation, e.department,
        e.cnic, e.phone, e.email, e.fatherName,
        `${e.firstName} ${e.lastName}`,
      ];
      return fields.some((f) => f && String(f).toLowerCase().includes(q));
    });
  }, [rows, query, statusFilter]);

  function openExit(e: Row) {
    setExitDate(today);
    setExitFor(e);
  }

  // Re-activate (no date) or confirm an exit (with the chosen date).
  async function patchStatus(e: Row, status: "resigned" | "active", resignationDate?: string) {
    const verb = status === "resigned" ? "exit" : "re-activate";
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/employees/${e.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "resigned" ? { status, resignationDate } : { status }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Failed"); }
      setExitFor(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || `Could not ${verb} employee`);
    } finally {
      setBusyId(null);
    }
  }

  function reactivate(e: Row) {
    if (!confirm(`Re-activate ${e.firstName} ${e.lastName}? They'll appear in the active lists again.`)) return;
    patchStatus(e, "active");
  }

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

      {/* Status filter */}
      <div className="no-print" style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {([
          ["active", `Active (${rows.filter(r => r.status === "active").length})`],
          ["exited", `Exited (${rows.filter(r => r.status !== "active").length})`],
          ["all", `All (${rows.length})`],
        ] as [StatusFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            style={{
              padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${statusFilter === key ? "var(--primary)" : "var(--border)"}`,
              background: statusFilter === key ? "var(--primary)" : "var(--bg)",
              color: statusFilter === key ? "#fff" : "var(--text)",
            }}
          >{label}</button>
        ))}
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
        <strong>{filtered.length}</strong> rows ·{" "}
        <strong>{rows.filter(r => r.status === "active").length}</strong> active ·{" "}
        <strong>{rows.filter(r => r.status === "inactive").length}</strong> inactive ·{" "}
        <strong>{rows.filter(r => r.status === "resigned").length}</strong> resigned
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
                    <span style={statusBadgeStyle(e.status)}>{e.status}</span>
                    {e.status !== "active" && e.resignationDate && (
                      <span style={{ display: "block", fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>
                        {new Date(e.resignationDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </td>
                  <td className="no-print" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {canEdit && (e.status === "active" ? (
                      <button
                        onClick={() => openExit(e)}
                        disabled={busyId === e.id}
                        title="Mark as exited — keeps all past records"
                        style={rowBtn("#A32D2D", true)}
                      >{busyId === e.id ? "…" : "Exit"}</button>
                    ) : (
                      <button
                        onClick={() => reactivate(e)}
                        disabled={busyId === e.id}
                        title="Bring back to active lists"
                        style={rowBtn("#15803D", true)}
                      >{busyId === e.id ? "…" : "Re-activate"}</button>
                    ))}
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

      {exitFor && (
        <div onClick={() => busyId == null && setExitFor(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={ev => ev.stopPropagation()} className="card" style={{ maxWidth: 420, width: "100%", padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Exit {exitFor.firstName} {exitFor.lastName}</div>
            <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 0, lineHeight: 1.55 }}>
              They&apos;ll be removed from attendance, salary and other active lists. All past records are kept
              and stay visible in reports.
            </p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>Exit date</label>
            <input type="date" value={exitDate} max={today} onChange={e => setExitDate(e.target.value)}
              className="auth-input" style={{ width: "100%" }} />
            <span style={{ display: "block", fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
              Pick today or any past date. It can&apos;t be in the future.
            </span>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => setExitFor(null)} disabled={busyId != null} className="btn">Cancel</button>
              <button onClick={() => patchStatus(exitFor, "resigned", exitDate)} disabled={busyId != null || !exitDate}
                className="btn" style={{ background: "#A32D2D", color: "#fff" }}>
                {busyId != null ? "Exiting…" : "Confirm exit"}
              </button>
            </div>
          </div>
        </div>
      )}

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

function rowBtn(color: string, outline: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", fontSize: 12, fontWeight: 700, marginRight: 8,
    borderRadius: 8, cursor: "pointer", letterSpacing: 0.3,
    border: `1px solid ${color}`,
    background: outline ? "var(--bg)" : color,
    color: outline ? color : "#fff",
  };
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const map: Record<string, { fg: string; bg: string; border: string }> = {
    active:   { fg: "#15803D", bg: "#dcf5dc", border: "#a9e3a9" },
    inactive: { fg: "#475569", bg: "#e2e8f0", border: "#cbd5e1" },
    resigned: { fg: "#A32D2D", bg: "#fcdada", border: "#f3c2c2" },
  };
  const c = map[status] || map.inactive;
  return {
    padding: "3px 10px", borderRadius: 999,
    background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "capitalize",
    display: "inline-block",
  };
}

