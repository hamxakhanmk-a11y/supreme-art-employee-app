"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { parseItems, fmtDate, lineTotal, money, type PoItem, type DemandItem } from "@/lib/procurement";

interface Po {
  id: number; poNo: number; demandNo: number | null; date: string;
  supplierName: string | null; expectedDate: string | null;
  items: string; status: string; discount: number | null;
}
interface OpenDemand {
  id: number; demandNo: number; demandBy: string | null; items: string;
}

const blankItem = (n: number): PoItem => ({ srNo: n, itemCode: "", item: "", specifications: "", quantity: "", uom: "", price: "" });

export default function PoClient({ rows, openDemands }: { rows: Po[]; openDemands: OpenDemand[] }) {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [demandId, setDemandId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [demandByName, setDemandByName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [specification, setSpecification] = useState("");
  const [terms, setTerms] = useState("");
  const [discount, setDiscount] = useState("0");
  const [orderPlacedBy, setOrderPlacedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [items, setItems] = useState<PoItem[]>([blankItem(1), blankItem(2), blankItem(3)]);

  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const total = subtotal - (parseFloat(discount) || 0);

  function resetForm() {
    setDemandId(""); setDate(new Date().toISOString().slice(0, 10)); setDemandByName("");
    setSupplierName(""); setSupplierContact(""); setSupplierAddress(""); setSupplierPhone("");
    setExpectedDate(""); setSpecification(""); setTerms(""); setDiscount("0");
    setOrderPlacedBy(""); setApprovedBy("");
    setItems([blankItem(1), blankItem(2), blankItem(3)]); setErr("");
  }
  function pickDemand(id: string) {
    setDemandId(id);
    const d = openDemands.find(x => String(x.id) === id);
    if (!d) return;
    setDemandByName(d.demandBy || "");
    const dItems = parseItems<DemandItem>(d.items);
    if (dItems.length) {
      setItems(dItems.map((it, i) => ({
        srNo: i + 1, itemCode: "", item: it.material, specifications: "",
        quantity: it.quantity, uom: "", price: "",
      })));
    }
  }
  function setItem(i: number, k: keyof PoItem, v: string) { setItems(l => l.map((it, idx) => idx === i ? { ...it, [k]: v } : it)); }
  function addRow() { setItems(l => [...l, blankItem(l.length + 1)]); }
  function removeRow(i: number) { setItems(l => l.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, srNo: idx + 1 }))); }

  async function save() {
    setBusy(true); setErr("");
    try {
      const clean = items.filter(it => it.item.trim());
      const res = await fetch("/api/procurement/pos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demandId: demandId || null, date, demandByName, supplierName, supplierContact,
          supplierAddress, supplierPhone, expectedDate, specification, terms,
          discount: parseFloat(discount) || 0, orderPlacedBy, approvedBy, items: clean,
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
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="auth-input" /></Field>
            <Field label="Delivery date"><input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="auth-input" /></Field>
            <Field label="Demand by"><input value={demandByName} onChange={e => setDemandByName(e.target.value)} className="auth-input" /></Field>
          </div>

          <SectionLabel>SUPPLIER (To:)</SectionLabel>
          <div style={grid}>
            <Field label="Supplier name"><input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="auth-input" /></Field>
            <Field label="Contact person / title"><input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} className="auth-input" placeholder="e.g. Sajjad Zaheer, Chief Executive" /></Field>
            <Field label="Address"><input value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)} className="auth-input" /></Field>
            <Field label="Phone"><input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} className="auth-input" /></Field>
          </div>

          <SectionLabel>ITEMS</SectionLabel>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Sr</th><th style={{ width: 110 }}>Item Code</th><th>Item Name</th>
                  <th style={{ width: 90 }}>Quantity</th><th style={{ width: 70 }}>UOM</th>
                  <th style={{ width: 120 }}>Specification</th><th style={{ width: 90 }}>Price</th>
                  <th style={{ width: 100 }}>Total</th><th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "center", color: "var(--text3)" }}>{it.srNo}</td>
                    <td><input value={it.itemCode} onChange={e => setItem(i, "itemCode", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td><input value={it.item} onChange={e => setItem(i, "item", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td><input value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td><input value={it.uom} onChange={e => setItem(i, "uom", e.target.value)} className="auth-input" style={cellInput} placeholder="Nos" /></td>
                    <td><input value={it.specifications} onChange={e => setItem(i, "specifications", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td><input value={it.price} onChange={e => setItem(i, "price", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(lineTotal(it))}</td>
                    <td style={{ textAlign: "center" }}><button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 16 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addRow} className="btn btn-sm" style={{ marginTop: 8 }}>＋ Add row</button>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <table style={{ fontSize: 13 }}>
              <tbody>
                <tr><td style={{ padding: "3px 12px" }}>Total before Discount</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(subtotal)}</td></tr>
                <tr>
                  <td style={{ padding: "3px 12px" }}>Discount</td>
                  <td><input value={discount} onChange={e => setDiscount(e.target.value)} className="auth-input" style={{ width: 110, textAlign: "right" }} /></td>
                </tr>
                <tr><td style={{ padding: "3px 12px", fontWeight: 700 }}>Total Amount</td><td style={{ textAlign: "right", fontWeight: 700 }}>{money(total)}</td></tr>
              </tbody>
            </table>
          </div>

          <SectionLabel>NOTES &amp; SIGN-OFF</SectionLabel>
          <div style={{ marginBottom: 12 }}>
            <Field label="Specification (free text)"><input value={specification} onChange={e => setSpecification(e.target.value)} className="auth-input" /></Field>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Field label="Terms & Conditions — one per line, numbered automatically">
              <textarea value={terms} onChange={e => setTerms(e.target.value)} className="auth-input" rows={5}
                placeholder={"Material will only be processed in QC…\nIn case of raw material, the required shelf life is minimum 75%…"} />
            </Field>
          </div>
          <div style={grid}>
            <Field label="Order placed by"><input value={orderPlacedBy} onChange={e => setOrderPlacedBy(e.target.value)} className="auth-input" /></Field>
            <Field label="Approved by"><input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} className="auth-input" /></Field>
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
            <tr><th>PO #</th><th>Demand #</th><th>Date</th><th>Supplier</th><th>Delivery</th><th className="num">Items</th><th className="num">Amount</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No purchase orders yet.</td></tr>
            ) : rows.map(p => {
              const its = parseItems<PoItem>(p.items);
              const amt = its.reduce((s, it) => s + lineTotal(it), 0) - Number(p.discount ?? 0);
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{p.poNo}</td>
                  <td>{p.demandNo ? `#${p.demandNo}` : "—"}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.supplierName || "—"}</td>
                  <td>{fmtDate(p.expectedDate)}</td>
                  <td className="num">{its.length}</td>
                  <td className="num">{amt ? money(amt) : "—"}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/procurement/po/${p.id}`} className="btn btn-sm" style={{ marginRight: 6 }}>View / Print</Link>
                    {canEdit && <button onClick={() => del(p)} className="btn btn-sm" style={{ color: "#A32D2D" }}>Delete</button>}
                  </td>
                </tr>
              );
            })}
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
const cellInput: React.CSSProperties = { width: "100%", minWidth: 80 };
