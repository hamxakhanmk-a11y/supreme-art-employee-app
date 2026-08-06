"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { parseItems, fmtDate, docNoLabel, type GrnItem } from "@/lib/procurement";

interface Grn {
  id: number; grnNo: number; gatePassNo: string | null; invNo: string | null; poNo: number | null;
  registered: boolean | null;
  date: string; verifiedBy: string | null; receivedBy: string | null; items: string;
}
interface OutLine { poSrNo: number; item: string; uom: string; remaining: string; ordered: string }
interface OpenPo {
  id: number; poNo: number; registered: boolean | null; supplierName: string | null; outstanding: OutLine[];
}

const blankItem = (n: number): GrnItem => ({ srNo: n, item: "", quantity: "", remarks: "" });

export default function GrnClient({ rows, openPos }: { rows: Grn[]; openPos: OpenPo[] }) {
  const router = useRouter();
  const canEdit = useCanEdit("grn");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNo, setEditNo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [listFilter, setListFilter] = useState<"all" | "reg" | "unreg">("all");

  // Which list the GRR belongs to — fixes its sequence (15000 vs 15000u).
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [poId, setPoId] = useState("");
  const [poNoManual, setPoNoManual] = useState("");
  const [gatePassNo, setGatePassNo] = useState("");
  const [invNo, setInvNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [verifiedBy, setVerifiedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [items, setItems] = useState<GrnItem[]>([blankItem(1), blankItem(2), blankItem(3)]);

  function resetForm() {
    setEditId(null); setEditNo(null); setRegistered(null);
    setPoId(""); setPoNoManual(""); setGatePassNo(""); setInvNo(""); setDate(new Date().toISOString().slice(0, 10));
    setVerifiedBy(""); setReceivedBy("");
    setItems([blankItem(1), blankItem(2), blankItem(3)]); setErr("");
  }
  // Creating is list-bound: a GRR is raised in the Registered or Unregistered
  // list, receiving against POs from that same list. The choice is made here.
  function startCreate(reg: boolean) {
    resetForm();
    setRegistered(reg);
    setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openEdit(g: Grn) {
    setEditId(g.id); setEditNo(g.grnNo); setRegistered(g.registered); setPoId("");
    setPoNoManual(g.poNo != null ? String(g.poNo) : "");
    setGatePassNo(g.gatePassNo || ""); setInvNo(g.invNo || "");
    setDate((g.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
    setVerifiedBy(g.verifiedBy || ""); setReceivedBy(g.receivedBy || "");
    const its = parseItems<GrnItem>(g.items);
    setItems(its.length
      ? its.map((it, i) => ({ srNo: i + 1, item: it.item || "", quantity: it.quantity || "", remarks: it.remarks || "", poSrNo: it.poSrNo }))
      : [blankItem(1)]);
    setErr(""); setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // Only POs from the same list are eligible — an unregistered GRR receives
  // unregistered POs, and vice-versa.
  const pickPos = openPos.filter(p => registered == null ? true : p.registered === registered);
  function pickPo(id: string) {
    setPoId(id);
    const p = openPos.find(x => String(x.id) === id);
    if (!p) return;
    setPoNoManual(String(p.poNo));   // auto-fill the ref, still editable
    // Only the lines still awaiting delivery, pre-filled with what's outstanding.
    if (p.outstanding.length) {
      setItems(p.outstanding.map((o, i) => ({
        srNo: i + 1, item: o.item, quantity: o.remaining, remarks: "", poSrNo: o.poSrNo,
      })));
    }
  }
  function setItem(i: number, k: "item" | "quantity" | "remarks", v: string) { setItems(l => l.map((it, idx) => idx === i ? { ...it, [k]: v } : it)); }
  function addRow() { setItems(l => [...l, blankItem(l.length + 1)]); }
  function removeRow(i: number) { setItems(l => l.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, srNo: idx + 1 }))); }

  async function save() {
    if (!gatePassNo.trim()) { setErr("Please enter the inward gate pass number."); return; }
    setBusy(true); setErr("");
    try {
      const clean = items.filter(it => it.item.trim());
      const res = await fetch(editId ? `/api/procurement/grns/${editId}` : "/api/procurement/grns", {
        method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId: poId || null, poNo: poNoManual, registered, gatePassNo, invNo, date, verifiedBy, receivedBy, items: clean }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setOpen(false); resetForm(); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function del(g: Grn) {
    if (!confirm(`Delete GRR #${docNoLabel(g.grnNo, g.registered)}?`)) return;
    const res = await fetch(`/api/procurement/grns/${g.id}`, { method: "DELETE" });
    if (res.ok) router.refresh(); else alert("Delete failed");
  }

  // ---- Registered / Unregistered GRR lists ----
  const counts = {
    all: rows.length,
    reg: rows.filter(g => g.registered === true).length,
    unreg: rows.filter(g => g.registered === false).length,
  };
  const shownRows = rows.filter(g =>
    listFilter === "all" ? true
    : listFilter === "reg" ? g.registered === true
    : g.registered === false);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Goods Receipts Reports (Store)</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Record goods received against a PO, or standalone.</p>
        </div>
        {canEdit && (open
          ? <button onClick={() => setOpen(false)} className="btn btn-primary">✕ Close</button>
          : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {listFilter !== "unreg" && <button onClick={() => startCreate(true)} className="btn btn-primary">＋ Registered GRR</button>}
              {listFilter !== "reg" && <button onClick={() => startCreate(false)} className="btn" style={{ borderColor: "#9A3412", color: "#9A3412" }}>＋ Unregistered GRR</button>}
            </div>
          ))}
      </div>

      {open && canEdit && (
        <div className="card" style={{ marginBottom: 18, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
            {editId ? `✏️ Edit GRR #${docNoLabel(editNo, registered)}` : `＋ New ${registered === false ? "Unregistered" : "Registered"} GRR`}
          </div>

          {/* The GRR's list is fixed here — it drives the GRR number and which POs are receivable. */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12,
            padding: "6px 12px", borderRadius: 8, fontSize: 12.5,
            background: registered === false ? "#fff7ed" : "#f0fdf4",
            border: `1px solid ${registered === false ? "#fed7aa" : "#bbf7d0"}`,
            color: registered === false ? "#9A3412" : "#166534",
          }}>
            <b>{registered === false ? "Unregistered list" : "Registered list"}</b>
            <span style={{ color: "var(--text3)" }}>
              {registered === false ? "— numbered 15000u series" : "— numbered 15000 series"}
            </span>
          </div>

          {err && <div style={{ color: "#7C1F1F", fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Field label={`For ${registered === false ? "unregistered" : "registered"} PO (optional)`}>
              <select value={poId} onChange={e => pickPo(e.target.value)} className="auth-input">
                <option value="">— None (standalone GRR) —</option>
                {pickPos.map(p => <option key={p.id} value={p.id}>PO #{docNoLabel(p.poNo, p.registered)}{p.supplierName ? ` · ${p.supplierName}` : ""}</option>)}
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
            <Field label="Inv No">
              <input value={invNo} onChange={e => setInvNo(e.target.value)} className="auth-input"
                placeholder="Supplier invoice #" />
            </Field>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="auth-input" /></Field>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>ITEMS RECEIVED</div>
          {poId && (
            <div style={{ fontSize: 11.5, color: "#185FA5", background: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
              Only items still awaiting delivery on this PO are shown, pre-filled with the outstanding quantity. Adjust the quantity to what actually arrived — the rest stays open for a later GRR.
            </div>
          )}
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead><tr><th style={{ width: 44 }}>S.No</th><th>Item(s)</th><th style={{ width: 130 }}>Quantity</th><th>Remarks</th><th style={{ width: 36 }}></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "center", color: "var(--text3)" }}>{it.srNo}</td>
                    <td><input value={it.item} onChange={e => setItem(i, "item", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td><input value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)} className="auth-input" style={cellInput} /></td>
                    <td><input value={it.remarks || ""} onChange={e => setItem(i, "remarks", e.target.value)} className="auth-input" style={cellInput} placeholder="e.g. 2 short, damaged…" /></td>
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

      {/* Registered / Unregistered GRR lists */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <FilterTab label="All" n={counts.all} active={listFilter === "all"} onClick={() => setListFilter("all")} />
        <FilterTab label="Registered" n={counts.reg} active={listFilter === "reg"} onClick={() => setListFilter("reg")} color="#166534" />
        <FilterTab label="Unregistered" n={counts.unreg} active={listFilter === "unreg"} onClick={() => setListFilter("unreg")} color="#9A3412" />
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead><tr><th>Gate Pass No</th><th>GRR #</th><th>Inv No</th><th>PO #</th><th>Date</th><th className="num">Items</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {shownRows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No GRRs{listFilter !== "all" ? " in this list" : ""} yet.</td></tr>
            ) : shownRows.map(g => (
              <tr key={g.id}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>{g.gatePassNo || "—"}</td>
                <td>#{docNoLabel(g.grnNo, g.registered)}</td>
                <td>{g.invNo || "—"}</td>
                <td>{g.poNo != null ? `#${docNoLabel(g.poNo, g.registered)}` : "—"}</td>
                <td>{fmtDate(g.date)}</td>
                <td className="num">{parseItems<GrnItem>(g.items).length}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/procurement/grn/${g.id}`} className="btn btn-sm" style={{ marginRight: 6 }}>View / Print</Link>
                  {canEdit && <button onClick={() => openEdit(g)} className="btn btn-sm" style={{ marginRight: 6 }}>Edit</button>}
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
// Registered / Unregistered filter pill above the GRR register.
function FilterTab({ label, n, active, onClick, color = "var(--brand)" }: {
  label: string; n: number; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
      border: `1px solid ${active ? color : "var(--border)"}`,
      background: active ? color : "transparent",
      color: active ? "#fff" : "var(--text2)",
    }}>{label} <span style={{ opacity: 0.85 }}>({n})</span></button>
  );
}
const cellInput: React.CSSProperties = { width: "100%", minWidth: 90 };
