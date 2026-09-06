"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { downloadWorkbookXlsx } from "@/lib/xlsx";
import { fmtMoney } from "@/lib/procurement";

export interface DirectoryRow {
  product: string;
  supplier: string;
  poId: number;
  poNo: number;
  date: string;
  rate: number | null;
  uom: string;
}

type ViewMode = "orders" | "byProduct";

// "1,250.00 / Pcs" — blank when no rate was ever entered on the PO line.
function rateLabel(rate: number | null, uom: string): string {
  if (rate == null) return "—";
  const money = fmtMoney(rate, false);
  return uom ? `${money} / ${uom}` : money;
}

// Per-supplier rollup inside a product group: how many times ordered, and
// the rate + PO from the most recent order (compare by po #, higher = later)
// — that PO is also where "click this supplier" should land.
type SupplierAgg = { count: number; rate: number | null; uom: string; poNo: number; poId: number };

export default function SupplierDirectoryClient({ rows }: { rows: DirectoryRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [view, setView] = useState<ViewMode>("orders");

  const suppliers = useMemo(
    () => [...new Set(rows.map(r => r.supplier))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredOrders = useMemo(() => rows.filter(r => {
    if (supplierFilter && r.supplier !== supplierFilter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return `${r.product} ${r.supplier}`.toLowerCase().includes(s);
  }).sort((a, b) => a.product.localeCompare(b.product)), [rows, q, supplierFilter]);

  // Grouped view: one row per product, listing every supplier it's ever been
  // ordered from, how many times, and the rate from the most recent order.
  // Groups on the exact description as typed on the PO — free-text product
  // names, so near-duplicates ("Compressor oil" vs "Compressor Oil 20L")
  // are not merged automatically.
  const byProduct = useMemo(() => {
    const map = new Map<string, Map<string, SupplierAgg>>();
    for (const r of rows) {
      let suppliersMap = map.get(r.product);
      if (!suppliersMap) { suppliersMap = new Map(); map.set(r.product, suppliersMap); }
      const cur = suppliersMap.get(r.supplier);
      if (!cur) {
        suppliersMap.set(r.supplier, { count: 1, rate: r.rate, uom: r.uom, poNo: r.poNo, poId: r.poId });
      } else {
        cur.count += 1;
        if (r.poNo > cur.poNo) { cur.rate = r.rate; cur.uom = r.uom; cur.poNo = r.poNo; cur.poId = r.poId; }
      }
    }
    let list = [...map.entries()].map(([product, suppliersMap]) => ({ product, suppliers: suppliersMap }));
    if (supplierFilter) list = list.filter(g => g.suppliers.has(supplierFilter));
    const s = q.trim().toLowerCase();
    if (s) list = list.filter(g => g.product.toLowerCase().includes(s) || [...g.suppliers.keys()].some(sp => sp.toLowerCase().includes(s)));
    return list.sort((a, b) => a.product.localeCompare(b.product));
  }, [rows, q, supplierFilter]);

  function exportXlsx() {
    if (view === "orders") {
      downloadWorkbookXlsx({
        filename: "product-supplier-directory",
        sheets: [{
          sheetName: "By order", title: "Product / Supplier / Rate — every order",
          headers: ["Product / Description", "Supplier", "Rate"],
          rows: filteredOrders.map(r => [r.product, r.supplier, rateLabel(r.rate, r.uom)]),
        }],
      });
    } else {
      downloadWorkbookXlsx({
        filename: "product-supplier-directory",
        sheets: [{
          sheetName: "By product", title: "Product / Supplier / Rate — grouped by product",
          headers: ["Product / Description", "Supplier(s) — latest rate each"],
          rows: byProduct.map(g => [
            g.product,
            [...g.suppliers.entries()].map(([s, agg]) => {
              let label = `${s} - ${rateLabel(agg.rate, agg.uom)}`;
              if (agg.count > 1) label += ` (x${agg.count})`;
              return label;
            }).join(", "),
          ]),
        }],
      });
    }
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
        <div className="tabs">
          <button className={`tab ${view === "orders" ? "active" : ""}`} onClick={() => setView("orders")}>Every order</button>
          <button className={`tab ${view === "byProduct" ? "active" : ""}`} onClick={() => setView("byProduct")}>By product</button>
        </div>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search product or supplier…"
          style={{ maxWidth: 260 }}
        />
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All suppliers</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={exportXlsx}>⬇ Export Excel</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {view === "orders" ? (
          <table>
            <thead>
              <tr><th>Product / Description</th><th>Supplier</th><th style={{ width: 150 }}>Rate</th></tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr><td colSpan={3} className="empty">No matching orders.</td></tr>
              )}
              {filteredOrders.map((r, i) => (
                <tr
                  key={i}
                  onClick={() => openPo(r.poId)}
                  style={{ cursor: "pointer" }}
                  title="Tap to open this Purchase Order"
                >
                  <td>{r.product}</td>
                  <td>{r.supplier}</td>
                  <td>{rateLabel(r.rate, r.uom)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr><th>Product / Description</th><th>Supplier(s) — latest rate each</th></tr>
            </thead>
            <tbody>
              {byProduct.length === 0 && (
                <tr><td colSpan={2} className="empty">No matching products.</td></tr>
              )}
              {byProduct.map((g, i) => {
                const multi = g.suppliers.size > 1;
                return (
                  <tr key={i}>
                    <td>{g.product}</td>
                    <td>
                      {[...g.suppliers.entries()].map(([s, agg]) => (
                        <span
                          key={s}
                          onClick={() => openPo(agg.poId)}
                          title="Tap to open this supplier's most recent PO for this product"
                          style={{
                            display: "inline-block", marginRight: 6, marginBottom: 2,
                            padding: "2px 8px", borderRadius: 999, fontSize: 11.5, cursor: "pointer",
                            background: multi ? "var(--brand-soft)" : "var(--bg2)",
                            color: multi ? "var(--brand)" : "var(--text2)",
                            fontWeight: multi ? 700 : 500,
                          }}>
                          {s}
                          <span style={{ opacity: 0.8, fontWeight: 500 }}> · {rateLabel(agg.rate, agg.uom)}</span>
                          {agg.count > 1 ? ` ×${agg.count}` : ""}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
