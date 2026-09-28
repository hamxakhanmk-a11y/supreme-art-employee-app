"use client";
import { useEffect } from "react";

// The gate keypad. Shared by the two things a terminal can be asked to
// identify — a person, or a vehicle — so both behave the same way under the
// same fingers, including on the numpad kiosks.

export function keyStyle(muted: boolean): React.CSSProperties {
  return {
    height: 72, fontSize: 26, fontWeight: 700, borderRadius: 14, cursor: "pointer",
    border: "1px solid var(--border)", background: muted ? "var(--bg2)" : "var(--bg)",
    color: "var(--text)", boxShadow: "var(--shadow-sm)",
  };
}

export default function PinPad({
  pin, length, busy, active, prompt, onChange, onSubmit,
}: {
  pin: string;
  length: number;
  busy: boolean;
  /** Only the visible pad listens to the physical keyboard. */
  active: boolean;
  prompt: string;
  onChange: (next: string) => void;
  onSubmit: (pin: string) => void;
}) {
  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, length);
    onChange(next);
    if (next.length === length) onSubmit(next);
  };
  const backspace = () => onChange(pin.slice(0, -1));

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") backspace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, pin, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <p style={{ color: "var(--text2)", fontSize: 15, margin: "6px 0 16px" }}>{prompt}</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 22 }}>
        {Array.from({ length }).map((_, i) => (
          <span key={i} style={{
            width: 18, height: 18, borderRadius: "50%",
            border: `2px solid ${i < pin.length ? "var(--brand)" : "var(--border2)"}`,
            background: i < pin.length ? "var(--brand)" : "transparent",
          }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 320, margin: "0 auto" }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
          <button key={d} onClick={() => press(d)} disabled={busy} style={keyStyle(false)}>{d}</button>
        ))}
        <button onClick={backspace} disabled={busy} style={keyStyle(true)}>⌫</button>
        <button onClick={() => press("0")} disabled={busy} style={keyStyle(false)}>0</button>
        <button onClick={() => pin.length === length && onSubmit(pin)} disabled={busy || pin.length !== length} style={keyStyle(true)}>↵</button>
      </div>
    </>
  );
}
