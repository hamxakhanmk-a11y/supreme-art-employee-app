"use client";
import { useRef, useState } from "react";
import type { GrrChecklist, InspectionPoint } from "@/lib/procurement";

// GRR → Settings: the inspection points. The general ones go on every GRR; each
// category has its own, which appear once the category is picked on a GRR.

interface PointRow extends InspectionPoint { uid: number }
interface CatRow { uid: number; id: string; label: string; points: PointRow[] }

export default function ChecklistSettings({ checklist, onClose, onSaved }: {
  checklist: GrrChecklist; onClose: () => void; onSaved: () => void;
}) {
  const uid = useRef(0);
  const nextUid = () => ++uid.current;
  const [general, setGeneral] = useState<PointRow[]>(() => checklist.general.map(p => ({ ...p, uid: nextUid() })));
  const [cats, setCats] = useState<CatRow[]>(() => checklist.categories.map(c => ({
    uid: nextUid(), id: c.id, label: c.label, points: c.points.map(p => ({ ...p, uid: nextUid() })),
  })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const newPoint = (): PointRow => ({ uid: nextUid(), key: "", text: "" });
  const setCat = (i: number, patch: Partial<CatRow>) => setCats(l => l.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  async function save() {
    setBusy(true); setErr("");
    try {
      const body = {
        checklist: {
          general: general.map(({ key, text }) => ({ key, text })),
          categories: cats.map(c => ({ id: c.id, label: c.label, points: c.points.map(({ key, text }) => ({ key, text })) })),
        },
      };
      const res = await fetch("/api/procurement/grr-checklist", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="card no-print" style={{ marginBottom: 18, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>⚙ GRR inspection checklist</div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>
        General checks appear on every GRR. A category&apos;s checks appear when it is chosen on the GRR. Rewording a point keeps what was already ticked;
        removing one drops it from the GRR and its print.
      </div>
      {err && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{err}</div>}

      <Group title="General checks — on every GRR" points={general} onChange={setGeneral} newPoint={newPoint} />

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", margin: "18px 0 6px" }}>CATEGORIES</div>
      <div style={{ display: "grid", gap: 12 }}>
        {cats.map((c, i) => (
          <div key={c.uid} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--bg2)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input value={c.label} onChange={e => setCat(i, { label: e.target.value })} className="auth-input"
                placeholder="Category name" style={{ flex: 1, fontWeight: 700 }} maxLength={80} />
              <button className="btn btn-xs" style={{ color: "#A32D2D" }} onClick={() => {
                if (confirm(`Remove the category "${c.label || "(unnamed)"}" and its ${c.points.length} points?`)) setCats(l => l.filter((_, idx) => idx !== i));
              }}>Remove category</button>
            </div>
            <Group points={c.points} onChange={pts => setCat(i, { points: pts })} newPoint={newPoint} />
          </div>
        ))}
      </div>
      <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setCats(l => [...l, { uid: nextUid(), id: "", label: "", points: [newPoint()] }])}>
        ＋ Add category
      </button>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save checklist"}</button>
        <button onClick={onClose} className="btn">Cancel</button>
      </div>
    </div>
  );
}

// One list of points: text, move up / down, remove, and add.
function Group({ title, points, onChange, newPoint }: {
  title?: string; points: PointRow[]; onChange: (p: PointRow[]) => void; newPoint: () => PointRow;
}) {
  const edit = (i: number, text: string) => onChange(points.map((p, idx) => idx === i ? { ...p, text } : p));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= points.length) return;
    const next = [...points]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div>
      {title && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>{title.toUpperCase()}</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {points.length === 0 && <div style={{ fontSize: 12, color: "var(--text3)" }}>No points yet.</div>}
        {points.map((p, i) => (
          <div key={p.uid} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 22, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>{i + 1}</span>
            <input value={p.text} onChange={e => edit(i, e.target.value)} className="auth-input" placeholder="Inspection point" style={{ flex: 1 }} maxLength={200} />
            <button className="btn btn-xs" onClick={() => move(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up">↑</button>
            <button className="btn btn-xs" onClick={() => move(i, 1)} disabled={i === points.length - 1} title="Move down" aria-label="Move down">↓</button>
            <button className="btn btn-xs" style={{ color: "#A32D2D" }} onClick={() => onChange(points.filter((_, idx) => idx !== i))} title="Remove point" aria-label="Remove point">✕</button>
          </div>
        ))}
      </div>
      <button className="btn btn-xs" style={{ marginTop: 6 }} onClick={() => onChange([...points, newPoint()])}>＋ Add point</button>
    </div>
  );
}
