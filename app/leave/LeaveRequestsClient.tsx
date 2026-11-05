"use client";
import { useState } from "react";
import { usePageState } from "@/lib/usePageState";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PrintHeader from "@/components/PrintHeader";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { matchesQuery, cmpText } from "@/lib/listTools";
import { useCanEdit } from "@/components/MeProvider";

type ReqSort = "recent" | "startNew" | "startOld" | "name" | "days" | "status";
const SORT_OPTIONS: SortOption<ReqSort>[] = [
  { value: "recent", label: "Latest requested" },
  { value: "startNew", label: "Start date (newest)" },
  { value: "startOld", label: "Start date (oldest)" },
  { value: "name", label: "Employee (A–Z)" },
  { value: "days", label: "Days (most first)" },
  { value: "status", label: "Status" },
];

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

export default function LeaveRequestsClient({ initial, employees, leaveTypes, actions }: {
  initial: Req[]; employees: Emp[]; leaveTypes: LT[];
  /** The buttons at the right of the top row; defaults to "Apply Leave". */
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const canDecide = useCanEdit("forms.approve");
  const canDelete = useCanEdit("forms.delete");
  const [requests, setRequests] = useState<Req[]>(initial);
  const [query, setQuery] = usePageState("q", "");
  const [sort, setSort] = usePageState<ReqSort>("sort", "recent");

  const empById = new Map(employees.map(e => [e.id, e]));
  const typeById = new Map(leaveTypes.map(t => [t.id, t]));

  const counts = {
    pending:  requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  const matched = requests.filter(r => {
    const e = empById.get(r.employeeId);
    const t = typeById.get(r.leaveTypeId);
    return matchesQuery(query, [
      e?.firstName, e?.lastName, e?.employeeId, e ? `${e.firstName} ${e.lastName}` : "",
      t?.name, r.status, r.reason,
    ]);
  });

  // "recent" is the order the server sends (newest request first); the rest re-order it.
  const filtered = (() => {
    const nameOf = (r: Req) => { const e = empById.get(r.employeeId); return e ? `${e.firstName} ${e.lastName}` : ""; };
    const cmp: Record<ReqSort, (a: Req, b: Req) => number> = {
      recent: () => 0,
      startNew: (a, b) => b.startDate.localeCompare(a.startDate),
      startOld: (a, b) => a.startDate.localeCompare(b.startDate),
      name: (a, b) => cmpText(nameOf(a), nameOf(b)) || b.startDate.localeCompare(a.startDate),
      days: (a, b) => b.days - a.days || b.startDate.localeCompare(a.startDate),
      status: (a, b) => cmpText(a.status, b.status) || b.startDate.localeCompare(a.startDate),
    };
    return [...matched].sort(cmp[sort]);
  })();

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
      <PrintHeader title="Leave Requests" subtitle={`${filtered.length} request${filtered.length !== 1 ? "s" : ""}`} />
      {/* One row: the counts first, then search and sort; the primary action sits at the right. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {Object.entries(STATUS).map(([k, v]) => (
            <Stat key={k} label={v.label} value={counts[k as keyof typeof counts]} color={v.color} bg={v.bg} />
          ))}
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <SearchBox value={query} onChange={setQuery} placeholder="🔍  Search employee, ID, leave type, status…" width={230} />
          <SortBy options={SORT_OPTIONS} value={sort} onChange={setSort} minWidth={165} />
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          {actions ?? <Link href="/leave/apply" className="btn btn-primary">✍ Apply Leave</Link>}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
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
                          <img src={e.photoUrl} alt="" className="avatar" style={{ width: 52, height: 52 }} />
                        ) : e ? (
                          <div className="avatar" style={{ width: 52, height: 52, background: "linear-gradient(135deg, var(--brand), var(--brand-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
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
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {r.status === "pending" && canDecide && (
                          <>
                            <button onClick={() => decide(r, "approved")} className="btn btn-success btn-sm">Approve</button>
                            <button onClick={() => decide(r, "rejected")} className="btn btn-danger-soft btn-sm">Reject</button>
                          </>
                        )}
                        {e && <Link href={`/employees/${e.id}/leave`} className="btn btn-sm">History</Link>}
                        {canDelete && <button onClick={() => remove(r)} className="btn btn-danger-soft btn-sm">Delete</button>}
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

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "3px 9px", borderRadius: 8, background: bg, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10.5, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}
