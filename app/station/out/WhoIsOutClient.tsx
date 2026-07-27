"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LEAVE_STYLE, hhmm, formatMins, type LeaveType } from "@/lib/station";
import type { OutNow } from "@/lib/stationServer";

// Minutes elapsed between an ISO timestamp and now.
function minsSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export default function WhoIsOutClient({ initial }: { initial: OutNow[] }) {
  const [out, setOut] = useState<OutNow[]>(initial);
  const [now, setNow] = useState<number>(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  // Tick every 30s so the "out for" durations stay live without a reload.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Re-pull the list every 30s (and on demand) so new punches appear.
  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/station/out", { cache: "no-store" });
      if (res.ok) { const j = await res.json(); setOut(j.out ?? []); setNow(Date.now()); }
    } finally { setRefreshing(false); }
  };
  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fade-up" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🚶 Who&apos;s Out</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Employees currently outside the factory — reason and check-out time. Updates automatically.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={refresh} disabled={refreshing} className="btn btn-sm">
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          <Link href="/station" className="btn btn-sm">🏭 Terminal</Link>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {out.length === 0
          ? null
          : <><strong>{out.length}</strong> {out.length === 1 ? "person is" : "people are"} out right now.</>}
      </div>

      {out.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text2)" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Everyone is in</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>Nobody is punched out at the moment.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {out.map(o => {
            const st = LEAVE_STYLE[o.type as LeaveType] ?? { label: o.type, color: "var(--text2)", bg: "var(--bg2)" };
            const mins = minsSince(o.outAt, now);
            return (
              <div key={o.id} className="card" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 16px" }}>
                <div className="avatar" style={{
                  width: 46, height: 46, flexShrink: 0,
                  background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 800, borderRadius: "50%",
                }}>{o.name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase()}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{o.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{o.empCode}{o.designation ? ` · ${o.designation}` : ""}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3 }}>
                    {o.reason
                      ? <>Reason: <span style={{ color: "var(--text)" }}>{o.reason}</span></>
                      : <span style={{ color: "var(--text3)" }}>No reason given</span>}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    display: "inline-block", padding: "2px 10px", borderRadius: 999,
                    background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, marginBottom: 4,
                  }}>{st.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Out since {hhmm(o.outAt)}</div>
                  <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{formatMins(mins)} ago</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
