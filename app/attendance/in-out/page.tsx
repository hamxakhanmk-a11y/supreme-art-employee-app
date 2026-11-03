"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DeviceDayRow } from "@/app/api/attendance/device-day/route";
import { DUPLICATE_WINDOW_SECONDS } from "@/lib/deviceAttendance";

// Everyone's IN/OUT moves for a day from the fingerprint device, with the time
// spent out between them. Display only: Mark Today and worked hours are
// unchanged.

type NoPunch = { id: number; employeeCode: string; name: string; department: string | null };
type DayData = { date: string; today: boolean; lastSyncAt: string | null; rows: DeviceDayRow[]; noPunches: NoPunch[] };

// The bridge syncs hourly; reloading a hidden tab or every few seconds would
// only wake the database for nothing.
const RELOAD_ON_SHOW_AFTER_MS = 5 * 60_000;

const hhmm = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : "—";

function duration(min: number) {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function todayKarachi() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

export default function InOutPage() {
  const [date, setDate] = useState(todayKarachi);
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const loadedAt = useRef(0);
  // Bumped to reload the same date (Refresh button, tab shown again).
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/attendance/device-day?date=${date}`, { cache: "no-store" })
      .then(async res => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        return j as DayData;
      })
      .then(d => {
        if (cancelled) return;
        setData(d);
        setError("");
        loadedAt.current = Date.now();
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, reloads]);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloads(n => n + 1);
  }, []);

  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > RELOAD_ON_SHOW_AFTER_MS) refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [refresh]);

  const toggle = (key: string) => setOpen(s => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const rows = data?.rows ?? [];
  const q = search.trim().toLowerCase();
  const shown = rows.filter(r =>
    (!flaggedOnly || r.timeline.flags.length > 0) &&
    (!q || `${r.name} ${r.employeeCode ?? ""} ${r.deviceUserIds.join(" ")}`.toLowerCase().includes(q)));
  const inside = rows.filter(r => r.timeline.current === "in").length;
  const flagged = rows.filter(r => r.timeline.flags.length > 0).length;
  const unlinked = rows.filter(r => r.employeeId === null).length;

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Daily In / Out</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13, maxWidth: 760 }}>
            From the fingerprint device. The first punch of the day is IN, and each punch after it switches between OUT and IN.
            Taps within {DUPLICATE_WINDOW_SECONDS / 60} minutes count once. Doesn&apos;t change Mark Today or worked hours.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/attendance/device" className="btn btn-sm">Device Log</Link>
          <button onClick={refresh} disabled={loading} className="btn btn-sm">{loading ? "Loading…" : "↻ Refresh"}</button>
        </div>
      </div>

      {error && <div className="card" style={{ padding: 12, marginBottom: 12, color: "#7C1F1F", fontWeight: 600, fontSize: 13 }}>{error}</div>}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
          <Stat label="Punched" value={rows.length} />
          {data.today && <Stat label="Inside now" value={inside} />}
          {data.today && <Stat label="Out now" value={rows.length - inside} />}
          <Stat label="Not punched" value={data.noPunches.length} sub="active employees" />
          <Stat label="Need a look" value={flagged} sub="missing or extra punch" warn={flagged > 0} />
          {unlinked > 0 && <Stat label="Not linked" value={unlinked} sub="device users" warn />}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID" style={{ width: 200 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
            Only ones that need a look
          </label>
          {data?.today && (
            <span style={{ color: "#888", fontSize: 12.5 }}>
              As of the last sync{data.lastSyncAt ? ` at ${hhmm(data.lastSyncAt)}` : ""}. Punches since then arrive with the next one.
            </span>
          )}
        </div>

        {!data ? <div className="empty">Loading…</div> : shown.length === 0 ? (
          <div className="empty">{rows.length ? "Nothing matches these filters." : "No punches on this day."}</div>
        ) : (
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Employee</th><th>First IN</th><th>Last OUT</th><th>Punches</th>
                  <th>Time out</th><th>Inside</th>{data.today && <th>Now</th>}<th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const t = r.timeline;
                  const isOpen = open.has(r.key);
                  return (
                    <Fragment key={r.key}>
                      <tr onClick={() => toggle(r.key)} style={{ cursor: "pointer" }}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{r.name}</div>
                          <div style={{ fontSize: 11.5, color: "#888" }}>
                            {r.employeeCode ?? <span style={{ color: "#B45309", fontWeight: 600 }}>Not linked</span>}
                            {` · device ${r.deviceUserIds.join(", ")}`}
                          </div>
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{hhmm(t.firstIn)}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{hhmm(t.lastOut)}</td>
                        <td style={{ whiteSpace: "normal" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {t.moves.map(m => (
                              <span key={m.at} title={`${m.verifyMethod ?? ""}${m.duplicates ? ` · ${m.duplicates} repeat tap${m.duplicates > 1 ? "s" : ""} ignored` : ""}`}
                                style={{
                                  fontSize: 11.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, fontVariantNumeric: "tabular-nums",
                                  background: m.direction === "in" ? "#e3f5e3" : "#f3e8e8",
                                  color: m.direction === "in" ? "#166534" : "#7C1F1F",
                                }}>
                                {m.direction.toUpperCase()} {hhmm(m.at)}{m.duplicates ? ` +${m.duplicates}` : ""}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{duration(t.outsideMinutes)}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{duration(t.insideMinutes)}</td>
                        {data.today && (
                          <td>
                            <span className={`badge ${t.current === "in" ? "badge-active" : "badge-inactive"}`}>{t.current === "in" ? "In" : "Out"}</span>
                          </td>
                        )}
                        <td>{t.flags.length > 0 && <span className="badge badge-warning" title={t.flags.join("\n")}>Check</span>}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={data.today ? 8 : 7} style={{ background: "var(--bg, #faf7f2)", whiteSpace: "normal" }}>
                            <div style={{ display: "grid", gap: 4, fontSize: 12.5, padding: "4px 0" }}>
                              {t.spells.map(s => (
                                <div key={s.from} style={{ fontVariantNumeric: "tabular-nums" }}>
                                  <strong style={{ display: "inline-block", width: 70, color: s.kind === "inside" ? "#166534" : "#7C1F1F" }}>
                                    {s.kind === "inside" ? "Inside" : "Outside"}
                                  </strong>
                                  {hhmm(s.from)} – {s.to ? hhmm(s.to) : data.today ? "now" : "?"} · {duration(s.minutes)}
                                </div>
                              ))}
                              {t.flags.map(f => (
                                <div key={f} style={{ color: "#B45309", fontWeight: 600 }}>⚠ {f.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/, iso => hhmm(iso))}</div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.noPunches.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>No punches on this day ({data.noPunches.length})</div>
          <p style={{ color: "#888", fontSize: 12.5, margin: "0 0 10px" }}>
            Active employees with no punch. Absent or on leave, or not linked on{" "}
            <Link href="/attendance/device/users" style={{ textDecoration: "underline" }}>Device Users</Link> yet.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.noPunches.map(e => (
              <span key={e.id} style={{ fontSize: 12.5, padding: "4px 10px", borderRadius: 999, background: "var(--surface2, #f3f0ea)", border: "1px solid var(--border)" }}>
                {e.name} · {e.employeeCode}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${warn ? " warn" : ""}`} style={{ fontSize: 22 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#888", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
