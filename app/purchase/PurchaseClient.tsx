"use client";
import { useMemo, useState } from "react";
import PrintHeader from "@/components/PrintHeader";
import PrintLandscape, { printLandscape } from "@/components/PrintLandscape";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import { PR_DEPARTMENTS, PR_CATEGORIES, PR_UNITS, PR_STATUSES, PR_HOD, PR_HR, PR_STATUS_STYLE } from "@/lib/purchase";

export type PrRow = {
  id: number;
  prNo: number | null;      // legacy rows can lack a number
  date: string | null;      // …or a date
  department: string | null;
  concernedPerson: string | null;
  category: string | null;
  itemName: string | null;
  quantity: number | null;
  uom: string | null;
  receivedByAdmin: boolean;
  value: number | null;
  requiredDate: string | null;
  hodApproval: string | null;
  hrApproval: string | null;
  status: string;
  poNo: string | null;
  remarks: string | null;
};

type Draft = {
  date: string; prNo: string; department: string; concernedPerson: string; category: string;
  itemName: string; quantity: string; uom: string; receivedByAdmin: boolean;
  value: string; requiredDate: string; hodApproval: string; hrApproval: string; status: string;
  poNo: string; remarks: string;
};

const emptyDraft = (): Draft => ({
  date: new Date().toISOString().slice(0, 10),
  prNo: "", department: "", concernedPerson: "", category: "", itemName: "",
  quantity: "", uom: "", receivedByAdmin: true, value: "",
  requiredDate: "", hodApproval: "", hrApproval: "", status: "PR Raised", poNo: "", remarks: "",
});

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

export default function PurchaseClient({ initialRows }: { initialRows: PrRow[] }) {
  const [rows, setRows] = useState<PrRow[]>(initialRows);
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
    if (cat && r.category !== cat) return false;
    if (status && r.status !== status) return false;
    // Date range (inclusive). Rows without a date are excluded once a bound is set.
    if (fromDate || toDate) {
      const d = r.date ? r.date.slice(0, 10) : "";
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      const hay = `${r.prNo ?? ""} ${r.itemName ?? ""} ${r.concernedPerson ?? ""} ${r.poNo ?? ""} ${r.remarks ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [rows, q, dept, cat, status, fromDate, toDate]);

  const totalValue = useMemo(() => filtered.reduce((s, r) => s + (r.value ?? 0), 0), [filtered]);

  const set = (patch: Partial<Draft>) => setDraft(prev => ({ ...prev, ...patch }));

  const openNew = () => {
    // Suggest the next number after the current max — still fully editable.
    const maxPr = rows.reduce((m, r) => Math.max(m, r.prNo ?? 0), 0);
    setDraft({ ...emptyDraft(), prNo: String(maxPr + 1) });
    setEditId(null); setShowForm(true); setError(null);
  };
  const openEdit = (r: PrRow) => {
    setDraft({
      date: r.date ?? "", prNo: r.prNo === null ? "" : String(r.prNo),
      department: r.department ?? "", concernedPerson: r.concernedPerson ?? "",
      category: r.category ?? "", itemName: r.itemName ?? "",
      quantity: r.quantity === null ? "" : String(r.quantity), uom: r.uom ?? "",
      receivedByAdmin: r.receivedByAdmin, value: r.value === null ? "" : String(r.value),
      requiredDate: r.requiredDate ?? "", hodApproval: r.hodApproval ?? "", hrApproval: r.hrApproval ?? "",
      status: r.status, poNo: r.poNo ?? "", remarks: r.remarks ?? "",
    });
    setEditId(r.id); setShowForm(true); setError(null);
  };

  const save = async () => {
    if (!draft.date || !draft.prNo.trim() || !draft.department || !draft.itemName.trim()) {
      setError("Date, PR No, Department and Item Name are required."); return;
    }
    setBusy(true); setError(null);
    try {
      const res = await fetch(editId === null ? "/api/purchase" : `/api/purchase/${editId}`, {
        method: editId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setRows(prev => editId === null
        ? [j, ...prev]
        : prev.map(r => (r.id === editId ? j : r)));
      setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (r: PrRow) => {
    if (!confirm(`Delete PR #${r.prNo ?? "—"} — ${r.itemName ?? "(no item)"}? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/purchase/${r.id}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Delete failed"); }
      setRows(prev => prev.filter(x => x.id !== r.id));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  // Quick workflow actions from the row buttons.
  const act = async (r: PrRow, action: "approve" | "reject" | "received") => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/purchase/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Action failed");
      setRows(prev => prev.map(x => (x.id === r.id ? j : x)));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const exportXlsx = async () => {
    const headers = ["Date", "PR No", "Department", "Concerned Person", "Category", "Item Name", "Quantity", "UoM", "Received by HR & Admin", "Value", "Required Date", "HR Approval", "HOD Approval", "Status", "PO No", "Remarks"];
    const data = filtered.map(r => [
      fmtDate(r.date), r.prNo ?? "", r.department ?? "", r.concernedPerson ?? "", r.category ?? "", r.itemName ?? "",
      r.quantity ?? "", r.uom ?? "", r.receivedByAdmin ? "Yes" : "No", r.value ?? "",
      fmtDate(r.requiredDate) === "—" ? "" : fmtDate(r.requiredDate), r.hrApproval ?? "", r.hodApproval ?? "", r.status, r.poNo ?? "", r.remarks ?? "",
    ]);
    await downloadRegisterXlsx({
      filename: "purchase-requisition-register",
      sheetName: "PR Register",
      title: "Supreme Art (Pvt) Ltd — Purchase Requisition Register",
      headers, rows: data,
    });
  };

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
          <button onClick={openNew} className="btn btn-primary">＋ New Requisition</button>
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
            <div><label className="form-label">Concerned Person</label>
              <input value={draft.concernedPerson} onChange={e => set({ concernedPerson: e.target.value })} placeholder="Who needs it" /></div>
            <div><label className="form-label">Category</label>
              <select value={draft.category} onChange={e => set({ category: e.target.value })}>
                <option value="">— Select —</option>
                {PR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div style={{ gridColumn: "span 2" }}><label className="form-label">Item Name *</label>
              <input value={draft.itemName} onChange={e => set({ itemName: e.target.value })} placeholder="What is being requested" /></div>
            <div><label className="form-label">Quantity</label>
              <input type="number" value={draft.quantity} onChange={e => set({ quantity: e.target.value })} /></div>
            <div><label className="form-label">UoM</label>
              <select value={draft.uom} onChange={e => set({ uom: e.target.value })}>
                <option value="">— Unit —</option>
                {PR_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select></div>
            <div><label className="form-label">Value (PKR)</label>
              <input type="number" value={draft.value} onChange={e => set({ value: e.target.value })} /></div>
            <div><label className="form-label">Required Date</label>
              <input type="date" value={draft.requiredDate} onChange={e => set({ requiredDate: e.target.value })} /></div>
            <div><label className="form-label">HR Approval</label>
              <select value={draft.hrApproval} onChange={e => set({ hrApproval: e.target.value })}>
                <option value="">Pending</option>
                {PR_HR.map(h => <option key={h} value={h}>{h}</option>)}
              </select></div>
            <div><label className="form-label">HOD Approval</label>
              <select value={draft.hodApproval} onChange={e => set({ hodApproval: e.target.value })}>
                <option value="">Pending</option>
                {PR_HOD.map(h => <option key={h} value={h}>{h}</option>)}
              </select></div>
            <div><label className="form-label">Status</label>
              <select value={draft.status} onChange={e => set({ status: e.target.value })}>
                {PR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div><label className="form-label">PO No</label>
              <input value={draft.poNo} onChange={e => set({ poNo: e.target.value })} /></div>
            <div style={{ gridColumn: "span 2" }}><label className="form-label">Remarks</label>
              <input value={draft.remarks} onChange={e => set({ remarks: e.target.value })} /></div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}>
                <input type="checkbox" checked={draft.receivedByAdmin} onChange={e => set({ receivedByAdmin: e.target.checked })} style={{ width: "auto" }} />
                Received by HR &amp; Admin
              </label>
            </div>
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
              <th>Date</th><th>PR#</th><th>Department</th><th>Person</th><th>Category</th>
              <th style={{ minWidth: 180 }}>Item</th><th>Qty</th><th>UoM</th><th title="Requisition received by HR & Admin">Rcvd</th>
              <th className="num">Value</th><th>Required</th><th>HR</th><th>HOD</th><th>Status</th><th>PO#</th><th>Remarks</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={17} className="empty">
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
                  <td style={{ fontSize: 12 }}>{r.category || "—"}</td>
                  <td>{r.itemName || "—"}</td>
                  <td className="num">{r.quantity ?? ""}</td>
                  <td style={{ fontSize: 12 }}>{r.uom || ""}</td>
                  <td style={{ textAlign: "center" }}>{r.receivedByAdmin ? "✓" : ""}</td>
                  <td className="num-strong">{r.value === null ? "" : r.value.toLocaleString()}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.requiredDate)}</td>
                  <td style={{ fontSize: 11.5, fontWeight: 700, color: r.hrApproval === "Approved" ? "#15803D" : r.hrApproval === "Rejected" ? "#DC2626" : "var(--text3)" }}>
                    {r.hrApproval || "Pending"}
                  </td>
                  <td style={{ fontSize: 11.5, fontWeight: 700, color: r.hodApproval === "Approved" ? "#15803D" : r.hodApproval === "Not Approved" ? "#DC2626" : "var(--text3)" }}>
                    {r.hodApproval || "Pending"}
                  </td>
                  <td>
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, color: st.color, background: st.bg, whiteSpace: "nowrap" }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{r.poNo || ""}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text2)", maxWidth: 180 }}>{r.remarks || ""}</td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button onClick={() => act(r, "approve")} disabled={busy} title="HR Approve"
                        style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          border: "1px solid #15803D", background: r.hrApproval === "Approved" ? "#15803D" : "#fff", color: r.hrApproval === "Approved" ? "#fff" : "#15803D" }}>
                        ✓ Approve
                      </button>
                      <button onClick={() => act(r, "reject")} disabled={busy} title="HR Reject"
                        style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          border: "1px solid #DC2626", background: r.hrApproval === "Rejected" ? "#DC2626" : "#fff", color: r.hrApproval === "Rejected" ? "#fff" : "#DC2626" }}>
                        ✗ Reject
                      </button>
                      <button onClick={() => act(r, "received")} disabled={busy} title="Mark material received"
                        style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          border: "1px solid #0C447C", background: r.status === "Material Received" ? "#0C447C" : "#fff", color: r.status === "Material Received" ? "#fff" : "#0C447C" }}>
                        📦 Received
                      </button>
                      <button onClick={() => openEdit(r)} className="btn btn-sm" title="Edit">✏️</button>
                      <button onClick={() => remove(r)} className="btn btn-sm btn-danger" title="Delete">🗑</button>
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
        .pr-table th, .pr-table td { padding: 7px 10px; }
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          .pr-table { font-size: 8.5px; }
          .pr-table th, .pr-table td { padding: 2px 4px; }
        }
      `}</style>
    </div>
  );
}
