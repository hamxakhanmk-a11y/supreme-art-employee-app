"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { fmtDate, blankInspectionRows, type InspectionRow } from "@/lib/procurement";

interface Inspection {
  id: number; inspNo: number; poNo: number | null; date: string;
  materialType: string | null; supplierName: string | null;
  inspectedBy: string | null;
}
interface Po {
  id: number; poNo: number; supplierName: string | null;
}

export default function InspectionClient({ rows, pos }: { rows: Inspection[]; pos: Po[] }) {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [poId, setPoId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [materialType, setMaterialType] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [inspectedBy, setInspectedBy] = useState("");
  const [results, setResults] = useState<InspectionRow[]>(blankInspectionRows());

  function resetForm() {
    setPoId(""); setDate(new Date().toISOString().slice(0, 10));
    setMaterialType(""); setSupplierName(""); setInspectedBy("");
    setResults(blankInspectionRows()); setErr("");
  }
  // Selecting a PO stamps its number and pre-fills the supplier.
  function pickPo(id: string) {
    setPoId(id);
    const p = pos.find(x => String(x.id) === id);
    if (p) setSupplierName(p.supplierName || "");
  }
  function setStandard(i: number, v: string) {
    setResults(l => l.map((r, idx) => idx === i ? { ...r, standard: v } : r));
  }
  function setSample(i: number, s: number, v: string) {
    setResults(l => l.map((r, idx) => idx === i ? { ...r, samples: r.samples.map((x, si) => si === s ? v : x) } : r));
  }

  async function save() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/procurement/inspections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: poId || null, date, materialType, supplierName, inspectedBy, results }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setOpen(false); resetForm(); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function del(r: Inspection) {
    if (!confirm(`Delete Inspection #${r.inspNo}?`)) return;
    const res = await fetch(`/api/procurement/inspections/${r.id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else alert("Delete failed");
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Incoming Material Inspection</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Inspect material received against a PO. <span style={{ color: "var(--text3)" }}>QC/QR/004</span></p>
        </div>
        {canEdit && <button onClick={() => { resetForm(); setOpen(o => !o); }} className="btn btn-primary">{open ? "✕ Close" : "＋ New Inspection"}</button>}
      </div>

      {open && canEdit && (
        <div className="card" style={{ marginBottom: 18, padding: 18 }}>
          {err && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{err}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Field label="For PO (auto-fills PO No.)">
              <select value={poId} onChange={e => pickPo(e.target.value)} className="auth-input">
                <option value="">— None (standalone) —</option>
                {pos.map(p => <option key={p.id} value={p.id}>PO #{p.poNo}{p.supplierName ? ` · ${p.supplierName}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="auth-input" /></Field>
            <Field label="Type of material(s)"><input value={materialType} onChange={e => setMaterialType(e.target.value)} className="auth-input" /></Field>
            <Field label="Name of supplier"><input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="auth-input" /></Field>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>OBSERVATIONS</div>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Parameters</th>
                  <th>Standard</th>
                  <th>Sample 1</th><th>Sample 2</th><th>Sample 3</th><th>Sample 4</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{r.parameter}</td>
                    <td><input value={r.standard} onChange={e => setStandard(i, e.target.value)} className="auth-input" style={cellInput} /></td>
                    {r.samples.map((s, si) => (
                      <td key={si}><input value={s} onChange={e => setSample(i, si, e.target.value)} className="auth-input" style={cellInput} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, margin: "14px 0" }}>
            <Field label="Inspected by"><input value={inspectedBy} onChange={e => setInspectedBy(e.target.value)} className="auth-input" /></Field>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save Inspection"}</button>
            <button onClick={() => setOpen(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr><th>Insp #</th><th>PO #</th><th>Date</th><th>Material</th><th>Supplier</th><th>Inspected by</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No inspections yet.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{r.inspNo}</td>
                <td>{r.poNo ? `#${r.poNo}` : "—"}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.materialType || "—"}</td>
                <td>{r.supplierName || "—"}</td>
                <td>{r.inspectedBy || "—"}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/procurement/inspection/${r.id}`} className="btn btn-sm" style={{ marginRight: 6 }}>View / Print</Link>
                  {canEdit && <button onClick={() => del(r)} className="btn btn-sm" style={{ color: "#A32D2D" }}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="auth-field-label">{label}</span>{children}</label>;
}
const cellInput: React.CSSProperties = { width: "100%", minWidth: 70 };
