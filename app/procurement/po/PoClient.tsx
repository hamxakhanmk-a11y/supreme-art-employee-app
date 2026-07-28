"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { parseItems, fmtDate, poLineMoney, fmtMoney, PO_DEFAULT_TERMS, PO_DEFAULT_TAX, type PoItem, type DemandItem } from "@/lib/procurement";

interface Po {
  id: number; poNo: number; demandNo: number | null; date: string;
  supplierName: string | null; expectedDate: string | null;
  items: string; status: string;
}
interface OpenDemand {
  id: number; demandNo: number; demandBy: string | null; items: string;
}

const blankItem = (n: number): PoItem => ({ srNo: n, description: "", quantity: "", uom: "", rate: "", tax: String(PO_DEFAULT_TAX) });

export default function PoClient({ rows, openDemands }: { rows: Po[]; openDemands: OpenDemand[] }) {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [demandId, setDemandId] = useState("");
  const [demandNoManual, setDemandNoManual] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierName, setSupplierName] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [terms, setTerms] = useState(PO_DEFAULT_TERMS.join("\n"));
  const [orderPlacedBy, setOrderPlacedBy] = useState("");
  const [items, setItems] = useState<PoItem[]>([blankItem(1), blankItem(2), blankItem(3)]);

  function resetForm() {
    setDemandId(""); setDemandNoManual(""); setDate(new Date().toISOString().slice(0, 10));
    setSupplierName(""); setSupplierAddress(""); setSupplierPhone("");
    setExpectedDate(""); setTerms(PO_DEFAULT_TERMS.join("\n")); setOrderPlacedBy("");
    setItems([blankItem(1), blankItem(2), blankItem(3)]); setErr("");
  }
  function pickDemand(id: string) {
    setDemandId(id);
    const d = openDemands.find(x => String(x.id) === id);
    if (!d) return;
    setDemandNoManual(String(d.demandNo));   // auto-fill the ref, still editable
    const dItems = parseItems<DemandItem>(d.items);
    if (dItems.length) {
      setItems(dItems.map((it, i) => ({ srNo: i + 1, description: it.material, quantity: it.quantity, uom: "", rate: "", tax: String(PO_DEFAULT_TAX) })));
    }
  }
  function setItem(i: number, k: keyof PoItem, v: string) { setItems(l => l.map((it, idx) => idx === i ? { ...it, [k]: v } : it)); }
  function addRow() { setItems(l => [...l, blankItem(l.length + 1)]); }
  function removeRow(i: number) { setItems(l => l.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, srNo: idx + 1 }))); }

  async function save() {
    setBusy(true); setErr("");
    try {
      const clean = items.filter(it => it.description.trim());
      const res = await fetch("/api/procurement/pos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demandId: demandId || null, demandNo: demandNoManual, date, supplierName, supplierAddress, supplierPhone,
          expectedDate, terms, orderPlacedBy, items: clean,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setOpen(false); resetForm(); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function del(p: Po) {
    if (!confirm(`Delete PO #${p.poNo}?`)) return;
    const res = await fetch(`/api/procurement/pos/${p.id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else alert("Delete failed");
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Purchase Orders</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Create a PO from a demand, or standalone. <span style={{ color: "var(--text3)" }}>PUR/QR/006</span></p>
        </div>
        {canEdit && <button onClick={() => { resetForm(); setOpen(o => !o); }} className="btn btn-primary">{open ? "✕ Close" : "＋ New PO"}</button>}
      </div>

      {open && canEdit && (
        <div className="card" style={{ marginBottom: 18, padding: 18 }}>
          {err && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{err}</div>}

          <SectionLabel>ORDER</SectionLabel>
          <div style={grid}>
            <Field label="From demand (optional)">
              <select value={demandId} onChange={e => pickDemand(e.target.value)} className="auth-input">
                <option value="">— None (standalone PO) —</option>
                {openDemands.map(d => <option key={d.id} value={d.id}>Demand #{d.demandNo}{d.demandBy ? ` · ${d.demandBy}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Demand Form Ref No (or type manually)">
              <input value={demandNoManual} onChange={e => setDemandNoManual(e.target.value)} className="auth-input"
                inputMode="numeric" placeholder="e.g. 5012" />
            </Field>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="auth-input" /></Field>
            <Field label="Delivery date"><input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="auth-input" /></Field>
          </div>

          <SectionLabel>SUPPLIER (To:)</SectionLabel>
          <div style={grid}>
            <Field label="Supplier name"><input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="auth-input" /></Field>
            <Field label="Address"><input value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)} className="auth-input" /></Field>
            <Field label="Contact #"><input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} className="auth-input" /></Field>
          </div>

          <SectionLabel>ITEMS <span style={{ fontWeight: 400, color: "var(--text3)" }}>· Gross, Tax Value &amp; Net Value are calculated automatically (default tax {PO_DEFAULT_TAX}%)</span></SectionLabel>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>S.No</th><th style={{ minWidth: 180 }}>Description</th>
                  <th style={{ width: 70 }}>Qty</th><th style={{ width: 70 }}>UOM</th>
                  <th style={{ width: 90 }}>Rate</th><th style={{ width: 100 }}>Gross</th>
                  <th style={{ width: 64 }}>Tax %</th><th style={{ width: 100 }}>Tax Value</th>
                  <th style={{ width: 110 }}>Net Value</th><th style={{ width: 34 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const { gross, taxValue, net } = poLineMoney(it);
                  return (
                    <tr key={i}>
                      <td style={{ textAlign: "center", color: "var(--text3)" }}>{it.srNo}</td>
                      <td><input value={it.description} onChange={e => setItem(i, "description", e.target.value)} className="auth-input" style={cellInput} /></td>
                      <td><input value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} className="auth-input" style={numInput} inputMode="decimal" /></td>
                      <td><input value={it.uom} onChange={e => setItem(i, "uom", e.target.value)} className="auth-input" style={numInput} placeholder="pcs" /></td>
                      <td><input value={it.rate} onChange={e => setItem(i, "rate", e.target.value)} className="auth-input" style={numInput} inputMode="decimal" /></td>
                      <td style={calcCell}>{fmtMoney(gross) || "—"}</td>
                      <td><input value={it.tax} onChange={e => setItem(i, "tax", e.target.value)} className="auth-input" style={numInput} inputMode="decimal" /></td>
                      <td style={calcCell}>{fmtMoney(taxValue) || "—"}</td>
                      <td style={{ ...calcCell, fontWeight: 700 }}>{fmtMoney(net) || "—"}</td>
                      <td style={{ textAlign: "center" }}><button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16 }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={addRow} className="btn btn-sm" style={{ marginTop: 8 }}>＋ Add row</button>

          <SectionLabel>TERMS &amp; SIGN-OFF</SectionLabel>
          <div style={{ marginBottom: 12 }}>
            <Field label="Terms & Conditions — one per line, numbered automatically">
              <textarea value={terms} onChange={e => setTerms(e.target.value)} className="auth-input" rows={5} />
            </Field>
          </div>
          <div style={grid}>
            <Field label="Order placed by"><input value={orderPlacedBy} onChange={e => setOrderPlacedBy(e.target.value)} className="auth-input" /></Field>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save PO"}</button>
            <button onClick={() => setOpen(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr><th>PO #</th><th>Demand #</th><th>Date</th><th>Supplier</th><th>Delivery</th><th className="num">Items</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No purchase orders yet.</td></tr>
            ) : rows.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{p.poNo}</td>
                <td>{p.demandNo ? `#${p.demandNo}` : "—"}</td>
                <td>{fmtDate(p.date)}</td>
                <td>{p.supplierName || "—"}</td>
                <td>{fmtDate(p.expectedDate)}</td>
                <td className="num">{parseItems<PoItem>(p.items).length}</td>
                <td><StatusBadge status={p.status} /></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/procurement/po/${p.id}`} className="btn btn-sm" style={{ marginRight: 6 }}>View / Print</Link>
                  {canEdit && <button onClick={() => del(p)} className="btn btn-sm" style={{ color: "#A32D2D" }}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", margin: "14px 0 6px", letterSpacing: 0.4 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="auth-field-label">{label}</span>{children}</label>;
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { fg: string; bg: string }> = {
    open: { fg: "#185FA5", bg: "#e0f2fe" }, received: { fg: "#15803D", bg: "#dcf5dc" }, closed: { fg: "#475569", bg: "#e2e8f0" },
  };
  const c = map[status] || map.open;
  return <span style={{ padding: "2px 10px", borderRadius: 999, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{status}</span>;
}
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 };
const cellInput: React.CSSProperties = { width: "100%", minWidth: 90 };
const numInput: React.CSSProperties = { width: "100%", minWidth: 50, textAlign: "right" };
const calcCell: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text2)", whiteSpace: "nowrap", paddingRight: 6 };
