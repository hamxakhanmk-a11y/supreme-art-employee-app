"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Req = {
  id: number; employeeId: number; leaveTypeId: number;
  startDate: string; endDate: string; days: number;
  reason: string | null; status: string;
  decidedAt: Date | string | null; decidedBy: string | null; decisionNote: string | null;
  createdAt: Date | string;
};
type Emp = { id: number; employeeId: string; firstName: string; lastName: string; designation: string | null; photoUrl: string | null };
type LT = { id: number; name: string; color: string | null; isPaid: boolean };

const STATUS = {
  pending:  { label: "Pending",  color: "var(--warning)", bg: "var(--warning-bg)" },
  approved: { label: "Approved", color: "var(--success)", bg: "var(--success-bg)" },
  rejected: { label: "Rejected", color: "var(--danger)",  bg: "var(--danger-bg)"  },
} as const;

export default function LeaveRequestsClient({ initial, employees, leaveTypes }: { initial: Req[]; employees: Emp[]; leaveTypes: LT[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState<Req[]>(initial);
  const [query, setQuery] = useState("");

  const empById = new Map(employees.map(e => [e.id, e]));
  const typeById = new Map(leaveTypes.map(t => [t.id, t]));

  const counts = {
    pending:  requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  const filtered = requests.filter(r => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const e = empById.get(r.employeeId);
    const t = typeById.get(r.leaveTypeId);
    return [
      e?.firstName, e?.lastName, e?.employeeId, `${e?.firstName} ${e?.lastName}`,
      t?.name, r.status, r.reason,
    ].some(f => f && String(f).toLowerCase().includes(q));
  });

  const decide = async (r: Req, status: "approved" | "rejected") => {
    const note = status === "rejected" ? prompt("Reason for rejection (optional):") || "" : "";
    const res = await fetch(`/api/leave/requests/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, decisionNote: note }),
    });
    if (res.ok) {
      const u = await res.json();
      setRequests(prev => prev.map(x => x.id === r.id ? u : x));
      router.refresh();
    }
  };

  const remove = async (r: Req) => {
    if (!confirm("Delete this leave request?")) return;
    const res = await fetch(`/api/leave/requests/${r.id}`, { method: "DELETE" });
    if (res.ok) setRequests(prev => prev.filter(x => x.id !== r.id));
  };

  return (
    <>
      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 16 }}>
        {Object.entries(STATUS).map(([k, v]) => (
          <div key={k} className="card" style={{ background: v.bg, borderColor: `${v.color}33`, textAlign: "center", padding: "0.9rem 0.5rem" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: v.color }}>{counts[k as keyof typeof counts]}</div>
            <div style={{ fontSize: 11, color: v.color, fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{v.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="no-print" style={{ marginBottom: 12, position: "relative" }}>
        <input
          type="text"
          placeholder="🔍  Search by employee name, ID, leave type, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", padding: "11px 16px", fontSize: 13 }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: 4,
          }}>✕</button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div className="empty">{query ? `No matches for "${query}"` : "No leave requests yet."}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }} className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const e = empById.get(r.employeeId);
                const t = typeById.get(r.leaveTypeId);
                const s = STATUS[r.status as keyof typeof STATUS] || { label: r.status, color: "#888", bg: "#f3f3f3" };
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {e?.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.photoUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }} />
                        ) : e ? (
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary), var(--primary-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                            {e.firstName[0]}{e.lastName[0]}
                          </div>
                        ) : null}
                        <div>
                          <div style={{ fontWeight: 600 }}>{e ? `${e.firstName} ${e.lastName}` : `Emp #${r.employeeId}`}</div>
                          <div style={{ fontSize: 11, color: "#888" }}>{e?.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {t ? (
                        <span className="badge" style={{ background: `${t.color || "#888"}22`, color: t.color || "#555" }}>
                          {t.name}
                        </span>
                      ) : `Type #${r.leaveTypeId}`}
                    </td>
                    <td>{new Date(r.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td>{new Date(r.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td><strong>{r.days}</strong></td>
                    <td style={{ color: "#666", maxWidth: 200 }}>{r.reason || "—"}</td>
                    <td>
                      <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      {r.decidedBy && r.status !== "pending" && (
                        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>by {r.decidedBy}</div>
                      )}
                    </td>
                    <td className="no-print" style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        {r.status === "pending" && (
                          <>
                            <button onClick={() => decide(r, "approved")} className="btn btn-success" style={{ padding: "4px 10px", fontSize: 12 }}>✓ Approve</button>
                            <button onClick={() => decide(r, "rejected")} className="btn btn-danger-soft" style={{ padding: "4px 10px", fontSize: 12 }}>✕ Reject</button>
                          </>
                        )}
                        {e && <Link href={`/employees/${e.id}/leave`} className="btn" style={{ padding: "4px 10px", fontSize: 12 }}>📋</Link>}
                        <button onClick={() => remove(r)} className="btn btn-danger-soft" style={{ padding: "4px 10px", fontSize: 12 }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
