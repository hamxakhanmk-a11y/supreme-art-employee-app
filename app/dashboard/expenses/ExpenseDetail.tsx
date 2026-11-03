"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ExpenseSummary, SkippedLine } from "@/lib/expenses";
import { pkr, dmy, rangeLabel } from "../format";

const SOURCE_LABEL = { purchase: "Purchase", procurement: "Procurement" } as const;

export default function ExpenseDetail({ summary }: { summary: ExpenseSummary }) {
  const [open, setOpen] = useState<string | null>(null);
  const [openSkip, setOpenSkip] = useState<string | null>(null);
  const skippedByReason = useMemo(() => {
    const m = new Map<string, SkippedLine[]>();
    for (const s of summary.skipped) m.set(s.reason, [...(m.get(s.reason) ?? []), s]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [summary.skipped]);
  const max = summary.categories[0]?.total || 0;

  return (
    <>
      <div className="od-tiles od-tiles-3">
        <div className="od-tile od-tile-money">
          <div className="od-tile-label">Total Expense</div>
          <div className="od-tile-value">PKR {pkr(summary.total)}</div>
          <div className="od-tile-period">{rangeLabel(summary.from, summary.to)}</div>
        </div>
        <div className="od-tile">
          <div className="od-tile-label">Purchase</div>
          <div className="od-tile-value">{pkr(summary.purchase)}</div>
          <div className="od-tile-sub">Requisition lines, on the PR date</div>
        </div>
        <div className="od-tile">
          <div className="od-tile-label">Procurement</div>
          <div className="od-tile-value">{pkr(summary.procurement)}</div>
          <div className="od-tile-sub">Received on GRRs × PO rate + tax, on the GRR date</div>
        </div>
      </div>

      <section className="card od-section">
        <div className="od-section-head">
          <div>
            <div className="od-section-title">By category <span className="od-count">{summary.categories.length}</span></div>
            <div className="od-section-sub">Tap a category to see every line in it.</div>
          </div>
        </div>
        {summary.categories.length === 0 ? <div className="od-empty">No expense in this period.</div> : (
          <div className="od-cats">
            {summary.categories.map(c => {
              const isOpen = open === c.category;
              return (
                <div key={c.category} className={`od-cat ${isOpen ? "open" : ""}`}>
                  <button type="button" className="od-cat-head" onClick={() => setOpen(isOpen ? null : c.category)} aria-expanded={isOpen}>
                    <div className="od-cat-name">
                      <span>{c.category}</span>
                      <span className="od-cat-total">{pkr(c.total)}</span>
                    </div>
                    <div className="od-bar"><span style={{ width: `${max > 0 ? Math.max(1, (c.total / max) * 100) : 0}%` }} /></div>
                    <div className="od-cat-split">
                      {c.purchase !== 0 && <span>Purchase {pkr(c.purchase)}</span>}
                      {c.procurement !== 0 && <span>Procurement {pkr(c.procurement)}</span>}
                      <span>{summary.total > 0 ? ((c.total / summary.total) * 100).toFixed(1) : "0.0"}%</span>
                      <span>{c.lines.length} line{c.lines.length === 1 ? "" : "s"} {isOpen ? "▴" : "▾"}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="od-lines">
                      {c.lines.map((l, i) => (
                        <Link key={i} href={l.href} className="od-line">
                          <div className="od-row-main">
                            <div className="od-row-title">{l.description || "—"}</div>
                            <div className="od-row-meta">{l.ref} · {SOURCE_LABEL[l.source]} · {dmy(l.date)}</div>
                          </div>
                          <div className="od-line-amt">{pkr(l.amount)}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {skippedByReason.length > 0 && (
        <section className="card od-section">
          <div className="od-section-head">
            <div>
              <div className="od-section-title">Not counted <span className="od-count">{summary.skipped.length}</span></div>
              <div className="od-section-sub">These lines are left out of the total. Fix the document and it will be counted.</div>
            </div>
          </div>
          <div className="od-cats">
            {skippedByReason.map(([reason, rows]) => {
              const isOpen = openSkip === reason;
              return (
                <div key={reason} className={`od-cat ${isOpen ? "open" : ""}`}>
                  <button type="button" className="od-cat-head" onClick={() => setOpenSkip(isOpen ? null : reason)} aria-expanded={isOpen}>
                    <div className="od-cat-name"><span>{reason}</span><span className="od-cat-total">{rows.length} {isOpen ? "▴" : "▾"}</span></div>
                  </button>
                  {isOpen && (
                    <div className="od-lines">
                      {rows.map((l, i) => (
                        <Link key={i} href={l.href} className="od-line">
                          <div className="od-row-main">
                            <div className="od-row-title">{l.description || "—"}</div>
                            <div className="od-row-meta">{l.ref} · {SOURCE_LABEL[l.source]}{l.date ? ` · ${dmy(l.date)}` : ""}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
