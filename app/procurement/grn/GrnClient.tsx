"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { parseItems, fmtDate, type GrnItem, type PoItem } from "@/lib/procurement";

interface Grn {
  id: number; grnNo: number; gatePassNo: string | null; poNo: number | null; date: string; items: string;
}
interface OpenPo {
  id: number; poNo: number; supplierName: string | null; items: string;
}

const blankItem = (n: number): GrnItem => ({ srNo: n, item: "", quantity: "" });

export default function GrnClient({ rows, openPos }: { rows: Grn[]; openPos: OpenPo[] }) {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [poId, setPoId] = useState("");
  const [poNoManual, setPoNoManual] = useState("");
  const [gatePassNo, setGatePassNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [verifiedBy, setVerifiedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [items, setItems] = useState<GrnItem[]>([blankItem(1), blankItem(2), blankItem(3)]);

  function resetForm() {
    setPoId(""); setPoNoManual(""); setGatePassNo(""); setDate(new Date().toISOString().slice(0, 10));
    setVerifiedBy(""); setReceivedBy("");
    setItems([blankItem(1), blankItem(2), blankItem(3)]); setErr("");
  }
  function pickPo(id: string) {
    setPoId(id);
    const p = openPos.find(x => String(x.id) === id);
    if (!p) return;
    setPoNoManual(String(p.poNo));   // auto-fill the ref, still editable
    const pItems = parseItems<PoItem>(p.items);
    if (pItems.length) {
      setItems(pItems.map((it, i) => ({ srNo: i + 1, item: it.description || it.item || "", quantity: it.quantity })));
    }
  }
  function setItem(i: number, k: keyof GrnItem, v: string) { setItems(l => l.map((it, idx) => idx === i ? { ...it, [k]: v } : it)); }
  function addRow() { setItems(l => [...l, blankItem(l.length + 1)]); }
  function removeRow(i: number) { setItems(l => l.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, srNo: idx + 1 }))); }

  async function save() {
    if (!gatePassNo.trim()) { setErr("Please enter the inward gate pass number."); return; }
    setBusy(true); setErr("");
    try {
      const clean = items.filter(it => it.item.trim());
      const res = await fetch("/api/procurement/grns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: poId || null, poNo: poNoManual, gatePassNo, date, verifiedBy, receivedBy, items: clean }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setOpen(false); resetForm(); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function del(g: Grn) {
    if (!confirm(`Delete GRR #${g.grnNo}?`)) return;
    const res = await fetch(`/api/procurement/grns/${g.id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else alert("Delete failed");
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Goods Receipts Reports (Store)</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Record goods received against a PO, or standalone.</p>
        </div>
        {canEdit && <button onClick={() => { resetForm(); setOpen(o => !o); }} className="btn btn-primary">{open ? "✕ Close" : "＋ New GRR"}</button>}
      </div>

      {open && canEdit && (
        <div className="card" style={{ marginBottom: 18, padding: 18 }}>
          {err && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Field label="For PO (optional)">
              <select value={poId} onChange={e => pickPo(e.target.value)} className="auth-input">
                <option value="">— None (standalone GRR) —</option>
                {openPos.map(p => <option key={p.id} value={p.id}>PO #{p.poNo}{p.supplierName ? ` · ${p.supplierName}` : ""}</option>)}
              </select>
            </Field>
            <Field label="PO Ref No (or type manually)">
              <input value={poNoManual} onChange={e => setPoNoManual(e.target.value)} className="auth-input"
                inputMode="numeric" placeholder="e.g. 10012" />
            </Field>
            <Field label="Inward gate pass No *">
              <input value={gatePassNo} onChange={e => setGatePassNo(e.target.value)} className="auth-input"
                required placeholder="e.g. 12001" />
            </Field>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="auth-input" /></Field>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>ITEMS RECEIVED</div>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead><tr><th style={{ width: 44 }}>S.No</th><th>Item(s)</th><th style={{ width: 140 }}>Quantity</th><th style={{ width: 36 }}></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "center", color: "var(--text3)" }}>{it.srNo}</td>
                    <td><input value={it.item} onChange={e => setItem(i, "item", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td><input value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td style={{ textAlign: "center" }}><button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addRow} className="btn btn-sm" style={{ marginTop: 8 }}>＋ Add row</button>

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", margin: "14px 0 6px" }}>SIGN-OFF</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            <Field label="Checked by"><input value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} className="auth-input" /></Field>
            <Field label="Received by (Store In-Charge)"><input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} className="auth-input" /></Field>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save GRR"}</button>
            <button onClick={() => setOpen(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead><tr><th>Gate Pass No</th><th>GRR #</th><th>PO #</th><th>Date</th><th className="num">Items</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No GRRs yet.</td></tr>
            ) : rows.map(g => (
              <tr key={g.id}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>{g.gatePassNo || "—"}</td>
                <td>#{g.grnNo}</td>
                <td>{g.poNo ? `#${g.poNo}` : "—"}</td>
                <td>{fmtDate(g.date)}</td>
                <td className="num">{parseItems<GrnItem>(g.items).length}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/procurement/grn/${g.id}`} className="btn btn-sm" style={{ marginRight: 6 }}>View / Print</Link>
                  {canEdit && <button onClick={() => del(g)} className="btn btn-sm" style={{ color: "#A32D2D" }}>Delete</button>}
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
const cellInput: React.CSSProperties = { width: "100%", minWidth: 90 };
