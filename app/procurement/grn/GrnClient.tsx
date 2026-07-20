"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { parseItems, fmtDate, type GrnItem, type PoItem } from "@/lib/procurement";

interface Grn {
  id: number; grnNo: number; poNo: number | null; date: string;
  receivedBy: string | null; verifiedBy: string | null; items: string;
}
interface OpenPo {
  id: number; poNo: number; supplierName: string | null; items: string;
}

const blankItem = (n: number): GrnItem => ({ srNo: n, gatePassNo: "", supplierName: "", item: "", quantity: "", remarks: "" });

export default function GrnClient({ rows, openPos }: { rows: Grn[]; openPos: OpenPo[] }) {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [poId, setPoId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receivedBy, setReceivedBy] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [items, setItems] = useState<GrnItem[]>([blankItem(1), blankItem(2), blankItem(3)]);

  function resetForm() {
    setPoId(""); setDate(new Date().toISOString().slice(0, 10)); setReceivedBy(""); setVerifiedBy("");
    setItems([blankItem(1), blankItem(2), blankItem(3)]); setErr("");
  }
  function pickPo(id: string) {
    setPoId(id);
    const p = openPos.find(x => String(x.id) === id);
    if (!p) return;
    const pItems = parseItems<PoItem>(p.items);
    if (pItems.length) {
      setItems(pItems.map((it, i) => ({ srNo: i + 1, gatePassNo: "", supplierName: p.supplierName || "", item: it.item, quantity: it.quantity, remarks: "" })));
    }
  }
  function setItem(i: number, k: keyof GrnItem, v: string) { setItems(l => l.map((it, idx) => idx === i ? { ...it, [k]: v } : it)); }
  function addRow() { setItems(l => [...l, blankItem(l.length + 1)]); }
  function removeRow(i: number) { setItems(l => l.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, srNo: idx + 1 }))); }

  async function save() {
    setBusy(true); setErr("");
    try {
      const clean = items.filter(it => it.item.trim());
      const res = await fetch("/api/procurement/grns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: poId || null, date, receivedBy, verifiedBy, items: clean }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setOpen(false); resetForm(); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function del(g: Grn) {
    if (!confirm(`Delete GRN #${g.grnNo}?`)) return;
    const res = await fetch(`/api/procurement/grns/${g.id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else alert("Delete failed");
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Goods Receiving Reports</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Record goods received against a PO, or standalone. <span style={{ color: "var(--text3)" }}>STR/QR/003</span></p>
        </div>
        {canEdit && <button onClick={() => { resetForm(); setOpen(o => !o); }} className="btn btn-primary">{open ? "✕ Close" : "＋ New GRN"}</button>}
      </div>

      {open && canEdit && (
        <div className="card" style={{ marginBottom: 18, padding: 18 }}>
          {err && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Field label="For PO (optional)">
              <select value={poId} onChange={e => pickPo(e.target.value)} className="auth-input">
                <option value="">— None (standalone GRN) —</option>
                {openPos.map(p => <option key={p.id} value={p.id}>PO #{p.poNo}{p.supplierName ? ` · ${p.supplierName}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="auth-input" /></Field>
          </div>

          <ItemsGrid items={items} setItem={setItem} addRow={addRow} removeRow={removeRow} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "14px 0" }}>
            <Field label="Received by (Store keeper)"><input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} className="auth-input" /></Field>
            <Field label="Verified by (Store Manager)"><input value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} className="auth-input" /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save GRN"}</button>
            <button onClick={() => setOpen(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead><tr><th>GRN #</th><th>PO #</th><th>Date</th><th>Received by</th><th className="num">Items</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No GRNs yet.</td></tr>
            ) : rows.map(g => (
              <tr key={g.id}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{g.grnNo}</td>
                <td>{g.poNo ? `#${g.poNo}` : "—"}</td>
                <td>{fmtDate(g.date)}</td>
                <td>{g.receivedBy || "—"}</td>
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

function ItemsGrid({ items, setItem, addRow, removeRow }: {
  items: GrnItem[]; setItem: (i: number, k: keyof GrnItem, v: string) => void; addRow: () => void; removeRow: (i: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>ITEMS RECEIVED</div>
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%" }}>
          <thead><tr><th style={{ width: 44 }}>S.No</th><th>Gate Pass No.</th><th>Supplier&apos;s Name</th><th>Item</th><th style={{ width: 100 }}>Quantity</th><th>Remarks</th><th style={{ width: 40 }}></th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td style={{ textAlign: "center", color: "var(--text3)" }}>{it.srNo}</td>
                <td><input value={it.gatePassNo} onChange={e => setItem(i, "gatePassNo", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td><input value={it.supplierName} onChange={e => setItem(i, "supplierName", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td><input value={it.item} onChange={e => setItem(i, "item", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td><input value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td><input value={it.remarks} onChange={e => setItem(i, "remarks", e.target.value)} className="auth-input" style={cellInput} /></td>
                <td style={{ textAlign: "center" }}><button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16 }}>✕</button></td>
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
const cellInput: React.CSSProperties = { width: "100%", minWidth: 90 };
