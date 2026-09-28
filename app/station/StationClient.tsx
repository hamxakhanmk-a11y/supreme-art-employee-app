"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LEAVE_STYLE, hhmm, formatMins, type LeaveType } from "@/lib/station";
import { type Person, type OpenTrip } from "./VehicleTripForms";
import PinPad from "./PinPad";
import VehicleTerminal from "./VehicleTerminal";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string; designation: string | null; photoUrl: string | null };
type Leave = { id: number; outAt: string; inAt: string | null; type: string; minutes: number | null; reason: string | null };
type Lookup = { employee: Emp; open: Leave | null; todays: Leave[]; openTrip: OpenTrip | null };



export default function StationClient() {
  const [pin, setPin] = useState("");
  const [view, setView] = useState<"pin" | "found">("pin");
  const [data, setData] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [time, setTime] = useState("");   // optional manual "HH:MM"; blank = now
  const [flash, setFlash] = useState<{ msg: string; color: string } | null>(null);
  // Which kind of PIN the pad is asking for. A person and a vehicle can
  // share the same digits, so the terminal is told rather than guessing.
  const [terminalFor, setTerminalFor] = useState<"employee" | "vehicle">("employee");
  const [fleet, setFleet] = useState<{ vehicles: { id: number }[]; people: Person[] }>({ vehicles: [], people: [] });

  // Loaded once, on its own. If it fails the terminal simply doesn't offer
  // vehicles — punching out on foot is what this screen has always been for
  // and must not depend on the fleet tables being reachable.
  const loadFleet = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet/terminal", { cache: "no-store" });
      if (res.ok) setFleet(await res.json());
    } catch { /* no vehicles offered */ }
  }, []);
  useEffect(() => { loadFleet(); }, [loadFleet]);

  const reset = useCallback(() => { setPin(""); setView("pin"); setData(null); setError(null); setReason(""); setTime(""); }, []);

  const lookup = useCallback(async (p: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/station/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: p }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Lookup failed");
      setData(j); setView("found");
    } catch (e: any) { setError(e.message); setPin(""); }
    finally { setBusy(false); }
  }, []);

  // Keypad entry — including the physical numpad on the kiosks — belongs to
  // PinPad now, so that only one listener is ever bound and the visible pad is
  // the one that receives the keystroke.

  const punch = async (type?: LeaveType) => {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/station/punch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, type, reason, at: time || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Punch failed");
      const nm = data.employee.firstName;
      setFlash(j.action === "out"
        ? { msg: `${nm} punched OUT · ${LEAVE_STYLE[(j.leave.type as LeaveType)].label} · ${hhmm(j.leave.outAt)}`, color: "#DC2626" }
        : { msg: `${nm} punched IN · ${formatMins(j.leave.minutes)} out · ${hhmm(j.leave.inAt)}`, color: "#15803D" });
      reset();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // Auto-dismiss the confirmation banner.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const emp = data?.employee;
  const open = data?.open;

  return (
    <div className="fade-up" style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 4px" }}>🏭 Station Terminal</h1>

      {flash && (
        <div style={{ margin: "10px 0", padding: "10px 14px", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "#fff", background: flash.color }}>
          ✓ {flash.msg}
        </div>
      )}
      {error && (
        <div style={{ margin: "10px 0", padding: "10px 14px", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "#DC2626", background: "#fde2e2" }}>
          {error}
        </div>
      )}

      {view === "pin" && fleet.vehicles.length > 0 && (
        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 999, background: "var(--bg2)", border: "1px solid var(--border)", margin: "4px 0 2px" }}>
          {([["employee", "🚶 Employee"], ["vehicle", "🚐 Vehicle"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setTerminalFor(k); setPin(""); setError(null); }}
              style={{
                border: "none", borderRadius: 999, padding: "8px 18px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                background: terminalFor === k ? "var(--brand)" : "transparent",
                color: terminalFor === k ? "#fff" : "var(--text2)",
              }}>{label}</button>
          ))}
        </div>
      )}

      {view === "pin" && terminalFor === "vehicle" ? (
        <VehicleTerminal
          people={fleet.people} time={time}
          onDone={(msg, color) => { setFlash({ msg, color }); loadFleet(); }}
        />
      ) : view === "pin" && (
        <>
          <PinPad
            pin={pin} busy={busy} active={terminalFor === "employee"}
            prompt="Enter your PIN to begin"
            onChange={next => { setPin(next); setError(null); }}
            onSubmit={lookup}
          />
        </>
      )}

      {view === "found" && emp && (
        <div>
          <div className="card" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
            {emp.photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={emp.photoUrl} alt="" className="avatar" style={{ width: 54, height: 54 }} />
              : <div className="avatar" style={{ width: 54, height: 54, background: "linear-gradient(135deg, var(--brand), var(--brand-dark))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{emp.firstName[0]}{emp.lastName[0]}</div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{emp.firstName} {emp.lastName}</div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>{emp.employeeId} · {emp.designation || "—"}</div>
            </div>
          </div>

          {/* Optional manual time — blank uses the current time. */}
          <div style={{ margin: "14px 0 2px", textAlign: "left", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>Time</span>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              disabled={busy}
              style={{ padding: "8px 10px", fontSize: 15, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
            {time
              ? <button onClick={() => setTime("")} disabled={busy} className="btn btn-sm">Use now</button>
              : <span style={{ fontSize: 11.5, color: "var(--text3)" }}>blank = right now</span>}
          </div>

          {open ? (
            <>
              <div style={{ margin: "16px 0 6px", fontSize: 15 }}>
                Currently <strong style={{ color: "#DC2626" }}>OUT</strong> since <strong>{hhmm(open.outAt)}</strong>
                {" "}<span style={{ fontSize: 12, color: LEAVE_STYLE[open.type as LeaveType].color }}>({LEAVE_STYLE[open.type as LeaveType].label})</span>
              </div>
              <button onClick={() => punch()} disabled={busy} style={bigBtn("#15803D")}>← Punch IN (returning)</button>
            </>
          ) : (
            <>
              <div style={{ margin: "16px 0 6px", fontSize: 15, color: "var(--text2)", textAlign: "left" }}>
                Going out — reason <span style={{ fontSize: 12, color: "var(--text3)" }}>(optional)</span>
              </div>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={busy}
                maxLength={200}
                placeholder="e.g. Bank work, doctor visit, delivery pickup…"
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)",
                  marginBottom: 12,
                }}
              />
              <div style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text2)", textAlign: "left" }}>Now pick the type:</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => punch("personal")} disabled={busy} style={bigBtn("#9333EA")}>Out · Personal</button>
                <button onClick={() => punch("official")} disabled={busy} style={bigBtn("#0E7490")}>Out · Official</button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>Personal time is deducted from working hours · Official is excused.</div>

            </>
          )}

          {data.openTrip && (
            <div className="card" style={{ marginTop: 14, textAlign: "left", padding: "10px 14px", borderLeft: "4px solid #B45309" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>🚐 Out in {data.openTrip.vehicleNo} since {hhmm(data.openTrip.outAt)}</div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
                Bring it back on the Vehicle pad, with {data.openTrip.vehicleNo}&apos;s own PIN.
              </div>
            </div>
          )}

          {data.todays.length > 0 && (
            <div className="card" style={{ marginTop: 16, textAlign: "left", padding: "10px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Today&apos;s trips</div>
              {data.todays.map(t => (
                <div key={t.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span>{hhmm(t.outAt)} → {t.inAt ? hhmm(t.inAt) : <span style={{ color: "#DC2626", fontWeight: 700 }}>still out</span>}</span>
                    <span style={{ color: LEAVE_STYLE[t.type as LeaveType].color, fontWeight: 700 }}>
                      {LEAVE_STYLE[t.type as LeaveType].label}{t.minutes != null ? ` · ${formatMins(t.minutes)}` : ""}
                    </span>
                  </div>
                  {t.reason && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{t.reason}</div>}
                </div>
              ))}
            </div>
          )}

          <button onClick={reset} className="btn" style={{ marginTop: 16 }}>← Different employee</button>
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 12, display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/station/out" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>🚶 Who&apos;s out now →</Link>
        <Link href="/station/report" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>📊 Time-outside report →</Link>
        <Link href="/station/logbook" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>🚐 Vehicle log book →</Link>
      </div>
    </div>
  );
}


function bigBtn(color: string): React.CSSProperties {
  return {
    flex: 1, width: "100%", padding: "16px 18px", fontSize: 16, fontWeight: 800, borderRadius: 12,
    cursor: "pointer", border: `1px solid ${color}`, background: color, color: "#fff",
    boxShadow: `0 2px 8px ${color}55`,
  };
}
