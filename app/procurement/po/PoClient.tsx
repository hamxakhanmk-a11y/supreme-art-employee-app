"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCanEdit } from "@/components/MeProvider";
import { parseItems, fmtDate, poLineMoney, fmtMoney, poGrandTotal, financialYear, normSupplier, docNoLabel, UNREGISTERED_YEAR_LIMIT, PO_DEFAULT_TERMS, PO_DEFAULT_TAX, type PoItem, type DemandItem } from "@/lib/procurement";
import { downloadWorkbookXlsx } from "@/lib/xlsx";

interface Po {
  id: number; poNo: number; demandNo: number | null; date: string;
  supplierName: string | null; supplierAddress: string | null; supplierPhone: string | null;
  expectedDate: string | null; terms: string | null; orderPlacedBy: string | null;
  items: string; status: string; registered: boolean | null; discount: number | null;
}
interface OpenDemand {
  id: number; demandNo: number; demandBy: string | null; items: string;
}
interface Supplier { id: number; name: string; address: string | null; contact: string | null; registered: boolean | null }

const blankItem = (n: number): PoItem => ({ srNo: n, description: "", quantity: "", uom: "", rate: "", tax: String(PO_DEFAULT_TAX) });

export default function PoClient({ rows, openDemands, suppliers }: { rows: Po[]; openDemands: OpenDemand[]; suppliers: Supplier[] }) {
  const router = useRouter();
  const canEdit = useCanEdit("po");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNo, setEditNo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [demandId, setDemandId] = useState("");
  const [demandNoManual, setDemandNoManual] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierList, setSupplierList] = useState<Supplier[]>(suppliers);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierMsg, setSupplierMsg] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [terms, setTerms] = useState(PO_DEFAULT_TERMS.join("\n"));
  const [orderPlacedBy, setOrderPlacedBy] = useState("");
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [items, setItems] = useState<PoItem[]>([blankItem(1), blankItem(2), blankItem(3)]);
  const [taxFilter, setTaxFilter] = useState<"all" | "reg" | "unreg" | "unmarked">("all");

  function resetForm() {
    setEditId(null); setEditNo(null);
    setDemandId(""); setDemandNoManual(""); setDate(new Date().toISOString().slice(0, 10));
    setSelectedSupplierId(""); setSupplierMsg("");
    setSupplierName(""); setSupplierAddress(""); setSupplierPhone("");
    setExpectedDate(""); setTerms(PO_DEFAULT_TERMS.join("\n")); setOrderPlacedBy("");
    setRegistered(null);
    setItems([blankItem(1), blankItem(2), blankItem(3)]); setErr("");
  }
  // Creating is list-bound: you start a PO in the Registered or Unregistered
  // list, and that decides its sequence (10000 vs 10000u). It can't be changed
  // afterwards, so the choice is made here, not with a toggle inside the form.
  function startCreate(reg: boolean) {
    resetForm();
    setRegistered(reg);
    setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openEdit(p: Po) {
    setEditId(p.id); setEditNo(p.poNo);
    setDemandId(""); setSelectedSupplierId(""); setSupplierMsg("");
    setDemandNoManual(p.demandNo != null ? String(p.demandNo) : "");
    setDate((p.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
    setSupplierName(p.supplierName || ""); setSupplierAddress(p.supplierAddress || ""); setSupplierPhone(p.supplierPhone || "");
    setExpectedDate((p.expectedDate || "").slice(0, 10));
    setTerms(p.terms || ""); setOrderPlacedBy(p.orderPlacedBy || "");
    setRegistered(p.registered);
    const its = parseItems<PoItem>(p.items);
    setItems(its.length
      ? its.map((it, i) => ({ srNo: i + 1, description: it.description || it.item || "", quantity: it.quantity || "", uom: it.uom || "", rate: it.rate || "", tax: it.tax ?? String(PO_DEFAULT_TAX) }))
      : [blankItem(1)]);
    setErr(""); setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // Remove the selected saved supplier from the directory (POs keep their copy).
  async function deleteSupplier() {
    const s = supplierList.find(x => String(x.id) === selectedSupplierId);
    if (!s) return;
    if (!confirm(`Remove "${s.name}" from the saved supplier list?`)) return;
    setSupplierMsg("");
    try {
      const res = await fetch("/api/procurement/suppliers", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Delete failed"); }
      setSupplierList(list => list.filter(x => x.id !== s.id));
      setSelectedSupplierId("");
      setSupplierMsg("Removed from list ✓");
      setTimeout(() => setSupplierMsg(""), 2500);
    } catch (e) { setSupplierMsg(e instanceof Error ? e.message : "Delete failed"); }
  }
  // Pick a saved supplier → auto-fill the three fields (all still editable).
  function pickSupplier(id: string) {
    setSelectedSupplierId(id);
    const s = supplierList.find(x => String(x.id) === id);
    if (!s) return;
    setSupplierName(s.name);
    setSupplierAddress(s.address || "");
    setSupplierPhone(s.contact || "");
    if (s.registered != null) setRegistered(s.registered);
  }
  // Save whatever's typed to the supplier directory (dedupes by name server-side).
  async function saveSupplier() {
    const name = supplierName.trim();
    if (!name) return;
    setSavingSupplier(true); setSupplierMsg("");
    try {
      const res = await fetch("/api/procurement/suppliers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: supplierAddress, contact: supplierPhone, registered }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      const s: Supplier = j.supplier;
      setSupplierList(list => [...list.filter(x => x.id !== s.id), s].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedSupplierId(String(s.id));
      setSupplierMsg(j.existed ? "Updated in list ✓" : "Saved to list ✓");
      setTimeout(() => setSupplierMsg(""), 2500);
    } catch (e) { setSupplierMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setSavingSupplier(false); }
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
      const res = await fetch(editId ? `/api/procurement/pos/${editId}` : "/api/procurement/pos", {
        method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demandId: demandId || null, demandNo: demandNoManual, date, supplierName, supplierAddress, supplierPhone,
          expectedDate, terms, orderPlacedBy, registered, items: clean,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setOpen(false); resetForm(); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function del(p: Po) {
    const label = docNoLabel(p.poNo, p.registered);
    const msg = p.registered === false
      ? `Delete PO #${label}? Its GRR(s) will be deleted along with it.`
      : `Delete PO #${label}?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/procurement/pos/${p.id}`, { method: "DELETE" });
    if (res.ok) { router.refresh(); return; }
    const j = await res.json().catch(() => ({}));
    alert(j.error || "Delete failed");
  }
  // ---- Unregistered-supplier yearly limit (per supplier, current FY) ----
  const fy = financialYear();
  // Amount already committed to an unregistered supplier this FY (excluding the
  // PO currently being edited so it doesn't count against itself).
  function unregUsed(name: string): number {
    const key = normSupplier(name);
    if (!key) return 0;
    return rows
      .filter(p => p.registered === false && p.id !== editId
        && normSupplier(p.supplierName) === key
        && (p.date || "").slice(0, 10) >= fy.start && (p.date || "").slice(0, 10) <= fy.end)
      .reduce((s, p) => s + poGrandTotal(parseItems<PoItem>(p.items), p.discount), 0);
  }
  const thisPoTotal = poGrandTotal(items, null);
  const usedForForm = registered === false ? unregUsed(supplierName) : 0;
  const remainingForForm = UNREGISTERED_YEAR_LIMIT - usedForForm;
  const projected = usedForForm + thisPoTotal;
  const overLimit = registered === false && projected > UNREGISTERED_YEAR_LIMIT;

  // ---- Tax-status filter for the PO register (Registered / Unregistered lists) ----
  const counts = {
    all: rows.length,
    reg: rows.filter(p => p.registered === true).length,
    unreg: rows.filter(p => p.registered === false).length,
    unmarked: rows.filter(p => p.registered == null).length,
  };
  const shownRows = rows.filter(p =>
    taxFilter === "all" ? true
    : taxFilter === "reg" ? p.registered === true
    : taxFilter === "unreg" ? p.registered === false
    : p.registered == null);

  // Export the registered & unregistered PO lists as an Excel workbook.
  function exportPos() {
    const statusText = (s: string) => ({ open: "Open", partial: "Partially Received", received: "Received", closed: "Closed" }[s] || s);
    const sheet = (name: string, list: Po[]) => ({
      sheetName: name, title: `${name} Purchase Orders`,
      headers: ["PO #", "Demand #", "Date", "Supplier", "Delivery", "Items", "Total (Rs)", "Status", "Order placed by"],
      freezeCols: 1, colWidths: [8, 10, 13, 30, 13, 7, 14, 16, 20],
      rows: list.map(p => [
        docNoLabel(p.poNo, p.registered), p.demandNo ?? "", fmtDate(p.date), p.supplierName || "", fmtDate(p.expectedDate),
        parseItems<PoItem>(p.items).length, poGrandTotal(parseItems<PoItem>(p.items), p.discount),
        statusText(p.status), p.orderPlacedBy || "",
      ]),
    });
    downloadWorkbookXlsx({
      filename: `purchase-orders_${new Date().toISOString().slice(0, 10)}`,
      sheets: [
        sheet("Registered", rows.filter(p => p.registered === true)),
        sheet("Unregistered", rows.filter(p => p.registered === false)),
      ],
    });
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Purchase Orders</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Create a PO from a demand, or standalone. <span style={{ color: "var(--text3)" }}>PUR/QR/006</span></p>
        </div>
        {canEdit && (open
          ? <button onClick={() => setOpen(false)} className="btn btn-primary">✕ Close</button>
          : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {taxFilter !== "unreg" && <button onClick={() => startCreate(true)} className="btn btn-primary">＋ Registered PO</button>}
              {taxFilter !== "reg" && <button onClick={() => startCreate(false)} className="btn" style={{ borderColor: "#9A3412", color: "#9A3412" }}>＋ Unregistered PO</button>}
            </div>
          ))}
      </div>

      {open && canEdit && (
        <div className="card" style={{ marginBottom: 18, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
            {editId ? `✏️ Edit PO #${docNoLabel(editNo, registered)}` : `＋ New ${registered === false ? "Unregistered" : "Registered"} PO`}
          </div>
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
            <Field label="Pick a saved supplier (optional)">
              <select value={selectedSupplierId} onChange={e => pickSupplier(e.target.value)} className="auth-input">
                <option value="">— Choose saved / type below —</option>
                <optgroup label="Registered">
                  {supplierList.filter(s => s.registered === true).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
                <optgroup label="Unregistered">
                  {supplierList.filter(s => s.registered === false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
                <optgroup label="Unmarked">
                  {supplierList.filter(s => s.registered == null).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              </select>
            </Field>
            <Field label="Supplier name">
              <input value={supplierName} onChange={e => { setSupplierName(e.target.value); setSelectedSupplierId(""); }} className="auth-input" />
            </Field>
            <Field label="Address"><input value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)} className="auth-input" /></Field>
            <Field label="Contact #"><input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} className="auth-input" /></Field>
          </div>

          {/* Tax status is fixed by the list this PO is being created in. */}
          <div style={{
            marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            padding: "6px 12px", borderRadius: 8, fontSize: 12.5,
            background: registered === false ? "#fff7ed" : "#f0fdf4",
            border: `1px solid ${registered === false ? "#fed7aa" : "#bbf7d0"}`,
            color: registered === false ? "#9A3412" : "#166534",
          }}>
            <b>{registered === false ? "Unregistered list" : "Registered list"}</b>
            <span style={{ color: "var(--text3)" }}>
              {registered === false
                ? "— no sales-tax invoice · numbered 10000u series"
                : "— sales-tax invoice · numbered 10000 series"}
            </span>
          </div>

          {registered === false && supplierName.trim() && (
            <div style={{
              marginTop: 8, padding: "9px 12px", borderRadius: 8, fontSize: 12.5,
              background: overLimit ? "#fef2f2" : "#f0fdf4",
              border: `1px solid ${overLimit ? "#fecaca" : "#bbf7d0"}`,
              color: overLimit ? "#991B1B" : "#166534",
            }}>
              <b>Unregistered limit · FY {fy.label}</b> — used Rs {usedForForm.toLocaleString("en-US")} of {UNREGISTERED_YEAR_LIMIT.toLocaleString("en-US")} with <b>{supplierName.trim()}</b>.
              {" "}This PO Rs {thisPoTotal.toLocaleString("en-US")} → {remainingForForm > 0
                ? <>Rs {Math.max(0, remainingForForm).toLocaleString("en-US")} left {overLimit && <b>· this order exceeds the limit by Rs {(projected - UNREGISTERED_YEAR_LIMIT).toLocaleString("en-US")}</b>}</>
                : <b>limit already reached</b>}
            </div>
          )}
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={saveSupplier} disabled={savingSupplier || !supplierName.trim()} className="btn btn-sm">
              {savingSupplier ? "Saving…" : "＋ Save this supplier to the list"}
            </button>
            {selectedSupplierId && (
              <button type="button" onClick={deleteSupplier} className="btn btn-sm" style={{ color: "#A32D2D" }}>
                🗑 Remove from list
              </button>
            )}
            {supplierMsg && <span style={{ fontSize: 12, color: supplierMsg.includes("✓") ? "#166534" : "#7C1F1F", fontWeight: 600 }}>{supplierMsg}</span>}
            <span style={{ fontSize: 11.5, color: "var(--text3)" }}>Pick from the list to auto-fill, or just type — saving is optional.</span>
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

      {/* Registered / Unregistered lists = the PO register, filtered by tax status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <FilterTab label="All" n={counts.all} active={taxFilter === "all"} onClick={() => setTaxFilter("all")} />
        <FilterTab label="Registered" n={counts.reg} active={taxFilter === "reg"} onClick={() => setTaxFilter("reg")} color="#166534" />
        <FilterTab label="Unregistered" n={counts.unreg} active={taxFilter === "unreg"} onClick={() => setTaxFilter("unreg")} color="#9A3412" />
        {counts.unmarked > 0 && <FilterTab label="Unmarked" n={counts.unmarked} active={taxFilter === "unmarked"} onClick={() => setTaxFilter("unmarked")} color="#64748B" />}
        <div style={{ flex: 1 }} />
        <button onClick={exportPos} className="btn btn-sm">⬇ Excel (both lists)</button>
      </div>

      {taxFilter === "unreg" && counts.unreg > 0 && (
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>
          Unregistered supplier cap: <b>{UNREGISTERED_YEAR_LIMIT.toLocaleString("en-US")}</b> per supplier · financial year {fy.label}.
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr><th>PO #</th><th>Demand #</th><th>Date</th><th>Supplier</th><th>Delivery</th><th className="num">Items</th><th>Tax status</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {shownRows.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>No purchase orders{taxFilter !== "all" ? " in this list" : ""} yet.</td></tr>
            ) : shownRows.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{docNoLabel(p.poNo, p.registered)}</td>
                <td>{p.demandNo ? `#${p.demandNo}` : "—"}</td>
                <td>{fmtDate(p.date)}</td>
                <td>{p.supplierName || "—"}</td>
                <td>{fmtDate(p.expectedDate)}</td>
                <td className="num">{parseItems<PoItem>(p.items).length}</td>
                <td><TaxCell p={p} /></td>
                <td><StatusBadge status={p.status} /></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/procurement/po/${p.id}`} className="btn btn-sm" style={{ marginRight: 6 }}>View / Print</Link>
                  {canEdit && <button onClick={() => openEdit(p)} className="btn btn-sm" style={{ marginRight: 6 }}>Edit</button>}
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

// Tax-status badge. A PO's list is fixed at creation (it drives the number),
// so this is a read-only label — there's no in-place toggle anymore.
function TaxCell({ p }: { p: Po }) {
  const badge = p.registered === true
    ? { t: "Registered", fg: "#166534", bg: "#dcfce7" }
    : p.registered === false
      ? { t: "Unregistered", fg: "#9A3412", bg: "#ffedd5" }
      : { t: "—", fg: "#64748B", bg: "#f1f5f9" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, background: badge.bg, color: badge.fg, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{badge.t}</span>
  );
}

// Tax-status filter pill above the PO register.
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", margin: "14px 0 6px", letterSpacing: 0.4 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="auth-field-label">{label}</span>{children}</label>;
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { fg: string; bg: string; label: string }> = {
    open: { fg: "#185FA5", bg: "#e0f2fe", label: "Open" },
    partial: { fg: "#B45309", bg: "#fef3c7", label: "Partially Received" },
    received: { fg: "#15803D", bg: "#dcf5dc", label: "Received" },
    closed: { fg: "#475569", bg: "#e2e8f0", label: "Closed" },
  };
  const c = map[status] || map.open;
  return <span style={{ padding: "2px 10px", borderRadius: 999, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700 }}>{c.label}</span>;
}
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 };
const cellInput: React.CSSProperties = { width: "100%", minWidth: 90 };
const numInput: React.CSSProperties = { width: "100%", minWidth: 50, textAlign: "right" };
const calcCell: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text2)", whiteSpace: "nowrap", paddingRight: 6 };
