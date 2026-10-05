"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEAVE_STYLE, hhmm, formatMins, type LeaveType } from "@/lib/station";
import type { OutNow } from "@/lib/stationServer";

type OutRow = OutNow & { inAt?: string | null; minutes?: number | null };

// Minutes elapsed between an ISO timestamp and now.
function minsSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export type VehicleOut = {
  id: number; outAt: string; meterOut: number; destination: string; purpose: string;
  vehicleNo: string; vehicleName: string; driver: string; officers: string[];
  // Only on a past day, where a journey may have ended.
  inAt?: string | null; kmCovered?: number | null;
};

export default function WhoIsOutClient({
  initial, initialVehicles = [], date, isToday,
}: {
  initial: OutRow[];
  initialVehicles?: VehicleOut[];
  date: string;
  isToday: boolean;
}) {
  const router = useRouter();
  const [out, setOut] = useState<OutRow[]>(initial);
  const [vehicles, setVehicles] = useState<VehicleOut[]>(initialVehicles);

  // A past day has finished happening, so the lists are replaced outright
  // when the date changes rather than merged into what is on screen.
  useEffect(() => { setOut(initial); setVehicles(initialVehicles); }, [initial, initialVehicles]);
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
      const res = await fetch(`/api/station/out?date=${date}`, { cache: "no-store" });
      if (res.ok) { const j = await res.json(); setOut(j.out ?? []); setVehicles(j.vehicles ?? []); setNow(Date.now()); }
    } finally { setRefreshing(false); }
  };
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [isToday]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fade-up" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🚶 Who&apos;s Out</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {isToday
              ? "Who and what is outside the factory right now. Updates automatically."
              : "Who went out that day, and what they took — the whole day, not only what was still out at the end of it."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="date"
            value={date}
            max={new Date().toLocaleDateString("en-CA")}
            onChange={e => e.target.value && router.push("/station/out?date=" + e.target.value)}
            style={{ width: 150 }}
          />
          {!isToday && (
            <button className="btn btn-sm" onClick={() => router.push("/station/out")}>Today</button>
          )}
          {isToday && (
            <button onClick={refresh} disabled={refreshing} className="btn btn-sm">
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
          )}
          <Link href="/station" className="btn btn-sm">🏭 Terminal</Link>
        </div>
      </div>

      {vehicles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            {isToday ? "Vehicles out" : "Vehicles that went out"} ({vehicles.length})
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {vehicles.map(v => (
              <div key={v.id} className="card" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 16px", borderLeft: "4px solid #B45309" }}>
                <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>🚐</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>{v.vehicleNo}</span>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{v.vehicleName || ""}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3 }}>
                    Driven by <span style={{ color: "var(--text)", fontWeight: 600 }}>{v.driver}</span>
                    {v.destination ? <> · to <span style={{ color: "var(--text)" }}>{v.destination}</span></> : null}
                  </div>
                  {v.officers.length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>With {v.officers.join(", ")}</div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {v.inAt ? `${hhmm(v.outAt)} → ${hhmm(v.inAt)}` : `Out since ${hhmm(v.outAt)}`}
                  </div>
                  <div style={{ fontSize: 12, color: v.inAt ? "var(--text3)" : "#DC2626", fontWeight: 600 }}>
                    {v.inAt ? `${v.kmCovered ?? 0} km` : `${formatMins(minsSince(v.outAt, now))} ago`}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>Left on {v.meterOut} km</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
        {out.length === 0
          ? null
          : isToday
            ? <><strong>{out.length}</strong> {out.length === 1 ? "person is" : "people are"} out right now.</>
            : <><strong>{out.length}</strong> {out.length === 1 ? "person" : "people"} went out that day.</>}
      </div>

      {out.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text2)" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{isToday ? "Everyone is in" : "Nobody went out"}</div>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
            {isToday ? "Nobody is punched out at the moment." : "No hourly leave was punched that day."}
          </div>
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
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {isToday || !o.inAt ? `Out since ${hhmm(o.outAt)}` : `${hhmm(o.outAt)} → ${hhmm(o.inAt)}`}
                  </div>
                  <div style={{ fontSize: 12, color: o.inAt ? "var(--text3)" : "#DC2626", fontWeight: 600 }}>
                    {o.inAt ? formatMins(o.minutes ?? 0) : `${formatMins(mins)} ago`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
