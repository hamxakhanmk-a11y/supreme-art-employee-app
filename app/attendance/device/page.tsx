"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// Live view of the biometric device feed: device health from the bridge's
// heartbeat and the raw punches it delivered. Used to check that punches are
// arriving and to debug the bridge.

type Device = {
  serial: string; name: string | null; firmware: string | null; ip: string | null;
  bridgeVersion: string | null; deviceTime: string | null; clockDriftSeconds: number | null;
  counts: Record<string, number> | null; invalidPunchCount: number | null;
  lastSyncedAt: string | null; pollIntervalSeconds: number | null; lastSeenAt: string;
  deviceReadAt: string | null; deviceError: string | null; deviceErrorSince: string | null;
};
type Punch = {
  id: number; deviceSerial: string; deviceUserId: string; punchedAt: string;
  verifyMethod: string | null; punchState: number | null; receivedAt: string;
  deviceName: string | null; employeeCode: string | null; firstName: string | null; lastName: string | null;
};
type Log = { date: string; devices: Device[]; punches: Punch[]; dayTotal: number; storedTotal: number };

// The bridge syncs on its own interval (hourly by default) and every load wakes
// the database, so the page reloads just after the next sync is due rather than
// on a fixed timer, and not while the tab is hidden.
const MIN_RELOAD_MS = 60_000;
const OVERDUE_RELOAD_MS = 10 * 60_000;
const RELOAD_AFTER_SYNC_MS = 90_000;

const intervalMs = (d: Device) => (d.pollIntervalSeconds ?? 300) * 1000;
// Heartbeats come every sync; one interval plus some slack without one means
// the device or bridge is likely down.
const staleAfterMs = (d: Device) => intervalMs(d) + Math.max(15 * 60_000, intervalMs(d) / 2);
const nextSyncAt = (d: Device) => new Date(d.lastSeenAt).getTime() + intervalMs(d);

const fmt = (iso: string | null, opts: Intl.DateTimeFormatOptions) =>
  iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hourCycle: "h23", ...opts }).format(new Date(iso)) : "—";
const time = (iso: string | null) => fmt(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateTime = (iso: string | null) => fmt(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function span(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function ago(iso: string | null, now: number) {
  if (!iso) return "never";
  return `${span(Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)))} ago`;
}

function todayKarachi() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

export default function DeviceLogPage() {
  const [date, setDate] = useState(todayKarachi);
  const [user, setUser] = useState("");
  const [log, setLog] = useState<Log | null>(null);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // Punch ids seen on the previous load, to highlight ones that just arrived.
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ date });
      if (user.trim()) qs.set("user", user.trim());
      const res = await fetch(`/api/attendance/device-log?${qs}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const data = j as Log;
      const ids = new Set(data.punches.map(p => p.id));
      const prev = seen.current;
      setFresh(prev ? new Set([...ids].filter(id => !prev.has(id))) : new Set());
      seen.current = ids;
      setLog(data);
      setError("");
      setLoadedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [date, user]);

  // New filters start a new baseline, so nothing is flagged as just arrived.
  useEffect(() => { seen.current = null; }, [date, user]);

  useEffect(() => { load(); }, [load]);

  // Schedule the next reload for just after the earliest expected sync. Each
  // load updates `log`, which schedules the one after.
  useEffect(() => {
    if (!log) return;
    const upcoming = log.devices.map(nextSyncAt).filter(t => t > Date.now());
    const target = upcoming.length ? Math.min(...upcoming) + RELOAD_AFTER_SYNC_MS : Date.now() + OVERDUE_RELOAD_MS;
    const t = setTimeout(() => {
      if (document.visibilityState === "visible") load();
    }, Math.max(MIN_RELOAD_MS, target - Date.now()));
    return () => clearTimeout(t);
  }, [log, load]);

  // A reload skipped while the tab was hidden happens when it's shown again.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt > MIN_RELOAD_MS) load();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [load, loadedAt]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Device Log</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Punches received from the fingerprint device. Reloads after each sync
            {loadedAt ? ` · updated ${span(Math.max(0, Math.round((now - loadedAt) / 1000)))} ago` : ""}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/attendance/device/users" className="btn btn-sm">Link device users</Link>
          <button onClick={load} className="btn btn-sm">↻ Refresh</button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 12, marginBottom: 12, color: "#7C1F1F", fontWeight: 600, fontSize: 13 }}>{error}</div>
      )}

      {log && log.devices.length === 0 && (
        <div className="card empty" style={{ marginBottom: 16 }}>No device has reported in yet. Start the bridge on the factory PC.</div>
      )}

      {log?.devices.map(d => {
        const stale = now - new Date(d.lastSeenAt).getTime() > staleAfterMs(d);
        const next = nextSyncAt(d);
        const drift = d.clockDriftSeconds;
        // Bridge silent = PC, bridge or internet down. Bridge reporting an
        // error = it's running but can't reach the device on the LAN.
        const unreachable = !stale && !!d.deviceError;
        const readAt = d.deviceReadAt ?? d.lastSeenAt;
        return (
          <div key={d.serial} className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{d.name || "Device"}</span>
              <span style={{ color: "#888", fontSize: 12.5 }}>{d.serial}{d.ip ? ` · ${d.ip}` : ""}{d.firmware ? ` · ${d.firmware}` : ""}</span>
              <span className={`badge ${stale ? "badge-inactive" : unreachable ? "badge-warning" : "badge-active"}`}>
                {stale ? "Offline" : unreachable ? "Device unreachable" : "Online"}
              </span>
            </div>
            {stale && (
              <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
                The bridge PC hasn&apos;t checked in since {dateTime(d.lastSeenAt)}. Check the PC is on, connected to the internet, and the
                <strong> ZK Attendance Bridge</strong> task is running.
              </div>
            )}
            {unreachable && (
              <div style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
                The bridge PC is running but hasn&apos;t been able to reach the device since {dateTime(d.deviceErrorSince)}: <em>{d.deviceError}</em>.
                Check the device&apos;s network cable and switch port, its IP (Menu → Comm. → Ethernet), and that the bridge PC is on the same network.
                Figures below are from the last successful read, {ago(readAt, now)}.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <Tile label="Bridge check-in" value={ago(d.lastSeenAt, now)} warn={stale}
                sub={stale ? `expected ${time(new Date(next).toISOString())}` : `every ${span(intervalMs(d) / 1000)} · next ~${fmt(new Date(next).toISOString(), { hour: "2-digit", minute: "2-digit" })}`} />
              <Tile label="Last device read" value={ago(readAt, now)} sub={dateTime(readAt)} warn={unreachable || stale} />
              <Tile label="Latest punch synced" value={time(d.lastSyncedAt)} sub={fmt(d.lastSyncedAt, { day: "2-digit", month: "short", year: "numeric" })} />
              <Tile label="Clock drift" value={drift === null ? "—" : `${drift > 0 ? "+" : ""}${drift}s`}
                sub="device vs bridge PC" warn={drift !== null && Math.abs(drift) > 120} />
              <Tile label="Records on device" value={d.counts?.records?.toLocaleString() ?? "—"}
                sub={d.counts?.recordsCap ? `of ${d.counts.recordsCap.toLocaleString()}` : ""}
                warn={!!d.counts?.recordsCap && (d.counts.records ?? 0) / d.counts.recordsCap > 0.95} />
              <Tile label="Users on device" value={d.counts?.users?.toLocaleString() ?? "—"} sub={d.counts?.fingers ? `${d.counts.fingers} fingerprints` : ""} />
              <Tile label="Invalid punches" value={String(d.invalidPunchCount ?? 0)} sub="bad timestamps, skipped" warn={(d.invalidPunchCount ?? 0) > 0} />
            </div>
          </div>
        );
      })}

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
          <input value={user} onChange={e => setUser(e.target.value)} placeholder="Device user ID" style={{ width: 150 }} />
          <span style={{ color: "#888", fontSize: 12.5 }}>
            {log ? `${log.dayTotal} punch${log.dayTotal === 1 ? "" : "es"} on this day · ${log.storedTotal.toLocaleString()} stored in total` : "Loading…"}
            {log && log.dayTotal > log.punches.length ? ` · showing latest ${log.punches.length}` : ""}
          </span>
        </div>

        {log && log.punches.length === 0 ? (
          <div className="empty">No punches for this day.</div>
        ) : (
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Punched at</th><th>Device user</th><th>Name on device</th><th>Employee</th>
                  <th>Method</th><th>Received</th><th>Delay</th>
                </tr>
              </thead>
              <tbody>
                {log?.punches.map(p => {
                  const delay = Math.round((new Date(p.receivedAt).getTime() - new Date(p.punchedAt).getTime()) / 1000);
                  return (
                    <tr key={p.id} style={fresh.has(p.id) ? { background: "#FEF3C7", transition: "background 1s" } : undefined}>
                      <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{time(p.punchedAt)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.deviceUserId}</td>
                      <td>{p.deviceName || <span style={{ color: "#aaa" }}>—</span>}</td>
                      <td>{p.employeeCode
                        ? `${p.firstName} ${p.lastName} · ${p.employeeCode}`
                        : <span style={{ color: "#aaa" }}>Not linked</span>}</td>
                      <td>{p.verifyMethod ?? "—"}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", color: "#666" }}>{dateTime(p.receivedAt)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", color: "#666" }}>{delay < 0 ? "—" : span(delay)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${warn ? " warn" : ""}`} style={{ fontSize: 20 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#888", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
