"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { inReportRange, reportLetterhead } from "@/lib/report-export";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { fmtMoney, fmtDate } from "@/lib/procurement";

export interface DirectoryRow {
  product: string;
  supplier: string;
  supplierBrand: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierConcernedPerson: string;
  supplierNtn: string;
  supplierStrn: string;
  poId: number;
  poNo: number;
  date: string;         // ISO yyyy-mm-dd, "" if never set
  rate: number | null;
  uom: string;
  gross: number | null;
  taxPct: number;
  taxValue: number;
  net: number | null;
}

type ViewMode = "orders" | "byProduct";

// "1,250.00 / Pcs" — blank when no rate was ever entered on the PO line.
function rateLabel(rate: number | null, uom: string): string {
  if (rate == null) return "—";
  const money = fmtMoney(rate, false);
  return uom ? `${money} / ${uom}` : money;
}

// Plain currency, blank when the underlying value is null (rate or qty
// was never entered, so Gross/Net would be a meaningless 0).
function moneyOrDash(n: number | null): string {
  return n == null ? "—" : fmtMoney(n, false);
}

// "225.00 (18%)" — blank when there's no gross to tax in the first place,
// and just the money (no percent) when the line has 0% tax.
function taxLabel(gross: number | null, taxValue: number, taxPct: number): string {
  if (gross == null) return "—";
  if (!taxPct) return fmtMoney(taxValue, false) || "—";
  return `${fmtMoney(taxValue, false)} (${taxPct}%)`;
}

// Per-(product, supplier) rollup: how many times ordered, and the rate +
// contact details from the most recent order (compare by po #, higher =
// later) — that PO is also where "click this row" should land, and its
// snapshot of the supplier's address/NTN/STRN/phone is what's shown (a
// supplier's details can drift order to order, e.g. an updated phone
// number, so "latest wins" same as the rate). Two orders for the same
// product from the same supplier — even months apart — collapse into this
// one row; they don't get a row each. Gross/Tax/Net are per-order totals
// (depend on quantity ordered that time), so they're shown on the "every
// order" line-item view, not here — click through to the PO for a specific
// order's full financial breakdown.
type SupplierAgg = {
  count: number; rate: number | null; uom: string; taxPct: number; poNo: number; poId: number;
  brand: string; address: string; phone: string; concernedPerson: string; ntn: string; strn: string;
};

// Marks a row whose rate came from someone's note rather than off the PO,
// so a figure typed here for reference is never mistaken for what was
// actually ordered at.
function NotedMark() {
  return (
    <span
      title="Noted here for reference — not the rate on the PO"
      style={{
        marginLeft: 6, padding: "1px 5px", borderRadius: 4, fontSize: 9.5, fontWeight: 700,
        letterSpacing: 0.3, textTransform: "uppercase", color: "#7C3AED", background: "#f3e8ff",
      }}
    >note</span>
  );
}

// A rate / tax % noted by hand against this product + supplier. Shown in
// place of the PO's own figures when present — see RateNotes below.
export type RateNote = { rate: number | null; taxPct: number | null };
// Keyed on the same exact product description + supplier name the By-product
// view groups on. JSON-encoded rather than joined with a separator, so a
// product name containing that separator can't collide with another key.
export type RateNotes = Record<string, RateNote>;
const noteKey = (product: string, supplier: string) => JSON.stringify([product, supplier]);

// The tax % charged on that product's most recent order from this supplier.
// Dashed out when there was no rate on the line at all — a bare "0%" against
// an unpriced line reads as "zero-rated" when it really means "not priced".
function taxPctLabel(rate: number | null, taxPct: number): string {
  if (rate == null) return "—";
  return `${taxPct}%`;
}

// byProductOnly — roles granted `suppliers` (Engineer, say) get the
// By-product list and nothing else; the per-order view and its order values
// stay with the owner. canEditRates — whether the rate / tax % cells on that
// list can be corrected in place.
export default function SupplierDirectoryClient({
  rows, rateNotes = {}, byProductOnly = false, canEditRates = false,
}: { rows: DirectoryRow[]; rateNotes?: RateNotes; byProductOnly?: boolean; canEditRates?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [view, setView] = useState<ViewMode>(byProductOnly ? "byProduct" : "orders");
  // Restricted roles are pinned to By-product no matter what `view` holds —
  // hiding the tabs alone would leave the per-order view one stray setView
  // away. Everything that branches on the view reads this, not `view`.
  const activeView: ViewMode = byProductOnly ? "byProduct" : view;

  // ---- Inline rate / tax editing (By product view) ----
  // Saves a note against this product + supplier and nothing more: the PO the
  // figure originally came from is left exactly as it was, along with its
  // print and its totals. Clearing both fields drops the note, and the row
  // goes back to showing the PO's own rate.
  const [editKey, setEditKey] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState("");
  const [taxDraft, setTaxDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  function startEdit(row: FlatRow) {
    setEditKey(noteKey(row.product, row.supplier));
    setRateDraft(row.shownRate == null ? "" : String(row.shownRate));
    setTaxDraft(row.shownRate == null ? "" : String(row.shownTaxPct));
  }
  async function saveEdit(row: FlatRow) {
    setSavingEdit(true);
    try {
      const res = await fetch("/api/procurement/supplier-rates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: row.product, supplier: row.supplier,
          rate: rateDraft.trim(), tax: taxDraft.trim(),
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Save failed"); }
      setEditKey(null);
      router.refresh();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSavingEdit(false); }
  }

  const suppliers = useMemo(
    () => [...new Set(rows.map(r => r.supplier))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const inRange = (r: DirectoryRow) => inReportRange(r.date, fromDate, toDate);

  const filteredOrders = useMemo(() => rows.filter(r => {
    if (supplierFilter && r.supplier !== supplierFilter) return false;
    if (!inRange(r)) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return `${r.product} ${r.supplier}`.toLowerCase().includes(s);
  }).sort((a, b) => (b.date || "").localeCompare(a.date || "")), [rows, q, supplierFilter, fromDate, toDate]);

  const ordersTotals = useMemo(() => filteredOrders.reduce((s, r) => ({
    gross: s.gross + (r.gross ?? 0),
    tax: s.tax + r.taxValue,
    net: s.net + (r.net ?? 0),
  }), { gross: 0, tax: 0, net: 0 }), [filteredOrders]);

  // One row per (product, supplier) pair — every order of that product from
  // that supplier, any month, collapses into this single row (count tracks
  // how many). Sorted by product first so every supplier of the same
  // product lands on consecutive rows (rowSpan-merged in the table below),
  // then by supplier name within that group. Groups on the exact
  // description as typed on the PO — free-text product names, so
  // near-duplicates ("Compressor oil" vs "Compressor Oil 20L") aren't
  // merged automatically. Respects the same date range as the "every
  // order" view.
  // shownRate / shownTaxPct are what the row displays: the hand-noted figure
  // where one exists, otherwise whatever the latest PO said. noted marks the
  // difference so a reference figure can't be mistaken for the PO's own.
  type FlatRow = {
    product: string; supplier: string; agg: SupplierAgg;
    isFirstOfProduct: boolean; groupSize: number;
    shownRate: number | null; shownTaxPct: number; noted: boolean;
  };
  const byProduct = useMemo(() => {
    const map = new Map<string, Map<string, SupplierAgg>>();
    for (const r of rows) {
      if (!inRange(r)) continue;
      let suppliersMap = map.get(r.product);
      if (!suppliersMap) { suppliersMap = new Map(); map.set(r.product, suppliersMap); }
      const cur = suppliersMap.get(r.supplier);
      if (!cur) {
        suppliersMap.set(r.supplier, {
          count: 1, rate: r.rate, uom: r.uom, taxPct: r.taxPct, poNo: r.poNo, poId: r.poId,
          brand: r.supplierBrand, address: r.supplierAddress, phone: r.supplierPhone,
          concernedPerson: r.supplierConcernedPerson, ntn: r.supplierNtn, strn: r.supplierStrn,
        });
      } else {
        cur.count += 1;
        if (r.poNo > cur.poNo) {
          cur.rate = r.rate; cur.uom = r.uom; cur.taxPct = r.taxPct; cur.poNo = r.poNo; cur.poId = r.poId;
          cur.brand = r.supplierBrand; cur.address = r.supplierAddress; cur.phone = r.supplierPhone;
          cur.concernedPerson = r.supplierConcernedPerson; cur.ntn = r.supplierNtn; cur.strn = r.supplierStrn;
        }
      }
    }
    let products = [...map.entries()];
    if (supplierFilter) products = products.filter(([, m]) => m.has(supplierFilter));
    const s = q.trim().toLowerCase();
    if (s) products = products.filter(([product, m]) => product.toLowerCase().includes(s) || [...m.keys()].some(sp => sp.toLowerCase().includes(s)));
    products.sort((a, b) => a[0].localeCompare(b[0]));

    const flat: FlatRow[] = [];
    for (const [product, suppliersMap] of products) {
      let entries = [...suppliersMap.entries()];
      if (supplierFilter) entries = entries.filter(([sp]) => sp === supplierFilter);
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      entries.forEach(([supplier, agg], i) => {
        const note = rateNotes[noteKey(product, supplier)];
        // Each field falls back independently, so noting just a tax % keeps
        // the PO's rate showing beside it.
        const shownRate = note?.rate ?? agg.rate;
        const shownTaxPct = note?.taxPct ?? agg.taxPct;
        flat.push({
          product, supplier, agg, isFirstOfProduct: i === 0, groupSize: entries.length,
          shownRate, shownTaxPct, noted: note != null,
        });
      });
    }
    return flat;
  }, [rows, rateNotes, q, supplierFilter, fromDate, toDate]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  async function exportXlsx() {
    if (fromDate && toDate && fromDate > toDate) return;
    setExporting(true); setExportError("");
    try {
    if (activeView === "orders") {
      await downloadWorkbookXlsx({
        filename: "product-supplier-directory",
        sheets: [{
          sheetName: "By order", title: "SUPPLIER DIRECTORY — EVERY ORDER",
          letterhead: reportLetterhead(fromDate, toDate), colWidths: [34,38,28,20,18,12,18,18,18],
          headers: ["Date", "Product / Description", "Supplier", "Brand", "Rate", "Tax %", "Gross", "Tax", "Net Value"],
          rows: [
            ...filteredOrders.map(r => [
              r.date ? fmtDate(r.date) : "—", r.product, r.supplier, r.supplierBrand || "", rateLabel(r.rate, r.uom),
              taxPctLabel(r.rate, r.taxPct), moneyOrDash(r.gross), taxLabel(r.gross, r.taxValue, r.taxPct), moneyOrDash(r.net),
            ]),
            ["", "", "", "", "", "Total", fmtMoney(ordersTotals.gross, false), fmtMoney(ordersTotals.tax, false), fmtMoney(ordersTotals.net, false)],
          ],
        }],
      });
    } else {
      await downloadWorkbookXlsx({
        filename: "product-supplier-directory",
        sheets: [{
          sheetName: "By product", title: "SUPPLIER DIRECTORY — BY PRODUCT",
          letterhead: reportLetterhead(fromDate, toDate), colWidths: [34,28,20,36,18,18,20,24,18,12,18],
          headers: ["Product / Description", "Supplier", "Brand", "Location", "NTN", "STRN", "Contact #", "Concerned Person", "Rate", "Tax %", "Rate source"],
          rows: byProduct.map(r => [
            r.product, r.supplier + (r.agg.count > 1 ? ` (x${r.agg.count})` : ""), r.agg.brand || "",
            r.agg.address || "", r.agg.ntn || "", r.agg.strn || "", r.agg.phone || "", r.agg.concernedPerson || "",
            rateLabel(r.shownRate, r.agg.uom), taxPctLabel(r.shownRate, r.shownTaxPct),
            r.noted ? "Noted here" : "From PO",
          ]),
        }],
      });
    }
    } catch (error) { setExportError(error instanceof Error ? error.message : "Export failed. Please retry."); }
    finally { setExporting(false); }
  }

  const openPo = (poId: number) => router.push(`/procurement/po/${poId}?ref=suppliers`);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Product / Supplier Directory</h1>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
            Which supplier a product was ordered from, and at what rate, drawn from Purchase Order history. Read-only — click a row to open its PO.
          </p>
        </div>
        <Link href="/reports/procurement" className="btn btn-sm">← Procurement Report</Link>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        {!byProductOnly && (
          <div className="tabs">
            <button className={`tab ${view === "orders" ? "active" : ""}`} onClick={() => setView("orders")}>Every order</button>
            <button className={`tab ${view === "byProduct" ? "active" : ""}`} onClick={() => setView("byProduct")}>By product</button>
          </div>
        )}
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search product or supplier…"
          style={{ maxWidth: 260 }}
        />
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All suppliers</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} title="From date" style={{ width: 145 }} />
        <span style={{ color: "var(--text3)" }}>–</span>
        <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} title="To date" style={{ width: 145 }} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" disabled={exporting || !!(fromDate && toDate && fromDate > toDate)} onClick={exportXlsx}>{exporting ? "Exporting…" : "⬇ Export Excel"}</button>
        {(exportError || (fromDate && toDate && fromDate > toDate)) && <span role="alert">{exportError || "From date must be on or before To date."}</span>}
      </div>

      <div className="rpt-table-wrap">
        {activeView === "orders" ? (
          <table className="rpt-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th>Product / Description</th>
                <th>Supplier</th>
                <th>Brand</th>
                <th style={{ width: 150 }}>Rate</th>
                <th style={{ width: 80 }}>Tax %</th>
                <th className="num" style={{ width: 110 }}>Gross</th>
                <th className="num" style={{ width: 120 }}>Tax</th>
                <th className="num" style={{ width: 110 }}>Net Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr><td colSpan={9} className="empty">No matching orders.</td></tr>
              )}
              {filteredOrders.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => openPo(r.poId)}
                  className="rpt-row-clickable"
                  title="Tap to open this Purchase Order"
                >
                  <td>{r.date ? fmtDate(r.date) : "—"}</td>
                  <td>{r.product}</td>
                  <td>{r.supplier}</td>
                  <td style={{ fontSize: 12 }}>{r.supplierBrand || "—"}</td>
                  <td>{rateLabel(r.rate, r.uom)}</td>
                  <td>{taxPctLabel(r.rate, r.taxPct)}</td>
                  <td className="num">{moneyOrDash(r.gross)}</td>
                  <td className="num">{taxLabel(r.gross, r.taxValue, r.taxPct)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{moneyOrDash(r.net)}</td>
                </tr>
              ))}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot>
                <tr className="rpt-total-row">
                  <td colSpan={6}>Total — {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"}</td>
                  <td className="num">{fmtMoney(ordersTotals.gross, false)}</td>
                  <td className="num">{fmtMoney(ordersTotals.tax, false)}</td>
                  <td className="num">{fmtMoney(ordersTotals.net, false)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Product / Description</th>
                <th>Supplier</th>
                <th>Brand</th>
                <th>Location</th>
                <th style={{ width: 110 }}>NTN</th>
                <th style={{ width: 110 }}>STRN</th>
                <th style={{ width: 120 }}>Contact #</th>
                <th>Concerned Person</th>
                <th style={{ width: 150 }}>Rate</th>
                <th style={{ width: 80 }}>Tax %</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.length === 0 && (
                <tr><td colSpan={10} className="empty">No matching products.</td></tr>
              )}
              {byProduct.map((r, i) => (
                <tr
                  key={`${r.product}__${r.supplier}__${i}`}
                  onClick={() => openPo(r.agg.poId)}
                  className="rpt-row-clickable"
                  title="Tap to open this supplier's most recent PO for this product"
                >
                  {r.isFirstOfProduct && (
                    <td
                      rowSpan={r.groupSize}
                      style={{
                        verticalAlign: "top",
                        fontWeight: r.groupSize > 1 ? 700 : 400,
                        background: r.groupSize > 1 ? "var(--bg2)" : undefined,
                      }}
                    >
                      {r.product}
                    </td>
                  )}
                  <td>
                    {r.supplier}
                    {r.agg.count > 1 && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text3)" }}>×{r.agg.count}</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.agg.brand || "—"}</td>
                  <td style={{ fontSize: 12, whiteSpace: "normal", maxWidth: 220 }}>{r.agg.address || "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.agg.ntn || "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.agg.strn || "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.agg.phone || "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.agg.concernedPerson || "—"}</td>
                  {!canEditRates ? (
                    <>
                      <td>{rateLabel(r.shownRate, r.agg.uom)}{r.noted && <NotedMark />}</td>
                      <td>{taxPctLabel(r.shownRate, r.shownTaxPct)}</td>
                    </>
                  ) : editKey === noteKey(r.product, r.supplier) ? (
                    <>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                        <input
                          type="number" min={0} step="0.01" inputMode="decimal" autoFocus
                          value={rateDraft} onChange={e => setRateDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(r); if (e.key === "Escape") setEditKey(null); }}
                          placeholder="Rate"
                          style={{ width: 90, padding: "4px 7px", fontSize: 12.5, border: "1px solid var(--border)", borderRadius: 5 }}
                        />
                        {r.agg.uom && <span style={{ marginLeft: 5, fontSize: 11.5, color: "var(--text3)" }}>/ {r.agg.uom}</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                        <input
                          type="number" min={0} step="0.01" inputMode="decimal"
                          value={taxDraft} onChange={e => setTaxDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(r); if (e.key === "Escape") setEditKey(null); }}
                          title="Sales tax %" placeholder="Tax"
                          style={{ width: 58, padding: "4px 7px", fontSize: 12.5, border: "1px solid var(--border)", borderRadius: 5 }}
                        />
                        <button onClick={() => saveEdit(r)} disabled={savingEdit} title="Save — kept here only, the PO is not changed"
                          style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: 15, padding: "0 2px", marginLeft: 4 }}>✓</button>
                        <button onClick={() => setEditKey(null)} disabled={savingEdit} title="Cancel"
                          style={{ background: "none", border: "none", color: "#A32D2D", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        onClick={e => { e.stopPropagation(); startEdit(r); }}
                        className="rpt-row-clickable"
                        title={r.noted
                          ? "Your noted rate — click to change it. Clear both fields to go back to the PO's rate."
                          : "From this product's latest PO. Click to note your own rate — the PO won't change."}
                      >
                        {rateLabel(r.shownRate, r.agg.uom)}{r.noted && <NotedMark />} <span style={{ color: "var(--text3)", fontSize: 11 }}>✎</span>
                      </td>
                      <td
                        onClick={e => { e.stopPropagation(); startEdit(r); }}
                        className="rpt-row-clickable"
                        title={r.noted
                          ? "Your noted tax % — click to change it."
                          : "From this product's latest PO. Click to note your own tax % — the PO won't change."}
                      >
                        {taxPctLabel(r.shownRate, r.shownTaxPct)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
