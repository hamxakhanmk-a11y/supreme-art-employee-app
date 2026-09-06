"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { downloadWorkbookXlsx } from "@/lib/xlsx";

export interface DirectoryRow {
  product: string;
  supplier: string;
  poNo: number;
  date: string;
}

type ViewMode = "orders" | "byProduct";

export default function SupplierDirectoryClient({ rows }: { rows: DirectoryRow[] }) {
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
  // ordered from and how many times. Groups on the exact description as typed
  // on the PO — free-text product names, so near-duplicates ("Compressor
  // oil" vs "Compressor Oil 20L") are not merged automatically.
  const byProduct = useMemo(() => {
    const map = new Map<string, { product: string; suppliers: Map<string, number> }>();
    for (const r of rows) {
      let g = map.get(r.product);
      if (!g) { g = { product: r.product, suppliers: new Map() }; map.set(r.product, g); }
      g.suppliers.set(r.supplier, (g.suppliers.get(r.supplier) || 0) + 1);
    }
    let list = [...map.values()];
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
          sheetName: "By order", title: "Product / Supplier — every order",
          headers: ["Product / Description", "Supplier"],
          rows: filteredOrders.map(r => [r.product, r.supplier]),
        }],
      });
    } else {
      downloadWorkbookXlsx({
        filename: "product-supplier-directory",
        sheets: [{
          sheetName: "By product", title: "Product / Supplier — grouped by product",
          headers: ["Product / Description", "Supplier(s)"],
          rows: byProduct.map(g => [
            g.product,
            [...g.suppliers.entries()].map(([s, n]) => n > 1 ? `${s} (${n})` : s).join(", "),
          ]),
        }],
      });
    }
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Product / Supplier Directory</h1>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
            Which supplier a product was ordered from, drawn from Purchase Order history. Read-only — nothing here can be edited.
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
              <tr><th>Product / Description</th><th>Supplier</th></tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 && (
                <tr><td colSpan={2} className="empty">No matching orders.</td></tr>
              )}
              {filteredOrders.map((r, i) => (
                <tr key={i}>
                  <td>{r.product}</td>
                  <td>{r.supplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr><th>Product / Description</th><th>Supplier(s)</th></tr>
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
                      {[...g.suppliers.entries()].map(([s, n]) => (
                        <span key={s} style={{
                          display: "inline-block", marginRight: 6, marginBottom: 2,
                          padding: "2px 8px", borderRadius: 999, fontSize: 11.5,
                          background: multi ? "var(--brand-soft)" : "var(--bg2)",
                          color: multi ? "var(--brand)" : "var(--text2)",
                          fontWeight: multi ? 700 : 500,
                        }}>{s}{n > 1 ? ` ×${n}` : ""}</span>
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
