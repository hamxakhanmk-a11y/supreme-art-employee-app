"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCanEdit, ViewOnlyNotice } from "@/components/MeProvider";

// Link the users enrolled on the fingerprint device to ERP employees. Device
// user numbers don't follow SAPL numbers, so each link is confirmed by hand;
// the page only suggests a match by name.

type DeviceUser = {
  deviceSerial: string; deviceUserId: string; name: string | null; privilege: string | null;
  employeeId: number | null; lastPunchAt: string | null; punches30d: number | null;
};
type Emp = {
  id: number; employeeId: string; firstName: string; lastName: string;
  department: string | null; status: string;
};
type Show = "all" | "unlinked" | "linked";

const key = (u: DeviceUser) => `${u.deviceSerial}/${u.deviceUserId}`;
const fullName = (e: Emp) => `${e.firstName} ${e.lastName}`.replace(/\s+/g, " ");

// --- Name matching (suggestions only) ---

const MUHAMMAD = new Set(["m", "md", "mohd", "muhammad", "mohammad", "muhammed", "mohammed", "mohamad"]);
// Names shared by many staff: they count a little, never enough on their own.
const COMMON = new Set(["muhammad", "khan", "ali", "ahmad", "ahmed", "shah", "ullah", "hussain", "syed", "malik", "jan", "gul"]);

function tokens(name: string) {
  return name.toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ")
    .filter(Boolean)
    .map(t => (MUHAMMAD.has(t) ? "muhammad" : t.replace(/(.)\1+/g, "$1")));
}

function close(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  // One edit apart (e.g. Shehzad / Shahzad).
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function score(deviceName: string, emp: Emp) {
  const empTokens = tokens(fullName(emp));
  let s = 0;
  for (const t of new Set(tokens(deviceName))) {
    if (empTokens.some(e => close(t, e))) s += COMMON.has(t) ? 0.3 : 1;
  }
  return s;
}

function suggest(deviceName: string | null, candidates: Emp[]): Emp | null {
  if (!deviceName) return null;
  let best: Emp | null = null, bestScore = 0, second = 0;
  for (const e of candidates) {
    const s = score(deviceName, e);
    if (s > bestScore) { second = bestScore; bestScore = s; best = e; }
    else if (s > second) second = s;
  }
  // Needs one distinctive name in common, and no tie.
  return bestScore >= 1 && bestScore > second ? best : null;
}

function day(iso: string | null) {
  return iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "—";
}

export default function DeviceUsersPage() {
  const canEdit = useCanEdit("attendance");
  const [users, setUsers] = useState<DeviceUser[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState<Show>("unlinked");
  const [recentOnly, setRecentOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/device-users", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setUsers(j.users);
      setEmps(j.employees);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const empById = useMemo(() => new Map(emps.map(e => [e.id, e])), [emps]);
  // employee id -> the device user it's linked to, per device.
  const linkedTo = useMemo(() => {
    const m = new Map<string, DeviceUser>();
    for (const u of users) if (u.employeeId !== null) m.set(`${u.deviceSerial}/${u.employeeId}`, u);
    return m;
  }, [users]);
  const activeEmps = useMemo(() => emps.filter(e => e.status === "active"), [emps]);

  const suggestions = useMemo(() => {
    const out = new Map<string, Emp>();
    for (const u of users) {
      if (u.employeeId !== null) continue;
      const free = activeEmps.filter(e => !linkedTo.has(`${u.deviceSerial}/${e.id}`));
      const s = suggest(u.name, free);
      if (s) out.set(key(u), s);
    }
    return out;
  }, [users, activeEmps, linkedTo]);

  const linkedCount = users.filter(u => u.employeeId !== null).length;
  const unlinkedEmps = activeEmps.filter(e => !users.some(u => u.employeeId === e.id));

  const q = search.trim().toLowerCase();
  const rows = users.filter(u => {
    if (show === "unlinked" && u.employeeId !== null) return false;
    if (show === "linked" && u.employeeId === null) return false;
    if (recentOnly && !u.punches30d) return false;
    if (!q) return true;
    const emp = u.employeeId !== null ? empById.get(u.employeeId) : undefined;
    return [u.deviceUserId, u.name ?? "", emp ? `${fullName(emp)} ${emp.employeeId}` : ""].join(" ").toLowerCase().includes(q);
  });

  async function link(u: DeviceUser, employeeId: number | null) {
    const k = key(u);
    setSaving(k);
    setRowMsg(m => ({ ...m, [k]: "" }));
    try {
      const res = await fetch("/api/attendance/device-users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSerial: u.deviceSerial, deviceUserId: u.deviceUserId, employeeId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Save failed");
      setUsers(list => list.map(x => (key(x) === k ? { ...x, employeeId } : x)));
      setRowMsg(m => ({ ...m, [k]: "Saved ✓" }));
      setTimeout(() => setRowMsg(m => ({ ...m, [k]: "" })), 2000);
    } catch (e) {
      setRowMsg(m => ({ ...m, [k]: e instanceof Error ? e.message : "Save failed" }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Device Users</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Link each person enrolled on the fingerprint device to their employee record. Past punches follow the link.
          </p>
        </div>
        <Link href="/attendance/device" className="btn btn-back">← Device Log</Link>
      </div>

      {!canEdit && <ViewOnlyNotice />}
      {error && <div className="card" style={{ padding: 12, marginBottom: 12, color: "#7C1F1F", fontWeight: 600, fontSize: 13 }}>{error}</div>}

      {loaded && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 16 }}>
          <div className="stat"><div className="stat-label">On device</div><div className="stat-value">{users.length}</div></div>
          <div className="stat"><div className="stat-label">Linked</div><div className="stat-value">{linkedCount}</div></div>
          <div className="stat"><div className="stat-label">Not linked</div><div className={`stat-value${users.length - linkedCount ? " warn" : ""}`}>{users.length - linkedCount}</div></div>
          <div className="stat"><div className="stat-label">Active staff not on device</div><div className={`stat-value${unlinkedEmps.length ? " warn" : ""}`}>{unlinkedEmps.length}</div></div>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <select value={show} onChange={e => setShow(e.target.value as Show)} style={{ width: 140 }}>
            <option value="unlinked">Not linked</option>
            <option value="linked">Linked</option>
            <option value="all">All</option>
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID or name" style={{ width: 200 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={recentOnly} onChange={e => setRecentOnly(e.target.checked)} />
            Punched in last 30 days
          </label>
          <span style={{ color: "#888", fontSize: 12.5 }}>{rows.length} shown</span>
        </div>

        {!loaded ? <div className="empty">Loading…</div> : rows.length === 0 ? (
          <div className="empty">{users.length ? "Nothing matches these filters." : "No device users yet. They appear after the bridge's first heartbeat."}</div>
        ) : (
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr><th>Device user</th><th>Name on device</th><th>Last punch</th><th>Punches (30d)</th><th>Employee</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map(u => {
                  const k = key(u);
                  const current = u.employeeId !== null ? empById.get(u.employeeId) : undefined;
                  const s = suggestions.get(k);
                  const msg = rowMsg[k];
                  // Active employees, plus the linked one even if they've since left.
                  const options = current && current.status !== "active" ? [current, ...activeEmps] : activeEmps;
                  return (
                    <tr key={k}>
                      <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {u.deviceUserId}{u.privilege === "admin" && <span className="badge badge-warning" style={{ marginLeft: 6 }}>admin</span>}
                      </td>
                      <td>{u.name || <span style={{ color: "#aaa" }}>—</span>}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", color: "#666" }}>{day(u.lastPunchAt)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{u.punches30d ?? 0}</td>
                      <td>
                        {canEdit ? (
                          <select value={u.employeeId ?? ""} disabled={saving === k} style={{ minWidth: 240 }}
                            onChange={e => link(u, e.target.value ? Number(e.target.value) : null)}>
                            <option value="">— Not linked —</option>
                            {options.map(e => {
                              const other = linkedTo.get(`${u.deviceSerial}/${e.id}`);
                              const elsewhere = other && key(other) !== k;
                              return (
                                <option key={e.id} value={e.id} disabled={!!elsewhere}>
                                  {fullName(e)} · {e.employeeId}{e.status !== "active" ? ` (${e.status})` : ""}{elsewhere ? ` — device user ${other.deviceUserId}` : ""}
                                </option>
                              );
                            })}
                          </select>
                        ) : current ? `${fullName(current)} · ${current.employeeId}` : <span style={{ color: "#aaa" }}>Not linked</span>}
                      </td>
                      <td style={{ whiteSpace: "normal" }}>
                        {msg ? (
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.includes("✓") ? "#166534" : "#7C1F1F" }}>{msg}</span>
                        ) : s && canEdit ? (
                          <button className="btn btn-sm" disabled={saving === k} onClick={() => link(u, s.id)}
                            title="Suggested from the name on the device. Check before linking.">
                            Link {fullName(s)} · {s.employeeId}?
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loaded && unlinkedEmps.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Active staff not linked to the device ({unlinkedEmps.length})</div>
          <p style={{ color: "#888", fontSize: 12.5, margin: "0 0 10px" }}>
            Either they haven&apos;t been linked yet, or they need to be enrolled on the device.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {unlinkedEmps.map(e => (
              <span key={e.id} style={{ fontSize: 12.5, padding: "4px 10px", borderRadius: 999, background: "var(--surface2, #f3f0ea)", border: "1px solid var(--border)" }}>
                {fullName(e)} · {e.employeeId}{e.department ? ` · ${e.department}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
