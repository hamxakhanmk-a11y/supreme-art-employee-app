"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { parseItems, fmtDate, DEPARTMENTS, type DemandItem } from "@/lib/procurement";

interface Demand {
  id: number; demandNo: number; date: string; requiredBy: string | null;
  demandBy: string | null; department: string | null; preparedBy: string | null;
  approvedBy: string | null; sectionIncharge: string | null; items: string;
  status: string; createdByName: string | null;
}

const blankItem = (n: number): DemandItem => ({ srNo: n, material: "", requiredFor: "", quantity: "", remarks: "" });

export default function DemandClient({ rows }: { rows: Demand[] }) {
  const router = useRouter();
  const canEdit = useCanEdit("demand");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNo, setEditNo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [requiredBy, setRequiredBy] = useState("");
  const [demandBy, setDemandBy] = useState("");
  const [department, setDepartment] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [items, setItems] = useState<DemandItem[]>([blankItem(1), blankItem(2), blankItem(3)]);

  function resetForm() {
    setEditId(null); setEditNo(null);
    setDate(new Date().toISOString().slice(0, 10));
    setRequiredBy(""); setDemandBy(""); setDepartment(""); setPreparedBy("");
    setApprovedBy(""); setItems([blankItem(1), blankItem(2), blankItem(3)]);
    setErr("");
  }
  function openEdit(d: Demand) {
    setEditId(d.id); setEditNo(d.demandNo);
    setDate((d.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
    setRequiredBy((d.requiredBy || "").slice(0, 10));
    setDemandBy(d.demandBy || ""); setDepartment(d.department || "");
    setPreparedBy(d.preparedBy || ""); setApprovedBy(d.approvedBy || "");
    const its = parseItems<DemandItem>(d.items);
    setItems(its.length ? its.map((it, i) => ({ ...blankItem(i + 1), ...it, srNo: i + 1 })) : [blankItem(1)]);
    setErr(""); setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function setItem(i: number, k: keyof DemandItem, v: string) {
    setItems(list => list.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  }
  function addRow() { setItems(list => [...list, blankItem(list.length + 1)]); }
  function removeRow(i: number) { setItems(list => list.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, srNo: idx + 1 }))); }

  async function save() {
    // The controls sit outside a <form>, so `required` alone wouldn't block us.
    if (!demandBy.trim()) { setErr("Please enter the name of the person raising this demand."); return; }
    if (!department) { setErr("Please choose a department."); return; }
    setBusy(true); setErr("");
    try {
      const clean = items.filter(it => it.material.trim());
      const res = await fetch(editId ? `/api/procurement/demands/${editId}` : "/api/procurement/demands", {
        method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, requiredBy, demandBy, department, preparedBy, approvedBy, items: clean }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setOpen(false); resetForm(); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  async function del(d: Demand) {
    if (!confirm(`Delete Demand #${d.demandNo}?`)) return;
    const res = await fetch(`/api/procurement/demands/${d.id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else alert("Delete failed");
  }

  // Search across number, people, department and every line item (material,
  // required-for, remarks).
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(d => {
      const items = parseItems<DemandItem>(d.items);
      const hay = [
        `#${d.demandNo}`, String(d.demandNo), d.demandBy, d.department, d.preparedBy, d.approvedBy,
        ...items.flatMap(it => [it.material, it.requiredFor, it.remarks]),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Material Demand Forms</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Raise a demand — it flows to Purchase Orders. <span style={{ color: "var(--text3)" }}>PUR/QR/005</span></p>
        </div>
        {canEdit && (
          <button onClick={() => { resetForm(); setOpen(o => !o); }} className="btn btn-primary">
            {open ? "✕ Close" : "＋ New Demand"}
          </button>
        )}
      </div>

      {open && canEdit && (
        <div className="card" style={{ marginBottom: 18, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{editId ? `✏️ Edit Demand #${editNo}` : "＋ New Demand"}</div>
          {err && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="auth-input" /></Field>
            <Field label="Required by (arrange by)"><input type="date" value={requiredBy} onChange={e => setRequiredBy(e.target.value)} className="auth-input" /></Field>
            <Field label="Demand by (person's name) *">
              <input value={demandBy} onChange={e => setDemandBy(e.target.value)} className="auth-input"
                required placeholder="e.g. Waqar Ahmed" />
            </Field>
            <Field label="Department *">
              <select value={department} onChange={e => setDepartment(e.target.value)} className="auth-input" required>
                <option value="">— Select department —</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          <ItemsGrid items={items} setItem={setItem} addRow={addRow} removeRow={removeRow} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "14px 0" }}>
            <Field label="Prepared by"><input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} className="auth-input" /></Field>
            <Field label="Approved by"><input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} className="auth-input" /></Field>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save Demand"}</button>
            <button onClick={() => setOpen(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 Search demands — number, person, department, or item description…"
          style={searchInput} />
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Demand #</th><th>Date</th><th>Required by</th><th>Demand by</th>
              <th>Department</th><th className="num">Items</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>{q.trim() ? "No demands match your search." : "No demands yet."}</td></tr>
            ) : shown.map(d => (
              <tr key={d.id}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{d.demandNo}</td>
                <td>{fmtDate(d.date)}</td>
                <td>{fmtDate(d.requiredBy)}</td>
                <td>{d.demandBy || "—"}</td>
                <td>{d.department || "—"}</td>
                <td className="num">{parseItems<DemandItem>(d.items).length}</td>
                <td><StatusBadge status={d.status} /></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/procurement/demand/${d.id}`} className="btn btn-sm" style={{ marginRight: 6 }}>View / Print</Link>
                  {canEdit && <button onClick={() => openEdit(d)} className="btn btn-sm" style={{ marginRight: 6 }}>Edit</button>}
                  {canEdit && <button onClick={() => del(d)} className="btn btn-sm" style={{ color: "#A32D2D" }}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemsGrid({ items, setItem, addRow, removeRow }: {
  items: DemandItem[]; setItem: (i: number, k: keyof DemandItem, v: string) => void; addRow: () => void; removeRow: (i: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>ITEMS</div>
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 44 }}>Sr.</th><th>Material required</th><th>Required for</th>
              <th style={{ width: 110 }}>Quantity</th><th>Remarks</th><th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td style={{ textAlign: "center", color: "var(--text3)" }}>{it.srNo}</td>
                <td><input value={it.material} onChange={e => setItem(i, "material", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td><input value={it.requiredFor} onChange={e => setItem(i, "requiredFor", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td><input value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td><input value={it.remarks} onChange={e => setItem(i, "remarks", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => removeRow(i)} title="Remove row" style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="btn btn-sm" style={{ marginTop: 8 }}>＋ Add row</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="auth-field-label">{label}</span>{children}</label>;
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { fg: string; bg: string }> = {
    open: { fg: "#185FA5", bg: "#e0f2fe" },
    ordered: { fg: "#15803D", bg: "#dcf5dc" },
    closed: { fg: "#475569", bg: "#e2e8f0" },
  };
  const c = map[status] || map.open;
  return <span style={{ padding: "2px 10px", borderRadius: 999, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{status}</span>;
}
const cellInput: React.CSSProperties = { width: "100%", minWidth: 90 };
const searchInput: React.CSSProperties = { width: "100%", maxWidth: 460, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 };
