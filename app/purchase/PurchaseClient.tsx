"use client";
import { useMemo, useState } from "react";
import PrintHeader from "@/components/PrintHeader";
import PrintLandscape, { printLandscape } from "@/components/PrintLandscape";
import { useMe } from "@/components/MeProvider";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import {
  PR_DEPARTMENTS, PR_CATEGORIES, PR_UNITS, PR_STATUSES, PR_STATUS_STYLE,
  parsePrItems, prItemsTotal, type PrItem,
} from "@/lib/purchase";

// Raw row as it comes back from the server (items is a JSON string, plus the
// legacy scalar columns). We normalise it into PrRow for the UI.
type RawPr = {
  id: number; prNo: number | null; date: string | null; department: string | null;
  concernedPerson: string | null; items?: unknown; category?: string | null;
  itemName?: string | null; quantity?: number | null; uom?: string | null;
  receivedByAdmin: boolean; receivedDate?: string | null; value: number | null;
  requiredDate: string | null; hodApproval: string | null; hrApproval: string | null;
  status: string; poNo: string | null; remarks: string | null;
};

export type PrRow = {
  id: number;
  prNo: number | null;
  date: string | null;
  department: string | null;
  concernedPerson: string | null;
  items: PrItem[];
  receivedByAdmin: boolean;
  receivedDate: string | null;
  value: number | null;          // total across items
  requiredDate: string | null;
  hodApproval: string | null;    // Approved | Not Approved | null
  hrApproval: string | null;     // Approved | Rejected | null
  status: string;
  poNo: string | null;
  remarks: string | null;
};

function normalize(raw: RawPr): PrRow {
  const items = parsePrItems(raw);
  return {
    id: raw.id,
    prNo: raw.prNo ?? null,
    date: raw.date ?? null,
    department: raw.department ?? null,
    concernedPerson: raw.concernedPerson ?? null,
    items,
    receivedByAdmin: !!raw.receivedByAdmin,
    receivedDate: raw.receivedDate ?? null,
    value: prItemsTotal(items),
    requiredDate: raw.requiredDate ?? null,
    hodApproval: raw.hodApproval ?? null,
    hrApproval: raw.hrApproval ?? null,
    status: raw.status ?? "PR Raised",
    poNo: raw.poNo ?? null,
    remarks: raw.remarks ?? null,
  };
}

type ItemDraft = { itemName: string; category: string; quantity: string; uom: string; value: string };
type Draft = {
  date: string; prNo: string; department: string; concernedPerson: string;
  items: ItemDraft[];
  receivedByAdmin: boolean; receivedDate: string;
  requiredDate: string; hodApproval: string; hrApproval: string; status: string;
  poNo: string; remarks: string;
};

const emptyItemDraft = (): ItemDraft => ({ itemName: "", category: "", quantity: "", uom: "", value: "" });
const emptyDraft = (): Draft => ({
  date: new Date().toISOString().slice(0, 10),
  prNo: "", department: "", concernedPerson: "",
  items: [emptyItemDraft()],
  receivedByAdmin: false, receivedDate: "",
  requiredDate: "", hodApproval: "", hrApproval: "", status: "PR Raised", poNo: "", remarks: "",
});

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

export default function PurchaseClient({ initialRows }: { initialRows: RawPr[] }) {
  const me = useMe();
  const isSuper = me.user?.role === "superadmin";
  const canRaise      = isSuper || me.modules.includes("purchase.raise");
  const canEditPr     = isSuper || me.modules.includes("purchase.edit");
  const canReceive    = isSuper || me.modules.includes("purchase.receive");
  const canDeletePr   = isSuper || me.modules.includes("purchase.delete");
  const canHrApprove  = isSuper || me.modules.includes("purchase.hr-approve");
  const [rows, setRows] = useState<PrRow[]>(initialRows.map(normalize));
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => rows.filter(r => {
    if (dept && r.department !== dept) return false;
    if (cat && !r.items.some(i => i.category === cat)) return false;
    if (status && r.status !== status) return false;
    if (fromDate || toDate) {
      const d = r.date ? r.date.slice(0, 10) : "";
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      const hay = `${r.prNo ?? ""} ${r.items.map(i => i.itemName).join(" ")} ${r.concernedPerson ?? ""} ${r.poNo ?? ""} ${r.remarks ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [rows, q, dept, cat, status, fromDate, toDate]);

  const totalValue = useMemo(() => filtered.reduce((s, r) => s + (r.value ?? 0), 0), [filtered]);

  const set = (patch: Partial<Draft>) => setDraft(prev => ({ ...prev, ...patch }));
  const setItem = (idx: number, patch: Partial<ItemDraft>) =>
    setDraft(prev => ({ ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const addItem = () => setDraft(prev => ({ ...prev, items: [...prev.items, emptyItemDraft()] }));
  const removeItem = (idx: number) =>
    setDraft(prev => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== idx) : prev.items }));

  const openNew = () => {
    const maxPr = rows.reduce((m, r) => Math.max(m, r.prNo ?? 0), 0);
    setDraft({ ...emptyDraft(), prNo: String(maxPr + 1) });
    setEditId(null); setShowForm(true); setError(null);
  };
  const openEdit = (r: PrRow) => {
    setDraft({
      date: r.date ?? "", prNo: r.prNo === null ? "" : String(r.prNo),
      department: r.department ?? "", concernedPerson: r.concernedPerson ?? "",
      items: (r.items.length ? r.items : [{ itemName: "", category: "", quantity: null, uom: "", value: null }]).map(i => ({
        itemName: i.itemName, category: i.category, uom: i.uom,
        quantity: i.quantity === null ? "" : String(i.quantity),
        value: i.value === null ? "" : String(i.value),
      })),
      receivedByAdmin: r.receivedByAdmin, receivedDate: r.receivedDate ?? "",
      requiredDate: r.requiredDate ?? "", hodApproval: r.hodApproval ?? "", hrApproval: r.hrApproval ?? "",
      status: r.status, poNo: r.poNo ?? "", remarks: r.remarks ?? "",
    });
    setEditId(r.id); setShowForm(true); setError(null);
  };

  const save = async () => {
    const items = draft.items.filter(i => i.itemName.trim());
    if (!draft.date || !draft.prNo.trim() || !draft.department || items.length === 0) {
      setError("Date, PR No, Department and at least one item name are required."); return;
    }
    const body = {
      ...draft,
      items,
      // Default the received date to today when marked received but left blank.
      receivedDate: draft.receivedByAdmin ? (draft.receivedDate || new Date().toISOString().slice(0, 10)) : "",
    };
    setBusy(true); setError(null);
    try {
      const res = await fetch(editId === null ? "/api/purchase" : `/api/purchase/${editId}`, {
        method: editId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      const row = normalize(j);
      setRows(prev => editId === null ? [row, ...prev] : prev.map(r => (r.id === editId ? row : r)));
      setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (r: PrRow) => {
    if (!confirm(`Delete PR #${r.prNo ?? "—"} — ${r.items[0]?.itemName ?? "(no item)"}? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/purchase/${r.id}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Delete failed"); }
      setRows(prev => prev.filter(x => x.id !== r.id));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // Quick workflow toggles from the row buttons. Optimistic: the row flips
  // instantly, then reconciles against the server (reverting only on failure).
  type Action = "approve" | "reject" | "received";
  const act = async (r: PrRow, action: Action) => {
    const opt: PrRow = { ...r };
    if (action === "approve") opt.hrApproval = r.hrApproval === "Approved" ? null : "Approved";
    else if (action === "reject") opt.hrApproval = r.hrApproval === "Rejected" ? null : "Rejected";
    else if (action === "received") {
      const on = r.status !== "Material Received";
      opt.status = on ? "Material Received" : "PR Raised";
      opt.receivedByAdmin = on;
      opt.receivedDate = on ? new Date().toISOString().slice(0, 10) : null;
    }
    setError(null);
    setRows(prev => prev.map(x => (x.id === r.id ? opt : x)));
    try {
      const res = await fetch(`/api/purchase/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Action failed");
      setRows(prev => prev.map(x => (x.id === r.id ? normalize(j) : x)));
    } catch (e: any) {
      setError(e.message);
      setRows(prev => prev.map(x => (x.id === r.id ? r : x)));
    }
  };

  // Enter/adjust the value of a single item from the register (after receipt).
  const editItemValue = async (r: PrRow, itemIndex: number) => {
    const item = r.items[itemIndex];
    if (!item) return;
    const raw = window.prompt(`Value for "${item.itemName}" (PKR)\nLeave blank to clear.`,
      item.value === null ? "" : String(item.value));
    if (raw === null) return; // cancelled
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!isFinite(value) || value < 0)) {
      setError("Value must be a positive number.");
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/purchase/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-item-value", itemIndex, value }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setRows(prev => prev.map(x => (x.id === r.id ? normalize(j) : x)));
    } catch (e: any) { setError(e.message); }
  };

  const editRemarks = async (r: PrRow) => {
    const raw = window.prompt(`Remarks for PR #${r.prNo ?? "—"}`, r.remarks ?? "");
    if (raw === null) return; // cancelled
    setError(null);
    try {
      const res = await fetch(`/api/purchase/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-remarks", remarks: raw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setRows(prev => prev.map(x => (x.id === r.id ? normalize(j) : x)));
    } catch (e: any) { setError(e.message); }
  };

  const exportXlsx = async () => {
    const headers = ["Date", "PR No", "Department", "Concerned Person", "Category", "Item Name", "Quantity", "UoM", "Item Value", "Required Date", "HOD Approval", "HR Approval", "Received", "Received Date", "Status", "PO No", "Remarks"];
    // One spreadsheet line per item so multi-item PRs expand out fully.
    const data = filtered.flatMap(r => {
      const its = r.items.length ? r.items : [{ itemName: "", category: "", quantity: null, uom: "", value: null }];
      return its.map(i => [
        fmtDate(r.date), r.prNo ?? "", r.department ?? "", r.concernedPerson ?? "",
        i.category ?? "", i.itemName ?? "", i.quantity ?? "", i.uom ?? "", i.value ?? "",
        fmtDate(r.requiredDate) === "—" ? "" : fmtDate(r.requiredDate),
        r.hodApproval ?? "", r.hrApproval ?? "", r.receivedByAdmin ? "Yes" : "No",
        r.receivedDate ? fmtDate(r.receivedDate) : "", r.status, r.poNo ?? "", r.remarks ?? "",
      ]);
    });
    await downloadRegisterXlsx({
      filename: "purchase-requisition-register",
      sheetName: "PR Register",
      title: "Supreme Art (Pvt) Ltd — Purchase Requisition Register",
      headers, rows: data,
    });
  };

  const approvalStyle = (v: string | null, good: string, bad: string) =>
    v === good ? "#15803D" : v === bad ? "#DC2626" : "var(--text3)";

  return (
    <div className="fade-up">
      <PrintLandscape />
      <PrintHeader title="Purchase Requisition Register" subtitle={`${filtered.length} requisitions`} />

      {/* Header */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Purchase Requisitions</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            {filtered.length} of {rows.length} requisitions · total value {totalValue.toLocaleString()} PKR
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={printLandscape} className="btn btn-print">🖨 Print</button>
          <button onClick={exportXlsx} className="btn">⬇ Excel</button>
          {canRaise && <button onClick={openNew} className="btn btn-primary">＋ New Requisition</button>}
        </div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input placeholder="Search item, person, PR#, PO#…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 240 }} />
        <select value={dept} onChange={e => setDept(e.target.value)} style={{ width: 180 }}>
          <option value="">All departments</option>
          {PR_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ width: 180 }}>
          <option value="">All categories</option>
          {PR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">All statuses</option>
          {PR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}>
          <span style={{ fontWeight: 600 }}>Date</span>
          <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} title="From date" style={{ width: 145 }} />
          <span>→</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} title="To date" style={{ width: 145 }} />
        </span>
        {(q || dept || cat || status || fromDate || toDate) && (
          <button className="btn btn-sm" onClick={() => { setQ(""); setDept(""); setCat(""); setStatus(""); setFromDate(""); setToDate(""); }}>Clear</button>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 14 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* New / Edit form */}
      {showForm && (
        <div className="no-print card" style={{ marginBottom: 16, borderColor: "var(--brand)", borderWidth: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              {editId === null ? "＋ New Requisition" : `✏️ Edit PR #${rows.find(r => r.id === editId)?.prNo ?? "—"}`}
            </div>
            <button onClick={() => setShowForm(false)} className="btn btn-sm">Cancel</button>
          </div>

          {/* ① Requisition details */}
          <div className="pr-section">① Requisition details</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <div><label className="form-label">Date *</label>
              <input type="date" value={draft.date} onChange={e => set({ date: e.target.value })} /></div>
            <div><label className="form-label">PR No *</label>
              <input type="number" value={draft.prNo} onChange={e => set({ prNo: e.target.value })} placeholder="Requisition number" /></div>
            <div><label className="form-label">Department *</label>
              <select value={draft.department} onChange={e => set({ department: e.target.value })}>
                <option value="">— Select —</option>
                {PR_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div><label className="form-label">Requested by</label>
              <input value={draft.concernedPerson} onChange={e => set({ concernedPerson: e.target.value })} placeholder="Person raising it" /></div>
            <div><label className="form-label">Required Date</label>
              <input type="date" value={draft.requiredDate} onChange={e => set({ requiredDate: e.target.value })} /></div>
          </div>

          {/* ② Items — value is added from the register after receipt */}
          <div className="pr-section" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>② Items</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)" }}>Value, HOD/HR approvals and remarks are set from the register.</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pr-item-form">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>#</th>
                  <th style={{ minWidth: 200 }}>Item Name *</th>
                  <th style={{ minWidth: 150 }}>Category</th>
                  <th style={{ width: 90 }}>Quantity</th>
                  <th style={{ width: 120 }}>UoM</th>
                  <th style={{ width: 34 }}></th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "center", color: "var(--text3)", fontWeight: 700 }}>{idx + 1}</td>
                    <td><input value={it.itemName} onChange={e => setItem(idx, { itemName: e.target.value })} placeholder="What is being requested" /></td>
                    <td>
                      <select value={it.category} onChange={e => setItem(idx, { category: e.target.value })}>
                        <option value="">—</option>
                        {PR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><input type="number" value={it.quantity} onChange={e => setItem(idx, { quantity: e.target.value })} /></td>
                    <td>
                      <select value={it.uom} onChange={e => setItem(idx, { uom: e.target.value })}>
                        <option value="">— Unit —</option>
                        {PR_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button type="button" onClick={() => removeItem(idx)} disabled={draft.items.length === 1}
                        title="Remove item" className="pr-item-x">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addItem} className="btn btn-sm" style={{ marginTop: 8 }}>＋ Add item</button>

          {/* ③ Receipt & PO tracking */}
          <div className="pr-section" style={{ marginTop: 16 }}>③ Approval, receipt &amp; PO</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <div><label className="form-label">HOD Approval <span style={{ color: "var(--text3)", fontWeight: 400 }}>(by requester)</span></label>
              <select value={draft.hodApproval} onChange={e => set({ hodApproval: e.target.value })}>
                <option value="">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Not Approved">Not Approved</option>
              </select></div>
            {canReceive && (
              <>
                <div><label className="form-label">Received Date <span style={{ color: "var(--text3)", fontWeight: 400 }}>(Admin)</span></label>
                  <input type="date" value={draft.receivedDate}
                    onChange={e => set({ receivedDate: e.target.value, receivedByAdmin: !!e.target.value })} /></div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", paddingBottom: 8 }}>
                    <input type="checkbox" checked={draft.receivedByAdmin} onChange={e => set({ receivedByAdmin: e.target.checked })} style={{ width: "auto" }} />
                    Material received (Admin)
                  </label>
                </div>
              </>
            )}
            <div><label className="form-label">Status</label>
              <select value={draft.status} onChange={e => set({ status: e.target.value })}>
                {PR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label className="form-label">PO No</label>
              <input value={draft.poNo} onChange={e => set({ poNo: e.target.value })} /></div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={save} disabled={busy} className="btn btn-primary">
              {busy ? "Saving…" : editId === null ? "✓ Raise Requisition" : "✓ Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Register table */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="pr-table">
          <thead>
            <tr>
              <th>Date</th><th>PR#</th><th>Department</th><th>Requested by</th>
              <th style={{ minWidth: 220 }}>Items</th>
              <th className="num">Value</th><th>Required</th><th>HOD</th><th>HR</th><th title="Material received by Admin">Received</th><th>Status</th><th>PO#</th><th>Remarks</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={14} className="empty">
                {rows.length === 0 ? "No requisitions yet — raise the first one." : "Nothing matches the filters."}
              </td></tr>
            )}
            {filtered.map(r => {
              const st = PR_STATUS_STYLE[r.status] ?? { color: "var(--text2)", bg: "var(--bg2)" };
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                  <td style={{ fontWeight: 700, color: "var(--brand)" }}>{r.prNo ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.department || "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.concernedPerson || "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.items.length === 0 ? "—" : (
                      <ul className="pr-items">
                        {r.items.map((i, k) => (
                          <li key={k}>
                            <span style={{ fontWeight: 600 }}>{i.itemName || "—"}</span>
                            {(i.quantity != null || i.uom) && (
                              <span style={{ color: "var(--text2)" }}> · {i.quantity ?? ""}{i.uom ? ` ${i.uom}` : ""}</span>
                            )}
                            {i.category && <span className="pr-cat">{i.category}</span>}
                            {canEditPr ? (
                              <button
                                type="button"
                                onClick={() => editItemValue(r, k)}
                                className={`pr-val no-print ${i.value == null ? "pr-val-empty" : ""}`}
                                title={i.value == null ? "Add value (after receipt)" : "Edit value"}
                              >
                                {i.value == null ? "＋ ₨" : `₨${i.value.toLocaleString()} ✎`}
                              </button>
                            ) : i.value != null && (
                              <span className="pr-val no-print" style={{ cursor: "default" }}>
                                ₨{i.value.toLocaleString()}
                              </span>
                            )}
                            {i.value != null && <span className="only-print" style={{ color: "var(--text3)" }}> · ₨{i.value.toLocaleString()}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="num-strong">{r.value === null ? "" : r.value.toLocaleString()}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.requiredDate)}</td>
                  <td style={{ fontSize: 11.5, fontWeight: 700, color: approvalStyle(r.hodApproval, "Approved", "Not Approved") }}>
                    {r.hodApproval || "Pending"}
                  </td>
                  <td style={{ fontSize: 11.5, fontWeight: 700, color: approvalStyle(r.hrApproval, "Approved", "Rejected") }}>
                    {r.hrApproval || "Pending"}
                  </td>
                  <td style={{ fontSize: 11.5, textAlign: "center", whiteSpace: "nowrap" }}>
                    {r.receivedByAdmin
                      ? <span style={{ color: "#15803D", fontWeight: 700 }}>✓ {r.receivedDate ? fmtDate(r.receivedDate) : ""}</span>
                      : <span style={{ color: "var(--text3)" }}>—</span>}
                  </td>
                  <td>
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, color: st.color, background: st.bg, whiteSpace: "nowrap" }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{r.poNo || ""}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text2)", maxWidth: 180 }}>{r.remarks || ""}</td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", maxWidth: 240 }}>
                      {canHrApprove && (
                        <>
                          <button onClick={() => act(r, "approve")} title="HR approve this requisition"
                            style={pillBtn("#15803D", r.hrApproval === "Approved")}>HR Approve</button>
                          <button onClick={() => act(r, "reject")} title="HR reject this requisition"
                            style={pillBtn("#DC2626", r.hrApproval === "Rejected")}>HR Reject</button>
                        </>
                      )}
                      {canReceive && (
                        <button onClick={() => act(r, "received")} title="Mark material received (Admin)"
                          style={pillBtn("#0C447C", r.status === "Material Received")}>Mark Received</button>
                      )}
                      {canEditPr && (
                        <>
                          <button onClick={() => editRemarks(r)} title="Edit remarks" className="btn btn-sm">Remarks</button>
                          <button onClick={() => openEdit(r)} className="btn btn-sm" title="Edit this requisition">Edit</button>
                        </>
                      )}
                      {canDeletePr && (
                        <button onClick={() => remove(r)} className="btn btn-sm btn-danger" title="Delete this requisition">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        .pr-table { font-size: 12.5px; }
        .pr-table th, .pr-table td { padding: 7px 10px; vertical-align: top; }
        .pr-items { list-style: none; margin: 0; padding: 0; }
        .pr-items li { padding: 1px 0; line-height: 1.35; }
        .pr-cat { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px;
          font-size: 10px; font-weight: 700; color: var(--text2); background: var(--bg2); }
        .pr-section { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--brand); padding-bottom: 6px; margin-bottom: 10px;
          border-bottom: 1px solid var(--border); }
        .pr-item-form { width: 100%; border-collapse: collapse; }
        .pr-item-form th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text2);
          text-align: left; padding: 4px 6px; }
        .pr-item-form td { padding: 3px 6px; }
        .pr-item-form input, .pr-item-form select { width: 100%; }
        .pr-item-x { border: 1px solid var(--border); background: var(--bg); color: var(--danger);
          border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-weight: 700; }
        .pr-item-x:disabled { opacity: 0.3; cursor: not-allowed; }
        .pr-val { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 999px;
          font-size: 10.5px; font-weight: 700; cursor: pointer;
          border: 1px solid #15803D; color: #15803D; background: #EAF3DE; }
        .pr-val:hover { background: #15803D; color: #fff; }
        .pr-val-empty { border-style: dashed; background: transparent; color: var(--text3); border-color: var(--border); }
        .pr-val-empty:hover { background: var(--bg2); color: var(--text); }
        .only-print { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          .pr-table { font-size: 8.5px; }
          .pr-table th, .pr-table td { padding: 2px 4px; }
          .pr-cat { display: none; }
          .only-print { display: inline; }
        }
      `}</style>
    </div>
  );
}

function pillBtn(color: string, active: boolean): React.CSSProperties {
  return {
    padding: "3px 7px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${color}`, background: active ? color : "#fff", color: active ? "#fff" : color,
  };
}
