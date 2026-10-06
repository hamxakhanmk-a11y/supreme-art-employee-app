"use client";
import { useEffect, useRef, useState } from "react";

// A table cell you edit where it stands. It reads as plain text until it is
// hovered or clicked; change it and leave the cell (or press Enter) and it
// saves, Escape puts back what was there.
//
// This replaced an Edit button that turned the whole row into a form: every
// field at once, squeezed into the row's width, too narrow to type a meter
// reading into. One cell at a time keeps each field the size of its column.
//
// On paper it prints as its text — a printed log book full of input boxes
// would not be a log book.
export default function EditCell({
  value, onSave, type = "text", minWidth = 90, align = "left",
  placeholder, readOnly, print, bold, mono,
}: {
  value: string;
  /** Resolves true when saved; false puts the old value back. */
  onSave: (next: string) => Promise<boolean>;
  type?: "text" | "number" | "date" | "time";
  minWidth?: number;
  align?: "left" | "right";
  placeholder?: string;
  readOnly?: boolean;
  /** What to show when read-only and on paper, if not the raw value. */
  print?: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const focused = useRef(false);
  // Escape blurs the input, and blur is what saves — so it has to leave a note
  // saying not to. Resetting the draft is not enough: the blur handler still
  // holds the typed value it was rendered with.
  const cancelled = useRef(false);

  // A save elsewhere — or the page reloading after this one — wins over a cell
  // nobody is typing in.
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [flash]);

  if (readOnly) return <>{print ?? value}</>;

  const commit = async () => {
    focused.current = false;
    if (cancelled.current) { cancelled.current = false; return; }
    if (draft === value) return;
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    setFlash(ok ? "ok" : "err");
    if (!ok) setDraft(value);
  };

  return (
    <>
      <input
        className={`edit-cell no-print${flash ? ` edit-cell-${flash}` : ""}`}
        type={type}
        value={draft}
        placeholder={placeholder}
        disabled={saving}
        onFocus={() => { focused.current = true; }}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          else if (e.key === "Escape") { cancelled.current = true; setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        style={{
          minWidth, textAlign: align,
          fontWeight: bold ? 700 : undefined,
          fontFamily: mono ? "monospace" : undefined,
          opacity: saving ? 0.5 : 1,
        }}
      />
      <span className="print-only">{print ?? value}</span>
    </>
  );
}
