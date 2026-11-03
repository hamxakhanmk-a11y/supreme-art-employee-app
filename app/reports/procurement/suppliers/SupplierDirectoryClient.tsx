"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { inReportRange, reportLetterhead } from "@/lib/report-export";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { fmtMoney, fmtDate } from "@/lib/procurement";
import { StatChip } from "@/components/ReportExportControls";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { cmpText } from "@/lib/listTools";

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

// Sorting. "Every order" lists rows (newest first by default); "By product" lists product groups (A-Z by
// default), so its choices reorder whole groups and keep each product's suppliers together.
type DirSort = "date" | "dateAsc" | "product" | "supplier" | "rate" | "net" | "az" | "za" | "suppliers" | "ordered";
const ORDER_SORT_OPTIONS: SortOption<DirSort>[] = [
  { value: "date", label: "Latest order" },
  { value: "dateAsc", label: "Oldest order" },
  { value: "product", label: "Product A-Z" },
  { value: "supplier", label: "Supplier A-Z" },
  { value: "rate", label: "Rate (highest first)" },
  { value: "net", label: "Net value (highest first)" },
];
const PRODUCT_SORT_OPTIONS: SortOption<DirSort>[] = [
  { value: "az", label: "Product A-Z" },
  { value: "za", label: "Product Z-A" },
  { value: "suppliers", label: "Most suppliers" },
  { value: "ordered", label: "Most ordered" },
];
const ORDER_SORTS: Partial<Record<DirSort, (a: DirectoryRow, b: DirectoryRow) => number>> = {
  dateAsc: (a, b) => (a.date || "").localeCompare(b.date || ""),
  product: (a, b) => cmpText(a.product, b.product),
  supplier: (a, b) => cmpText(a.supplier, b.supplier),
  rate: (a, b) => (b.rate ?? -1) - (a.rate ?? -1),
  net: (a, b) => (b.net ?? -1) - (a.net ?? -1),
};
type ProductEntry = [string, Map<string, { count: number }>];
const PRODUCT_SORTS: Partial<Record<DirSort, (a: ProductEntry, b: ProductEntry) => number>> = {
  za: (a, b) => b[0].localeCompare(a[0]),
  suppliers: (a, b) => b[1].size - a[1].size,
  ordered: (a, b) => [...b[1].values()].reduce((s, x) => s + x.count, 0) - [...a[1].values()].reduce((s, x) => s + x.count, 0),
};

// "1,250.00 / Pcs" — blank when no rate was ever entered on the PO line.
function rateLabel(rate: number | null, uom: string): string {
  if (rate == null) return "—";
  const money = fmtMoney(rate, false);
  return uom ? `${money} / ${uom}` : money;
}

// The rate with its sales tax added, same shape as the rate: "4,956.00 / Pcs".
function rateWithTaxLabel(rate: number | null, taxPct: number, uom: string): string {
  return rate == null ? "—" : rateLabel(Math.round(rate * (1 + taxPct / 100) * 100) / 100, uom);
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
  // Each view has its own sort choices; the first of each is the order that view has always had.
  const [sort, setSort] = useState<DirSort>(byProductOnly ? "az" : "date");

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
  }).sort((a, b) => (ORDER_SORTS[sort]?.(a, b) ?? 0) || (b.date || "").localeCompare(a.date || "")), [rows, q, supplierFilter, fromDate, toDate, sort]);

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
    products.sort((a, b) => (PRODUCT_SORTS[sort]?.(a, b) ?? 0) || a[0].localeCompare(b[0]));

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
  }, [rows, rateNotes, q, supplierFilter, fromDate, toDate, sort]);

  // ---- Rate history (By product view) ----
  // Every order of one product from one supplier, newest first. Built from all
  // of the rows rather than the date-filtered ones, so the history is complete
  // whatever range the list above is showing.
  const [historyFor, setHistoryFor] = useState<{ product: string; supplier: string } | null>(null);
  const history = useMemo(() => {
    if (!historyFor) return [];
    return rows
      .filter(r => r.product === historyFor.product && r.supplier === historyFor.supplier)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.poNo - a.poNo);
  }, [rows, historyFor]);

  // The rate it was before: the latest earlier order's rate that differs from the one
  // shown, in yellow beside it. Nothing when the rate has never changed. Clicking it
  // opens the full history; the click is stopped so it doesn't also open the PO or
  // start an inline edit of the cell it's in.
  const ratesByPair = useMemo(() => {
    const m = new Map<string, { rate: number; uom: string }[]>();
    for (const r of [...rows].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.poNo - a.poNo)) {
      if (r.rate == null) continue;
      const k = noteKey(r.product, r.supplier);
      const list = m.get(k) ?? [];
      list.push({ rate: r.rate, uom: r.uom });
      m.set(k, list);
    }
    return m;
  }, [rows]);
  const oldRateTag = (product: string, supplier: string, shown: number | null) => {
    const old = ratesByPair.get(noteKey(product, supplier))?.find(x => x.rate !== shown);
    if (!old) return null;
    return (
      <button
        onClick={e => { e.stopPropagation(); setHistoryFor({ product, supplier }); }}
        title="Old rate — click for every order of this product from this supplier"
        style={{
          marginLeft: 8, padding: "0 7px", borderRadius: 6, border: "1px solid #EAB308", background: "#FEF08A",
          color: "#713F12", fontSize: 11.5, fontWeight: 700, lineHeight: 1.6, cursor: "pointer",
          printColorAdjust: "exact", WebkitPrintColorAdjust: "exact",
        }}
      >{rateLabel(old.rate, old.uom)}</button>
    );
  };

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
          letterhead: reportLetterhead(fromDate, toDate), colWidths: [34,28,20,18,12,22,18],
          headers: ["Product / Description", "Supplier", "Brand", "Rate", "Tax %", "Total (Rate + Tax)", "Rate source"],
          rows: byProduct.map(r => [
            r.product, r.supplier + (r.agg.count > 1 ? ` (x${r.agg.count})` : ""), r.agg.brand || "",
            rateLabel(r.shownRate, r.agg.uom), taxPctLabel(r.shownRate, r.shownTaxPct),
            rateWithTaxLabel(r.shownRate, r.shownTaxPct, r.agg.uom),
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
      {/* One row, wrapping group by group: the count chip, search + sort + supplier, the view tabs, the
          date range, and at the right end Excel and the way back. */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {activeView === "orders"
            ? <StatChip label="Orders" value={filteredOrders.length} />
            : <StatChip label="Products" value={new Set(byProduct.map(r => r.product)).size} />}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <SearchBox width={270} value={q} onChange={setQ} placeholder="🔍  Search product or supplier…" />
          <SortBy options={activeView === "orders" ? ORDER_SORT_OPTIONS : PRODUCT_SORT_OPTIONS} value={sort} onChange={setSort} minWidth={170} />
          <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ maxWidth: 220, width: "auto" }}>
            <option value="">All suppliers</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {!byProductOnly && (
          <div className="tabs" style={{ flexShrink: 0 }}>
            <button className={`tab ${view === "orders" ? "active" : ""}`} onClick={() => { setView("orders"); setSort("date"); }}>Every order</button>
            <button className={`tab ${view === "byProduct" ? "active" : ""}`} onClick={() => { setView("byProduct"); setSort("az"); }}>By product</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <label className="head-filter">From <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} style={{ width: 138 }} /></label>
          <label className="head-filter">To <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} style={{ width: 138 }} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexShrink: 0 }}>
          {(exportError || (fromDate && toDate && fromDate > toDate)) && <span role="alert">{exportError || "From date must be on or before To date."}</span>}
          <button className="btn" disabled={exporting || !!(fromDate && toDate && fromDate > toDate)} onClick={exportXlsx}>{exporting ? "Exporting…" : "⬇ Excel"}</button>
          <Link href="/reports/procurement" className="btn btn-back">← Back</Link>
        </div>
      </div>

      <div className="rpt-table-wrap rpt-table-wrap--fit">
        {activeView === "orders" ? (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="wrap">Product / Description</th>
                <th className="wrap">Supplier</th>
                <th>Brand</th>
                <th>Rate</th>
                <th>Tax %</th>
                <th className="num">Gross</th>
                <th className="num">Tax</th>
                <th className="num">Net Value</th>
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
                  <td className="wrap">{r.product}</td>
                  <td className="wrap">{r.supplier}</td>
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
                <th className="wrap">Product / Description</th>
                <th className="wrap">Supplier</th>
                <th>Brand</th>
                <th>Rate</th>
                <th>Tax %</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.length === 0 && (
                <tr><td colSpan={6} className="empty">No matching products.</td></tr>
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
                      className="wrap"
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
                  <td className="wrap">
                    {r.supplier}
                    {r.agg.count > 1 && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text3)" }}>×{r.agg.count}</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.agg.brand || "—"}</td>
                  {!canEditRates ? (
                    <>
                      <td>{rateLabel(r.shownRate, r.agg.uom)}{r.noted && <NotedMark />}{oldRateTag(r.product, r.supplier, r.shownRate)}</td>
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
                        {rateLabel(r.shownRate, r.agg.uom)}{r.noted && <NotedMark />} <span style={{ color: "var(--text3)", fontSize: 11 }}>✎</span>{oldRateTag(r.product, r.supplier, r.shownRate)}
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
                  <td style={{ fontWeight: 700 }} title="Rate plus sales tax">{rateWithTaxLabel(r.shownRate, r.shownTaxPct, r.agg.uom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {historyFor && (
        <div onClick={() => setHistoryFor(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={ev => ev.stopPropagation()} className="card" style={{ maxWidth: 560, width: "100%", padding: 20, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Rate history</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{historyFor.product} — {historyFor.supplier}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setHistoryFor(null)}>Close</button>
            </div>
            {(() => {
              const rates = history.map(h => h.rate).filter((x): x is number => x != null);
              const uom = history.find(h => h.uom)?.uom || "";
              const money = (n: number) => rateLabel(n, uom);
              return (
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12.5, margin: "12px 0", color: "var(--text2)" }}>
                  <span><b style={{ color: "var(--text)" }}>{history.length}</b> order{history.length === 1 ? "" : "s"}</span>
                  {rates.length > 0 && <>
                    <span>Lowest <b style={{ color: "#15803D" }}>{money(Math.min(...rates))}</b></span>
                    <span>Highest <b style={{ color: "#DC2626" }}>{money(Math.max(...rates))}</b></span>
                  </>}
                </div>
              );
            })()}
            <div style={{ overflowY: "auto" }}>
              <table className="rpt-table">
                <thead>
                  <tr><th>Date</th><th>PO #</th><th>Rate</th><th>Tax %</th><th>Change</th></tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    // Compared with the next row down, i.e. the previous order that had a rate.
                    const prev = history.slice(i + 1).find(p => p.rate != null);
                    const diff = h.rate != null && prev?.rate != null ? h.rate - prev.rate : null;
                    return (
                      <tr key={`${h.poId}-${i}`} className="rpt-row-clickable" onClick={() => openPo(h.poId)} title="Open this Purchase Order">
                        <td>{h.date ? fmtDate(h.date) : "—"}</td>
                        <td>{h.poNo}</td>
                        <td>{rateLabel(h.rate, h.uom)}</td>
                        <td>{taxPctLabel(h.rate, h.taxPct)}</td>
                        <td style={{ fontWeight: 700, color: diff == null || diff === 0 ? "var(--text3)" : diff > 0 ? "#DC2626" : "#15803D" }}>
                          {diff == null ? "—" : diff === 0 ? "same" : `${diff > 0 ? "▲" : "▼"} ${fmtMoney(Math.abs(diff), false)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "var(--text3)", margin: "10px 0 0" }}>
              Rates as entered on each Purchase Order. A rate noted by hand on the list is not part of this history.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
