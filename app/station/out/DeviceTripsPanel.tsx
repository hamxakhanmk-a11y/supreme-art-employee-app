"use client";
import { useState } from "react";
import { LEAVE_STYLE, formatMins } from "@/lib/station";
import { TRIP_CUTOFF } from "@/lib/deviceTrips";
import type { DeviceTripTicket, TripDecision } from "@/lib/deviceTripsServer";
import { SHIFT_END } from "@/lib/attendance";

// Station → Who's Out → Device trips: mid-day punches from the fingerprint
// device waiting for an admin to mark them Personal or Official. Only an
// approved ticket becomes a Station trip and counts in the register.

const time = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : "";
const day = (d: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

const KIND: Record<DeviceTripTicket["kind"], { label: string; color: string; bg: string }> = {
  returned: { label: "Came back", color: "#166534", bg: "#e3f5e3" },
  "no-return": { label: "Didn't come back", color: "#92400E", bg: "#fdebd0" },
  "still-out": { label: "Still out", color: "#7C1F1F", bg: "#fde2e2" },
};

function outcome(t: DeviceTripTicket) {
  if (t.status === "approved" && t.type && t.type in LEAVE_STYLE) {
    const s = LEAVE_STYLE[t.type as keyof typeof LEAVE_STYLE];
    return { label: `${s.label} · ${formatMins(t.minutes)}`, color: s.color, bg: s.bg };
  }
  if (t.status === "left") return { label: "Left for the day", color: "#475569", bg: "#f1f5f9" };
  if (t.status === "matched") return { label: "Gate PIN trip", color: "#475569", bg: "#f1f5f9" };
  return { label: "Not a trip", color: "#475569", bg: "#f1f5f9" };
}

const pill = (s: { color: string; bg: string }): React.CSSProperties => ({
  fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: s.color, background: s.bg, whiteSpace: "nowrap",
});

export default function DeviceTripsPanel({ tickets, error, loading, canEdit, onChanged }: {
  tickets: DeviceTripTicket[] | null; error: string; loading: boolean; canEdit: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState("");

  async function decide(t: DeviceTripTicket, decision: TripDecision) {
    setBusy(t.id); setMsg("");
    try {
      const res = await fetch("/api/station/device-trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, decision, reason: reasons[t.id] || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Save failed");
      onChanged();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(null); }
  }

  const pending = (tickets ?? []).filter(t => t.status === "pending");
  const decided = (tickets ?? []).filter(t => t.status !== "pending" && t.status !== "matched");
  const matched = (tickets ?? []).filter(t => t.status === "matched").length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ color: "var(--text2)", fontSize: 13, margin: 0, maxWidth: 820 }}>
        When someone at work punches the fingerprint device before {TRIP_CUTOFF} (Mon–Sat), they&apos;re stepping out, and their next punch
        brings them back. Mark each one <b>Personal</b> (deducted from working hours) or <b>Official</b> (excused). Only then does it become a
        Station trip and count, up to {SHIFT_END}, the same as at the gate. Punches arrive with each device sync, up to an hour late.
      </p>

      {error && <div className="card" style={{ color: "#7C1F1F", fontWeight: 600, fontSize: 13 }}>{error}</div>}
      {msg && <div className="card" style={{ color: "#7C1F1F", fontWeight: 600, fontSize: 13 }}>{msg}</div>}

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
          To review {tickets && <span style={{ color: "var(--text3)", fontWeight: 600 }}>({pending.length})</span>}
        </div>
        {!tickets ? <div className="empty">{loading ? "Looking for trips…" : "—"}</div> : pending.length === 0 ? (
          <div className="empty">Nothing to review. New trips show up here after the device&apos;s next sync.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {pending.map(t => {
              const k = KIND[t.kind];
              const waiting = t.kind === "still-out";
              return (
                <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>{t.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{t.empCode}{t.department ? ` · ${t.department}` : ""}</span>
                    <span style={{ flex: 1 }} />
                    <span style={pill(k)}>{k.label}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>
                    {day(t.date)} · out <b>{time(t.outAt)}</b> → {t.inAt ? <>back <b>{time(t.inAt)}</b></> : <span style={{ color: "#92400E" }}>no return punch</span>}
                    {!waiting && <span style={{ color: "var(--text2)" }}> · counts {formatMins(t.minutes)}</span>}
                  </div>
                  {waiting ? (
                    <div style={{ fontSize: 12.5, color: "var(--text3)" }}>Waiting for their return punch. Decide it once they&apos;re back, or tomorrow.</div>
                  ) : canEdit ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input value={reasons[t.id] ?? ""} onChange={e => setReasons(r => ({ ...r, [t.id]: e.target.value }))}
                        placeholder="Reason (optional)" maxLength={200} style={{ flex: "1 1 180px", minWidth: 0, padding: "6px 10px", fontSize: 13 }} />
                      <button disabled={busy === t.id} onClick={() => decide(t, "personal")} className="btn btn-sm"
                        style={{ borderColor: LEAVE_STYLE.personal.color, color: LEAVE_STYLE.personal.color, fontWeight: 700 }}>Personal</button>
                      <button disabled={busy === t.id} onClick={() => decide(t, "official")} className="btn btn-sm"
                        style={{ borderColor: LEAVE_STYLE.official.color, color: LEAVE_STYLE.official.color, fontWeight: 700 }}>Official</button>
                      {t.kind === "no-return" && (
                        <button disabled={busy === t.id} onClick={() => decide(t, "left")} className="btn btn-sm"
                          title="They went home: no trip, nothing deducted here">Left for the day</button>
                      )}
                      <button disabled={busy === t.id} onClick={() => decide(t, "dismiss")} className="btn btn-sm"
                        title="A mistaken punch, not a trip">Not a trip</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(decided.length > 0 || matched > 0) && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Decided, last 7 days ({decided.length})</div>
          {matched > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 8 }}>
              {matched} more matched a trip already punched with the gate PIN, so there was nothing to do.
            </div>
          )}
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead><tr><th>Employee</th><th>Day</th><th>Out → back</th><th>Marked</th><th>By</th><th></th></tr></thead>
              <tbody>
                {decided.map(t => {
                  const o = outcome(t);
                  return (
                    <tr key={t.id}>
                      <td><div style={{ fontWeight: 700 }}>{t.name}</div><div style={{ fontSize: 11.5, color: "var(--text3)" }}>{t.empCode}</div></td>
                      <td>{day(t.date)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{time(t.outAt)} → {t.inAt ? time(t.inAt) : "—"}</td>
                      <td><span style={pill(o)}>{o.label}</span></td>
                      <td style={{ fontSize: 12.5 }}>{t.decidedBy ?? ""}</td>
                      <td>{canEdit && (
                        <button disabled={busy === t.id} onClick={() => decide(t, "reopen")} className="btn btn-xs"
                          title={t.status === "approved" ? "Removes the Station trip it created and puts it back to review" : "Put it back to review"}>
                          Undo
                        </button>
                      )}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
