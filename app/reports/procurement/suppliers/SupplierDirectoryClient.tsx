"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { usePageState } from "@/lib/usePageState";
import { inReportRange, reportLetterhead } from "@/lib/report-export";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { fmtMoney, fmtDate } from "@/lib/procurement";
import { StatChip } from "@/components/ReportExportControls";
import { SearchBox, SortBy, type SortOption } from "@/components/ListControls";
import { cmpText } from "@/lib/listTools";
import { productKey } from "@/lib/rateChanges";

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
  discount: number;      // the PO line's own discount (PO Discount column), Rs
  received: "none" | "partial" | "full";   // what has arrived of this PO line on GRRs
  receivedQty: number;
  orderedQty: number | null;
}

// Received only: one row per GRR line, on its GRR date, valued as the dashboard's Procurement is
// (see lib/expenses.ts), so the two totals agree for the same dates.
export interface ReceivedRow {
  lineId: string;
  date: string;          // GRR date
  product: string;
  supplier: string;
  grr: string;           // "GRR 15110"
  href: string;
  po: string;            // "PO 10234"
  poDate: string;
  qty: number;           // quantity valued (never more than was left on the PO line)
  rate: number;
  taxPct: number;
  net: number;           // after the PO's discount share
  calc: string;
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
// uom: the unit the noted rate is per, where it differs from (or is missing on) the PO.
export type RateNote = { rate: number | null; taxPct: number | null; uom?: string | null };
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

// views — which of the three this role has (Access Register: Supplier Directory · By product / Every
// order / Received only). Every order carries the order values; without it they are never sent here.
// canEditRates — whether the rate / tax % cells on the By-product list can be corrected in place.
export default function SupplierDirectoryClient({
  rows, rateNotes = {}, views = { byProduct: true, orders: true, received: true }, canEditRates = false, received = [], receivedNotCounted = 0,
}: { rows: DirectoryRow[]; rateNotes?: RateNotes; views?: { byProduct: boolean; orders: boolean; received: boolean }; canEditRates?: boolean; received?: ReceivedRow[]; receivedNotCounted?: number }) {
  // Without Every order, Received only is switched on from By product (as it always was for those roles).
  const byProductOnly = !views.orders;
  // Only Received only: that list is the page.
  const receivedForced = views.received && !views.orders && !views.byProduct;
  const router = useRouter();
  const [q, setQ] = usePageState("q", "");
  const [supplierFilter, setSupplierFilter] = usePageState("supplier", "");
  const [fromDate, setFromDate] = usePageState("from", "");
  const [toDate, setToDate] = usePageState("to", "");
  const [view, setView] = usePageState<ViewMode>("view", views.orders ? "orders" : "byProduct");
  // Every order → what arrived instead: each GRR line in the From–To by its GRR date (see ReceivedRow).
  const [receivedOnly, setReceivedOnly] = usePageState("receivedOnly", false);
  // Restricted roles are pinned to By-product no matter what `view` holds —
  // hiding the tabs alone would leave the per-order view one stray setView
  // away. Everything that branches on the view reads this, not `view`.
  const activeView: ViewMode = !views.orders ? "byProduct" : !views.byProduct ? "orders" : view;
  // Each view has its own sort choices; the first of each is the order that view has always had.
  const [sort, setSort] = usePageState<DirSort>("sort", byProductOnly && !receivedForced ? "az" : "date");

  // ---- Inline rate / tax editing (By product view) ----
  // Saves a note against this product + supplier and nothing more: the PO the
  // figure originally came from is left exactly as it was, along with its
  // print and its totals. Clearing both fields drops the note, and the row
  // goes back to showing the PO's own rate.
  const [editKey, setEditKey] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState("");
  const [taxDraft, setTaxDraft] = useState("");
  const [uomDraft, setUomDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  function startEdit(row: FlatRow) {
    setEditKey(noteKey(row.product, row.supplier));
    setRateDraft(row.shownRate == null ? "" : String(row.shownRate));
    setTaxDraft(row.shownRate == null ? "" : String(row.shownTaxPct));
    setUomDraft(row.shownUom);
  }
  async function saveEdit(row: FlatRow) {
    setSavingEdit(true);
    try {
      const res = await fetch("/api/procurement/supplier-rates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: row.product, supplier: row.supplier,
          // The PO's own unit is not saved as a note, so the row keeps following the POs until it is changed.
          rate: rateDraft.trim(), tax: taxDraft.trim(), uom: uomDraft.trim() === row.poUom ? "" : uomDraft.trim(),
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

  // By product treats one product however its name was typed (owner, 2026-11-05): case, spaces and
  // punctuation ignored, "50 gm" = "50gm" = "50 gram" (see productKey). The group shows the name as
  // the newest PO wrote it. Every order keeps each PO's own wording.
  const canonRows = useMemo(() => {
    const newest = new Map<string, DirectoryRow>();
    for (const r of rows) {
      const k = productKey(r.product) || r.product;
      const cur = newest.get(k);
      if (!cur || r.poNo > cur.poNo || (r.poNo === cur.poNo && (r.date || "") > (cur.date || ""))) newest.set(k, r);
    }
    return rows.map(r => {
      const name = newest.get(productKey(r.product) || r.product)?.product ?? r.product;
      return name === r.product ? r : { ...r, product: name };
    });
  }, [rows]);
  // Rate notes under the same names. A note saved under another spelling still counts; one saved
  // under the shown name wins.
  const canonNotes = useMemo(() => {
    const nameOf = new Map<string, string>();
    for (const r of canonRows) nameOf.set(productKey(r.product) || r.product, r.product);
    const out: RateNotes = {};
    for (const [k, note] of Object.entries(rateNotes)) {
      let product: string, supplier: string;
      try { [product, supplier] = JSON.parse(k); } catch { continue; }
      const name = nameOf.get(productKey(product) || product) ?? product;
      const ck = noteKey(name, supplier);
      if (!(ck in out) || product === name) out[ck] = note;
    }
    return out;
  }, [canonRows, rateNotes]);

  const filteredOrders = useMemo(() => rows.filter(r => {
    if (supplierFilter && r.supplier !== supplierFilter) return false;
    if (!inRange(r)) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return `${r.product} ${r.supplier}`.toLowerCase().includes(s);
  }).sort((a, b) => (ORDER_SORTS[sort]?.(a, b) ?? 0) || (b.date || "").localeCompare(a.date || "")), [rows, q, supplierFilter, fromDate, toDate, sort]);

  const RECEIVED_SORTS: Partial<Record<DirSort, (a: ReceivedRow, b: ReceivedRow) => number>> = {
    dateAsc: (a, b) => a.date.localeCompare(b.date),
    product: (a, b) => cmpText(a.product, b.product),
    supplier: (a, b) => cmpText(a.supplier, b.supplier),
    rate: (a, b) => b.rate - a.rate,
    net: (a, b) => b.net - a.net,
  };
  const filteredReceived = useMemo(() => received.filter(r => {
    if (supplierFilter && r.supplier !== supplierFilter) return false;
    if (!inReportRange(r.date, fromDate, toDate)) return false;
    const s = q.trim().toLowerCase();
    return !s || `${r.product} ${r.supplier} ${r.grr} ${r.po}`.toLowerCase().includes(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }).sort((a, b) => (RECEIVED_SORTS[sort]?.(a, b) ?? 0) || b.date.localeCompare(a.date)), [received, q, supplierFilter, fromDate, toDate, sort]);
  const receivedTotal = useMemo(() => filteredReceived.reduce((s, r) => s + r.net, 0), [filteredReceived]);
  // The owner switches Every order to it; roles without Every order switch By product to it.
  const showReceived = views.received && (receivedForced || (receivedOnly && (activeView === "orders" || byProductOnly)));

  const ordersTotals = useMemo(() => filteredOrders.reduce((s, r) => ({
    gross: s.gross + (r.gross ?? 0),
    tax: s.tax + r.taxValue,
    net: s.net + (r.net ?? 0),
    discount: s.discount + (r.discount || 0),
  }), { gross: 0, tax: 0, net: 0, discount: 0 }), [filteredOrders]);

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
    productCount: number;   // the product's POs from every supplier (in the dates)
    shownRate: number | null; shownTaxPct: number; shownUom: string; poUom: string; noted: boolean;
  };
  const byProduct = useMemo(() => {
    const map = new Map<string, Map<string, SupplierAgg>>();
    for (const r of canonRows) {
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
          cur.rate = r.rate; cur.uom = r.uom || cur.uom; cur.taxPct = r.taxPct; cur.poNo = r.poNo; cur.poId = r.poId;
          cur.brand = r.supplierBrand; cur.address = r.supplierAddress; cur.phone = r.supplierPhone;
          cur.concernedPerson = r.supplierConcernedPerson; cur.ntn = r.supplierNtn; cur.strn = r.supplierStrn;
        } else if (!cur.uom && r.uom) cur.uom = r.uom;
      }
    }
    let products = [...map.entries()];
    if (supplierFilter) products = products.filter(([, m]) => m.has(supplierFilter));
    const s = q.trim().toLowerCase();
    if (s) products = products.filter(([product, m]) => product.toLowerCase().includes(s) || [...m.keys()].some(sp => sp.toLowerCase().includes(s)));
    products.sort((a, b) => (PRODUCT_SORTS[sort]?.(a, b) ?? 0) || a[0].localeCompare(b[0]));

    // A product's unit from any supplier's PO, for a supplier whose POs never gave one.
    const productUom = (m: Map<string, SupplierAgg>) => [...m.values()].sort((a, b) => b.poNo - a.poNo).find(a => a.uom)?.uom || "";
    const flat: FlatRow[] = [];
    for (const [product, suppliersMap] of products) {
      const anyUom = productUom(suppliersMap);
      let entries = [...suppliersMap.entries()];
      if (supplierFilter) entries = entries.filter(([sp]) => sp === supplierFilter);
      entries.sort((a, b) => a[0].localeCompare(b[0]));
      entries.forEach(([supplier, agg], i) => {
        const note = canonNotes[noteKey(product, supplier)];
        // Each field falls back independently, so noting just a tax % keeps
        // the PO's rate showing beside it.
        const shownRate = note?.rate ?? agg.rate;
        const shownTaxPct = note?.taxPct ?? agg.taxPct;
        // The unit noted here, else the POs': this supplier's latest that has one, else any supplier's for the product.
        const poUom = agg.uom || anyUom;
        const shownUom = note?.uom || poUom;
        flat.push({
          product, supplier, agg, isFirstOfProduct: i === 0, groupSize: entries.length,
          productCount: [...suppliersMap.values()].reduce((t, a) => t + a.count, 0),
          shownRate, shownTaxPct, shownUom, poUom, noted: note != null,
        });
      });
    }
    return flat;
  }, [canonRows, canonNotes, q, supplierFilter, fromDate, toDate, sort]);

  // ---- Rate history (By product view) ----
  // Every order of one product from one supplier, newest first. Built from all
  // of the rows rather than the date-filtered ones, so the history is complete
  // whatever range the list above is showing.
  // allSuppliers: every supplier's orders of the product, not only this supplier's.
  const [historyFor, setHistoryFor] = useState<{ product: string; supplier: string; allSuppliers?: boolean } | null>(null);
  const history = useMemo(() => {
    if (!historyFor) return [];
    return canonRows
      .filter(r => r.product === historyFor.product && (historyFor.allSuppliers || r.supplier === historyFor.supplier))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.poNo - a.poNo);
  }, [canonRows, historyFor]);
  const suppliersOfHistory = useMemo(
    () => historyFor ? new Set(canonRows.filter(r => r.product === historyFor.product).map(r => r.supplier)).size : 0,
    [canonRows, historyFor]);

  // The rate it was before: the latest earlier order's rate that differs from the one
  // shown, in yellow beside it. Nothing when the rate has never changed. Clicking it
  // opens the full history; the click is stopped so it doesn't also open the PO or
  // start an inline edit of the cell it's in.
  const ratesByPair = useMemo(() => {
    const m = new Map<string, { rate: number; uom: string }[]>();
    for (const r of [...canonRows].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.poNo - a.poNo)) {
      if (r.rate == null) continue;
      const k = noteKey(r.product, r.supplier);
      const list = m.get(k) ?? [];
      list.push({ rate: r.rate, uom: r.uom });
      m.set(k, list);
    }
    return m;
  }, [canonRows]);
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
    if (showReceived) {
      await downloadWorkbookXlsx({
        filename: "supplier-directory-received",
        sheets: [{
          sheetName: "Received", title: "SUPPLIER DIRECTORY — RECEIVED (BY GRR DATE)",
          letterhead: reportLetterhead(fromDate, toDate), colWidths: [14,38,28,14,22,14,16,10,18,40],
          headers: ["GRR Date", "Product / Description", "Supplier", "GRR", "PO", "Qty", "Rate", "Tax %", "Net Received", "Worked out as"],
          rows: [
            ...filteredReceived.map(r => [
              fmtDate(r.date), r.product, r.supplier, r.grr, r.po + (r.poDate ? ` (${fmtDate(r.poDate)})` : ""),
              r.qty.toLocaleString(), fmtMoney(r.rate, false), `${r.taxPct}%`, fmtMoney(r.net, false), r.calc,
            ]),
            ["", "", "", "", "", "", "", "Total", fmtMoney(receivedTotal, false), ""],
          ],
        }],
      });
    } else if (activeView === "orders") {
      await downloadWorkbookXlsx({
        filename: "product-supplier-directory",
        sheets: [{
          sheetName: "By order", title: "SUPPLIER DIRECTORY — EVERY ORDER",
          letterhead: reportLetterhead(fromDate, toDate), colWidths: [34,38,28,20,18,12,18,18,18,16],
          headers: ["Date", "Product / Description", "Supplier", "Brand", "Rate", "Tax %", "Gross", "Tax", "Net Value", "Discount"],
          rows: [
            ...filteredOrders.map(r => [
              r.date ? fmtDate(r.date) : "—", r.product, r.supplier, r.supplierBrand || "", rateLabel(r.rate, r.uom),
              taxPctLabel(r.rate, r.taxPct), moneyOrDash(r.gross), taxLabel(r.gross, r.taxValue, r.taxPct), moneyOrDash(r.net), r.discount ? fmtMoney(r.discount, false) : "—",
            ]),
            ["", "", "", "", "", "Total", fmtMoney(ordersTotals.gross, false), fmtMoney(ordersTotals.tax, false), fmtMoney(ordersTotals.net, false), fmtMoney(ordersTotals.discount, false)],
            ...(ordersTotals.discount > 0 ? [["", "", "", "", "", "", "", "Total after discount", fmtMoney(ordersTotals.net - ordersTotals.discount, false), ""]] : []),
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
            rateLabel(r.shownRate, r.shownUom), taxPctLabel(r.shownRate, r.shownTaxPct),
            rateWithTaxLabel(r.shownRate, r.shownTaxPct, r.shownUom),
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
          {showReceived
            ? <StatChip label="Received lines" value={filteredReceived.length} />
            : activeView === "orders"
            ? <StatChip label="Orders" value={filteredOrders.length} />
            : <StatChip label="Products" value={new Set(byProduct.map(r => r.product)).size} />}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <SearchBox width={270} value={q} onChange={setQ} placeholder="🔍  Search product or supplier…" />
          <SortBy options={activeView === "orders" || showReceived ? ORDER_SORT_OPTIONS : PRODUCT_SORT_OPTIONS} value={sort} onChange={setSort} minWidth={170} />
          <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ maxWidth: 220, width: "auto" }}>
            <option value="">All suppliers</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {views.orders && views.byProduct && (
          <div className="tabs" style={{ flexShrink: 0 }}>
            <button className={`tab ${view === "orders" ? "active" : ""}`} onClick={() => { setView("orders"); setSort("date"); }}>Every order</button>
            <button className={`tab ${view === "byProduct" ? "active" : ""}`} onClick={() => { setView("byProduct"); setSort("az"); }}>By product</button>
          </div>
        )}
        {views.received && !receivedForced && (activeView === "orders" || byProductOnly) && (
          <button type="button" aria-pressed={receivedOnly}
            onClick={() => {
              const next = !receivedOnly;
              setReceivedOnly(next);
              // Without Every order the button swaps between two lists with different sort choices.
              if (byProductOnly) setSort(next ? "date" : "az");
            }}
            title="Show what arrived instead: every GRR line in the dates, by its GRR date, valued as the dashboard's Procurement"
            style={{
              padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer", flexShrink: 0,
              border: `1px solid ${receivedOnly ? "#15803D" : "var(--border)"}`,
              background: receivedOnly ? "#15803D" : "var(--bg)", color: receivedOnly ? "#fff" : "var(--text)",
            }}>{receivedOnly ? "✓ " : ""}Received only</button>
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
        {showReceived ? (
          <table className="rpt-table">
            <thead>
              <tr>
                <th>GRR Date</th>
                <th className="wrap">Product / Description</th>
                <th className="wrap">Supplier</th>
                <th>GRR / PO</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th>Tax %</th>
                <th className="num">Net Received</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceived.length === 0 && (
                <tr><td colSpan={8} className="empty">Nothing received in these dates.</td></tr>
              )}
              {filteredReceived.map(r => (
                <tr key={r.lineId} onClick={() => router.push(r.href)} className="rpt-row-clickable" title={`${r.calc} — tap to open the GRR`}>
                  <td>{fmtDate(r.date)}</td>
                  <td className="wrap">{r.product}</td>
                  <td className="wrap">{r.supplier}</td>
                  <td style={{ fontSize: 12 }}>{r.grr}<div style={{ color: "var(--text2)" }}>{r.po}{r.poDate ? ` · ${fmtDate(r.poDate)}` : ""}</div></td>
                  <td className="num">{r.qty.toLocaleString()}</td>
                  <td className="num">{fmtMoney(r.rate, false)}</td>
                  <td>{r.taxPct}%</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmtMoney(r.net, false)}</td>
                </tr>
              ))}
            </tbody>
            {filteredReceived.length > 0 && (
              <tfoot>
                <tr className="rpt-total-row">
                  <td colSpan={7}>Total received — {filteredReceived.length} line{filteredReceived.length === 1 ? "" : "s"} · after PO discounts{receivedNotCounted > 0 ? ` · GRR lines with no rate, no PO or rejected are not counted` : ""}</td>
                  <td className="num">{fmtMoney(receivedTotal, false)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : activeView === "orders" ? (
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
                <th className="num">Discount</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr><td colSpan={10} className="empty">No matching orders.</td></tr>
              )}
              {filteredOrders.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => openPo(r.poId)}
                  className="rpt-row-clickable"
                  title="Tap to open this Purchase Order"
                >
                  <td>{r.date ? fmtDate(r.date) : "—"}</td>
                  <td className="wrap">
                    {r.product}
                    {r.received !== "none" && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: r.received === "full" ? "#15803D" : "#B45309" }}>
                        {r.received === "full" ? "✓ Received" : `◐ Part received · ${r.receivedQty.toLocaleString()}${r.orderedQty != null ? ` of ${r.orderedQty.toLocaleString()}` : ""}`}
                      </div>
                    )}
                  </td>
                  <td className="wrap">{r.supplier}</td>
                  <td style={{ fontSize: 12 }}>{r.supplierBrand || "—"}</td>
                  <td>{rateLabel(r.rate, r.uom)}</td>
                  <td>{taxPctLabel(r.rate, r.taxPct)}</td>
                  <td className="num">{moneyOrDash(r.gross)}</td>
                  <td className="num">{taxLabel(r.gross, r.taxValue, r.taxPct)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{moneyOrDash(r.net)}</td>
                  <td className="num">{r.discount ? fmtMoney(r.discount, false) : "—"}</td>
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
                  <td className="num">{fmtMoney(ordersTotals.discount, false)}</td>
                </tr>
                {ordersTotals.discount > 0 && (
                  <tr className="rpt-total-row">
                    <td colSpan={8} style={{ textAlign: "right" }}>Total after discount</td>
                    <td className="num" colSpan={2}>{fmtMoney(ordersTotals.net - ordersTotals.discount, false)}</td>
                  </tr>
                )}
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
                  onClick={() => (r.productCount > 1 ? setHistoryFor({ product: r.product, supplier: r.supplier, allSuppliers: r.agg.count === 1 }) : openPo(r.agg.poId))}
                  className="rpt-row-clickable"
                  title={r.agg.count > 1 ? `Tap to see all ${r.agg.count} POs of this product from this supplier` : r.productCount > 1 ? `Tap to see all ${r.productCount} POs of this product` : "Tap to open the PO for this product"}
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
                      {r.groupSize > 1 && (
                        <div>
                          <button type="button" className="sd-pos-btn" style={{ marginLeft: 0, marginTop: 4 }} title="Every PO of this product, from all its suppliers"
                            onClick={e => { e.stopPropagation(); setHistoryFor({ product: r.product, supplier: r.supplier, allSuppliers: true }); }}>
                            All {r.productCount} POs ›
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="wrap">
                    {r.supplier}
                    {r.agg.count > 1 && (
                      <button type="button" className="sd-pos-btn" title="Every PO of this product from this supplier"
                        onClick={e => { e.stopPropagation(); setHistoryFor({ product: r.product, supplier: r.supplier }); }}>
                        {r.agg.count} POs ›
                      </button>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{r.agg.brand || "—"}</td>
                  {!canEditRates ? (
                    <>
                      <td>{rateLabel(r.shownRate, r.shownUom)}{r.noted && <NotedMark />}{oldRateTag(r.product, r.supplier, r.shownRate)}</td>
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
                        <span style={{ margin: "0 4px", fontSize: 11.5, color: "var(--text3)" }}>/</span>
                        <input
                          list="sd-uoms" value={uomDraft} onChange={e => setUomDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(r); if (e.key === "Escape") setEditKey(null); }}
                          placeholder="unit" title="What the rate is per — ton, ream, kg, pcs… Blank = the PO's own unit"
                          style={{ width: 70, padding: "4px 7px", fontSize: 12.5, border: "1px solid var(--border)", borderRadius: 5 }}
                        />
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
                          ? "Your noted rate — click to change it. Clear rate, tax and unit to go back to the PO's."
                          : "From this product's latest PO. Click to note your own rate and unit — the PO won't change."}
                      >
                        {rateLabel(r.shownRate, r.shownUom)}{!r.shownUom && r.shownRate != null && <span style={{ color: "var(--text3)", fontSize: 11 }} title="No unit yet — click to add one"> / unit?</span>}{r.noted && <NotedMark />} <span style={{ color: "var(--text3)", fontSize: 11 }}>✎</span>{oldRateTag(r.product, r.supplier, r.shownRate)}
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
                  <td style={{ fontWeight: 700 }} title="Rate plus sales tax">{rateWithTaxLabel(r.shownRate, r.shownTaxPct, r.shownUom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <datalist id="sd-uoms">
        {[...new Set([...rows.map(r => r.uom).filter(Boolean), "kg", "ton", "ream", "pcs", "sheet", "ltr", "drum", "roll", "box", "packet", "meter", "set"])].map(u => <option key={u} value={u} />)}
      </datalist>

      {historyFor && (
        <div onClick={() => setHistoryFor(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={ev => ev.stopPropagation()} className="card" style={{ maxWidth: 760, width: "100%", padding: 20, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Every PO of this product</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{historyFor.product} — {historyFor.allSuppliers ? "all suppliers" : historyFor.supplier}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setHistoryFor(null)}>Close</button>
            </div>
            {suppliersOfHistory > 1 && (
              <div className="tabs" style={{ marginTop: 10, alignSelf: "flex-start" }}>
                <button className={`tab ${historyFor.allSuppliers ? "" : "active"}`} onClick={() => setHistoryFor({ ...historyFor, allSuppliers: false })}>{historyFor.supplier}</button>
                <button className={`tab ${historyFor.allSuppliers ? "active" : ""}`} onClick={() => setHistoryFor({ ...historyFor, allSuppliers: true })}>All {suppliersOfHistory} suppliers</button>
              </div>
            )}
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
                  <tr><th>Date</th><th>PO #</th>{historyFor.allSuppliers && <th>Supplier</th>}<th className="num">Qty</th><th>Rate</th><th>Tax %</th><th>Change</th><th>Received</th></tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    // Compared with the next row down, i.e. the previous order that had a rate.
                    const prev = history.slice(i + 1).find(p => p.rate != null && (!historyFor.allSuppliers || p.supplier === h.supplier));
                    const diff = h.rate != null && prev?.rate != null ? h.rate - prev.rate : null;
                    return (
                      <tr key={`${h.poId}-${i}`} className="rpt-row-clickable" onClick={() => openPo(h.poId)} title="Open this Purchase Order">
                        <td>{h.date ? fmtDate(h.date) : "—"}</td>
                        <td style={{ fontWeight: 700, color: "var(--brand)" }}>{h.poNo}</td>
                        {historyFor.allSuppliers && <td className="wrap">{h.supplier}</td>}
                        <td className="num">{h.orderedQty != null ? h.orderedQty.toLocaleString() : "—"}{h.orderedQty != null && h.uom ? <span style={{ color: "var(--text3)" }}> {h.uom}</span> : null}</td>
                        <td>{rateLabel(h.rate, h.uom)}</td>
                        <td>{taxPctLabel(h.rate, h.taxPct)}</td>
                        <td style={{ fontWeight: 700, color: diff == null || diff === 0 ? "var(--text3)" : diff > 0 ? "#DC2626" : "#15803D" }}>
                          {diff == null ? "—" : diff === 0 ? "same" : `${diff > 0 ? "▲" : "▼"} ${fmtMoney(Math.abs(diff), false)}`}
                        </td>
                        <td style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", color: h.received === "full" ? "#15803D" : h.received === "partial" ? "#B45309" : "var(--text3)" }}>
                          {h.received === "full" ? "✓ Received" : h.received === "partial" ? `◐ ${h.receivedQty.toLocaleString()} so far` : "Not yet"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "var(--text3)", margin: "10px 0 0" }}>
              Newest first. Tap a line to open that Purchase Order. Rates as entered on each PO — a rate noted by hand on the list is not part of this history.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
