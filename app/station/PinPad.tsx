"use client";
import { useEffect } from "react";

// The gate keypad. Shared by the two things a terminal can be asked to
// identify — a person, or a vehicle — so both behave the same way under the
// same fingers, including on the numpad kiosks.
//
// PINs are whatever length they are. Vehicle PINs are often the vehicle's own
// number because that is what people remember, and those run from two digits
// to four, so nothing here submits on reaching a length: the PIN is entered and
// then confirmed with ↵ (or Enter on a physical keypad).

export const PIN_MIN = 2;
export const PIN_MAX = 6;

export function keyStyle(muted: boolean): React.CSSProperties {
  return {
    height: 72, fontSize: 26, fontWeight: 700, borderRadius: 14, cursor: "pointer",
    border: "1px solid var(--border)", background: muted ? "var(--bg2)" : "var(--bg)",
    color: "var(--text)", boxShadow: "var(--shadow-sm)",
  };
}

export default function PinPad({
  pin, busy, active, prompt, onChange, onSubmit,
}: {
  pin: string;
  busy: boolean;
  /** Only the visible pad listens to the physical keyboard. */
  active: boolean;
  prompt: string;
  onChange: (next: string) => void;
  onSubmit: (pin: string) => void;
}) {
  const ready = pin.length >= PIN_MIN;

  const press = (d: string) => {
    if (busy) return;
    onChange((pin + d).slice(0, PIN_MAX));
  };
  const backspace = () => onChange(pin.slice(0, -1));
  const submit = () => { if (ready && !busy) onSubmit(pin); };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, pin, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <p style={{ color: "var(--text2)", fontSize: 15, margin: "6px 0 14px" }}>{prompt}</p>

      {/* One dot per digit typed, rather than a fixed row of them: the length
          is the operator's to decide, and a row of empty slots would say
          otherwise. */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, height: 26, marginBottom: 18 }}>
        {pin.length === 0
          ? <span style={{ fontSize: 13, color: "var(--text3)" }}>type the PIN, then press ↵</span>
          : Array.from({ length: pin.length }).map((_, i) => (
              <span key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--brand)" }} />
            ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 320, margin: "0 auto" }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
          <button key={d} onClick={() => press(d)} disabled={busy} style={keyStyle(false)}>{d}</button>
        ))}
        <button onClick={backspace} disabled={busy || !pin.length} style={keyStyle(true)}>⌫</button>
        <button onClick={() => press("0")} disabled={busy} style={keyStyle(false)}>0</button>
        <button
          onClick={submit}
          disabled={busy || !ready}
          style={{
            ...keyStyle(true),
            background: ready ? "var(--brand)" : "var(--bg2)",
            color: ready ? "#fff" : "var(--text3)",
            borderColor: ready ? "var(--brand)" : "var(--border)",
          }}>↵</button>
      </div>
    </>
  );
}
