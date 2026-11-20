"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ReportExportControls, { useReportRange, StatChip } from "@/components/ReportExportControls";
import { SearchBox } from "@/components/ListControls";
import { useCanEdit } from "@/components/MeProvider";
import { usePageState } from "@/lib/usePageState";
import { fmtDate } from "@/lib/procurement";
import {
  AP_STAGES, stageMeta, matchResult, suggestPayable, needsNote, addDays, dueInfo, agingBucket, AGING_BUCKETS,
  PAY_METHODS, payMethodLabel, fmtRs, pvLabel, DEFAULT_CREDIT_DAYS, daysBetween, type ApCase, type ApStage,
} from "@/lib/payables";
import type { PayablesData, ApPaymentRow } from "@/lib/payablesServer";

type View = "payables" | "payments" | "suppliers";
const norm = (s: string) => s.trim().toLowerCase();
const words = (q: string) => norm(q).split(/\s+/).filter(Boolean);
const hit = (q: string, ...texts: (string | null | undefined)[]) => {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  return words(q).every(w => hay.includes(w));
};

async function post(url: string, body: unknown, method = "POST"): Promise<string | null> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return d.error || "Something went wrong — try again.";
}

export default function FinanceClient({ data, view, supplier: supplierParam }: { data: PayablesData; view: View; supplier?: string }) {
  if (view === "payments") return <PaymentsView data={data} />;
  if (view === "suppliers") return <SuppliersView data={data} />;
  return <PayablesView data={data} supplierParam={supplierParam} />;
}

// ---------------------------------------------------------------- Payables (the cases, stage by stage)
function PayablesView({ data, supplierParam }: { data: PayablesData; supplierParam?: string }) {
  const router = useRouter();
  const { today, cases } = data;
  const canCheck = useCanEdit("payables");
  const canApprove = useCanEdit("payables.approve");
  const canPay = useCanEdit("payables.pay");
  const [stage, setStage] = usePageState<ApStage>("stage", "check");
  const [q, setQ] = usePageState("q", "");
  const [supplierPick, setSupplier] = usePageState("supplier", "");
  const supplier = supplierParam ?? supplierPick;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [checking, setChecking] = useState<ApCase | null>(null);
  const [paying, setPaying] = useState<ApCase[] | null>(null);
  const [opened, setOpened] = useState<ApCase | null>(null);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);

  const range = useReportRange(cases.map(c => ({ ...c, date: c.grnDate })));
  const suppliers = useMemo(() => [...new Set(cases.map(c => c.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [cases]);
  const filtered = range.rows.filter(c => (!supplier || norm(c.supplier) === norm(supplier))
    && (!q.trim() || hit(q, c.grr, c.po, c.supplier, c.invNo, c.dcNo, c.gatePassNo, c.itemsText, c.payments.map(p => pvLabel(p.pvNo) + " " + p.reference).join(" "))));
  const count = (s: ApStage) => filtered.filter(c => c.stage === s).length;
  const sumOf = (list: ApCase[], f: (c: ApCase) => number | null) => list.reduce((s, c) => s + (f(c) ?? 0), 0);
  const shown = filtered.filter(c => c.stage === stage)
    .sort(stage === "pay" ? (a, b) => (a.inv?.dueDate || "9").localeCompare(b.inv?.dueDate || "9") : () => 0);

  // The headline numbers, over every case (the filters above don't change what is owed).
  const owed = cases.filter(c => c.stage === "pay");
  const overdue = owed.filter(c => dueInfo(c.inv?.dueDate ?? null, today).tone === "late");
  const dueWeek = owed.filter(c => { const d = dueInfo(c.inv?.dueDate ?? null, today); return d.days != null && d.days >= 0 && d.days <= 7; });
  const toApprove = cases.filter(c => c.stage === "approve");
  const monthStart = today.slice(0, 8) + "01";
  const paidMonth = data.payments.filter(p => !p.voidedAt && p.date >= monthStart).reduce((s, p) => s + p.total, 0);

  const toggle = (id: number) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickedCases = shown.filter(c => selected.has(c.grnId));
  const selectable = stage === "approve" ? canApprove : stage === "pay" ? canPay : false;

  async function act(c: ApCase, action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const err = await post(`/api/payables/${c.grnId}`, { action, ...extra });
    setBusy(false);
    if (err) { alert(err); return false; }
    router.refresh();
    return true;
  }
  async function hold(c: ApCase) {
    const reason = prompt(`Why is GRR ${c.grr} on hold? (e.g. invoice rate is higher than the PO, short supply, waiting for the supplier's corrected invoice)`);
    if (reason && reason.trim()) await act(c, "hold", { reason });
  }
  async function sendBack(c: ApCase) {
    const reason = prompt(`Send GRR ${c.grr} back to Invoice check? Say why (optional):`);
    if (reason !== null) await act(c, "reopen", { reason });
  }
  async function approveMany(list: ApCase[]) {
    if (!list.length) return;
    if (!confirm(`Approve ${list.length} invoice${list.length === 1 ? "" : "s"} for payment — ${fmtRs(sumOf(list, c => c.inv?.payableAmount ?? null))} in all?`)) return;
    setBusy(true);
    for (const c of list) {
      const err = await post(`/api/payables/${c.grnId}`, { action: "approve" });
      if (err) { alert(`GRR ${c.grr}: ${err}`); break; }
    }
    setBusy(false); setSelected(new Set()); router.refresh();
  }
  function payMany(list: ApCase[]) {
    if (!list.length) return;
    if (new Set(list.map(c => norm(c.supplier))).size > 1) { alert("One payment is to one supplier — pick invoices from the same supplier (use the Supplier filter)."); return; }
    setPaying(list);
  }

  const cols = stageCols(stage);
  const sheetRows = shown.map(c => [
    c.grr, fmtDate(c.grnDate), c.supplier, c.invNo, c.po || "", c.itemsText, c.expected ?? "", c.inv?.invoiceAmount ?? "",
    c.inv?.payableAmount ?? "", c.paid || "", c.balance ?? "", c.inv?.dueDate ? fmtDate(c.inv.dueDate) : "", stageMeta(c.stage).label,
    c.inv?.holdReason || c.inv?.note || "",
  ]);

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Tile label="Owed (approved, unpaid)" value={fmtRs(sumOf(owed, c => c.balance))} sub={`${owed.length} invoice${owed.length === 1 ? "" : "s"}`} tone="#1D4ED8" onClick={() => setStage("pay")} />
        <Tile label="Overdue" value={fmtRs(sumOf(overdue, c => c.balance))} sub={`${overdue.length} past their due date`} tone="#B91C1C" onClick={() => setStage("pay")} />
        <Tile label="Due in 7 days" value={fmtRs(sumOf(dueWeek, c => c.balance))} sub={`${dueWeek.length} invoice${dueWeek.length === 1 ? "" : "s"}`} tone="#B45309" onClick={() => setStage("pay")} />
        <Tile label="Waiting for approval" value={fmtRs(sumOf(toApprove, c => c.inv?.payableAmount ?? null))} sub={`${toApprove.length} checked`} tone="#6D28D9" onClick={() => setStage("approve")} />
        <Tile label="Paid this month" value={fmtRs(paidMonth)} sub="tax withheld included" tone="#166534" onClick={() => router.push("/finance/payments")} />
      </div>

      <ReportExportControls range={range} filename="payables" sheet={{
        sheetName: "Payables", title: `PAYABLES — ${stageMeta(stage).label.toUpperCase()}`,
        headers: ["GRR #", "GRR date", "Supplier", "Invoice No", "PO #", "Items", "PO × GRR", "Invoice amount", "To pay", "Paid", "Balance", "Due", "Stage", "Note"],
        colWidths: [12, 12, 28, 16, 12, 40, 14, 14, 14, 14, 14, 12, 16, 34], rows: sheetRows,
      }}
        chips={<StatChip label="Cases" value={shown.length} />}
        search={<SearchBox width={250} value={q} onChange={setQ} placeholder="🔍  GRR, invoice, supplier…" />}
        tabs={<>
          <select value={supplier} onChange={e => { setSupplier(e.target.value); if (supplierParam !== undefined) router.replace("/finance/payables"); }} style={{ maxWidth: "min(220px, 100%)" }} aria-label="Supplier">
            <option value="">All suppliers</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </>}
        actions={canApprove ? <button className="btn" onClick={() => setSettings(true)} title="The GRR date Payables starts from">⚙ Settings</button> : null}
      />

      <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {AP_STAGES.map(s => (
          <button key={s.key} onClick={() => { setStage(s.key); setSelected(new Set()); }} title={s.hint} style={{
            padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            border: `1.5px solid ${stage === s.key ? s.color : "var(--border)"}`,
            background: stage === s.key ? s.bg : "var(--bg)", color: stage === s.key ? s.color : "var(--text2)",
          }}>{s.label} <span style={{ opacity: 0.8 }}>{count(s.key)}</span></button>
        ))}
      </div>
      <p className="no-print" style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 10px" }}>{stageMeta(stage).hint}.</p>

      {selectable && pickedCases.length > 0 && (
        <div className="no-print card" style={{ padding: "8px 12px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <b>{pickedCases.length} selected</b>
          <span style={{ color: "var(--text2)" }}>{fmtRs(sumOf(pickedCases, c => stage === "pay" ? c.balance : c.inv?.payableAmount ?? null))}</span>
          {stage === "approve" && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approveMany(pickedCases)}>✓ Approve selected</button>}
          {stage === "pay" && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => payMany(pickedCases)}>💳 Pay selected</button>}
          <button className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="card fit-card">
        <table>
          <thead><tr>
            {selectable && <th className="no-print" style={{ width: 28 }}><input type="checkbox" aria-label="Select all"
              checked={shown.length > 0 && shown.every(c => selected.has(c.grnId))}
              onChange={e => setSelected(e.target.checked ? new Set(shown.map(c => c.grnId)) : new Set())} /></th>}
            <th>GRR #</th><th>Date</th><th>Supplier</th><th>Invoice No</th><th>PO #</th><th>Items</th>
            {cols.map(c => <th key={c} className={c.startsWith("₨") ? "num" : undefined}>{c.replace("₨", "")}</th>)}
            <th className="no-print" style={{ textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={8 + cols.length + (selectable ? 1 : 0)} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                {q || supplier ? "Nothing here matches the search / supplier." : `Nothing in ${stageMeta(stage).label}.`}
              </td></tr>
            ) : shown.map(c => (
              <tr key={c.grnId} onClick={() => setOpened(c)} style={{ cursor: "pointer" }} title="Open the case — the three-way match and its history">
                {selectable && <td className="no-print" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select GRR ${c.grr}`} checked={selected.has(c.grnId)} onChange={() => toggle(c.grnId)} /></td>}
                <td style={{ fontWeight: 700, color: "var(--brand)" }}>#{c.grr}</td>
                <td>{fmtDate(c.grnDate)}</td>
                <td>{c.supplier || <span style={{ color: "var(--text3)" }}>—</span>}</td>
                <td>{c.invNo || <Pill text="No invoice" color="#64748B" bg="#F1F5F9" />}</td>
                <td>{c.po ? `#${c.po}` : "—"}</td>
                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.itemsText}>{c.itemsText}</td>
                <StageCells c={c} stage={stage} today={today} />
                <td className="no-print" style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                  {stage === "noinvoice" && <Link className="btn btn-xs" href={`/procurement/grn/${c.grnId}`}>Open GRR</Link>}
                  {(stage === "check" || stage === "hold" || stage === "approve") && canCheck && <button className="btn btn-xs btn-primary" style={{ marginRight: 4 }} onClick={() => setChecking(c)}>{stage === "approve" ? "Re-check" : "Check invoice"}</button>}
                  {stage === "check" && canCheck && <button className="btn btn-xs" onClick={() => hold(c)}>Hold</button>}
                  {stage === "hold" && canCheck && <button className="btn btn-xs" disabled={busy} onClick={() => act(c, "release")}>Release</button>}
                  {stage === "approve" && canApprove && <button className="btn btn-xs btn-success" style={{ marginRight: 4 }} disabled={busy} onClick={() => approveMany([c])}>Approve</button>}
                  {stage === "approve" && canCheck && <button className="btn btn-xs" disabled={busy} onClick={() => hold(c)}>Hold</button>}
                  {stage === "pay" && canPay && <button className="btn btn-xs btn-primary" style={{ marginRight: 4 }} onClick={() => payMany([c])}>Pay</button>}
                  {stage === "pay" && canApprove && c.paid === 0 && <button className="btn btn-xs" disabled={busy} onClick={() => sendBack(c)}>Send back</button>}
                  {stage === "done" && c.payments.length > 0 && <Link className="btn btn-xs" href={`/finance/payments/${c.payments[c.payments.length - 1].id}`}>Voucher</Link>}
                </td>
              </tr>
            ))}
          </tbody>
          {(stage === "pay" || stage === "approve" || stage === "done") && shown.length > 1 && (
            <tfoot><tr style={{ fontWeight: 800 }}>
              <td colSpan={6 + (selectable ? 1 : 0)} style={{ textAlign: "right" }}>Total</td>
              <TotalCells stage={stage} list={shown} />
              <td className="no-print" />
            </tr></tfoot>
          )}
        </table>
      </div>

      {checking && <CheckModal c={checking} cases={cases} canApprove={canApprove} onClose={() => setChecking(null)} onSaved={() => { setChecking(null); router.refresh(); }} />}
      {paying && <PayModal list={paying} today={today} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); setSelected(new Set()); router.refresh(); }} />}
      {opened && <CaseModal c={opened} today={today} onClose={() => setOpened(null)} />}
      {settings && <SettingsModal startDate={data.startDate} onClose={() => setSettings(false)} onSaved={() => { setSettings(false); router.refresh(); }} />}
    </div>
  );
}

// The columns after Items, by stage. "₨" marks a money column (right-aligned).
function stageCols(stage: ApStage): string[] {
  switch (stage) {
    case "noinvoice": return ["Waiting", "₨PO × GRR"];
    case "check": return ["₨PO × GRR", "Flags"];
    case "hold": return ["Reason", "Held by"];
    case "approve": return ["₨Invoice", "₨To pay", "Match", "Checked by", "Due"];
    case "pay": return ["₨To pay", "₨Paid", "₨Balance", "Due"];
    case "done": return ["₨Paid", "Payments", "Completed"];
  }
}

function StageCells({ c, stage, today }: { c: ApCase; stage: ApStage; today: string }) {
  const inv = c.inv;
  const money = (n: number | null | undefined) => <td className="num">{fmtRs(n ?? null)}</td>;
  switch (stage) {
    case "noinvoice": {
      const d = daysBetween(c.grnDate, today);
      return <><td>{d <= 0 ? "Today" : `${d} day${d === 1 ? "" : "s"}`}</td>{money(c.expected)}</>;
    }
    case "check": return <>{money(c.expected)}<td><Flags c={c} /></td></>;
    case "hold": return <><td style={{ color: "#B91C1C", fontWeight: 600 }}>{inv?.holdReason}</td><td>{inv?.heldBy}{inv?.heldAt ? <div style={{ fontSize: 11, color: "var(--text3)" }}>{fmtDate(inv.heldAt.slice(0, 10))}</div> : null}</td></>;
    case "approve": {
      const m = matchResult(c.expected, inv?.invoiceAmount ?? null);
      return <>{money(inv?.invoiceAmount)}{money(inv?.payableAmount)}<td><MatchPill status={m.status} diff={m.diff} /></td><td>{inv?.verifiedBy}</td><td><Due date={inv?.dueDate ?? null} today={today} /></td></>;
    }
    case "pay": return <>{money(inv?.payableAmount)}{money(c.paid || null)}<td className="num" style={{ fontWeight: 700 }}>{fmtRs(c.balance)}</td><td><Due date={inv?.dueDate ?? null} today={today} /></td></>;
    case "done": {
      const last = c.payments[c.payments.length - 1];
      return <>{money(c.paid)}<td>{c.payments.map(p => pvLabel(p.pvNo)).join(", ") || "—"}</td><td>{last ? fmtDate(last.date) : "—"}</td></>;
    }
  }
}

function TotalCells({ stage, list }: { stage: ApStage; list: ApCase[] }) {
  const s = (f: (c: ApCase) => number | null | undefined) => fmtRs(list.reduce((t, c) => t + (f(c) ?? 0), 0));
  if (stage === "approve") return <><td className="num">{s(c => c.inv?.invoiceAmount)}</td><td className="num">{s(c => c.inv?.payableAmount)}</td><td colSpan={3} /></>;
  if (stage === "pay") return <><td className="num">{s(c => c.inv?.payableAmount)}</td><td className="num">{s(c => c.paid)}</td><td className="num">{s(c => c.balance)}</td><td /></>;
  return <><td className="num">{s(c => c.paid)}</td><td colSpan={2} /></>;
}

// What finance should look at before checking: the documents don't agree, or the goods weren't all accepted.
function Flags({ c }: { c: ApCase }) {
  const f: { text: string; title: string }[] = [];
  if (c.expected == null) f.push({ text: "Can't value", title: c.expectedSkipped.join("\n") || "No PO rates to value this GRR" });
  else if (c.expectedSkipped.length) f.push({ text: `${c.expectedSkipped.length} line${c.expectedSkipped.length === 1 ? "" : "s"} not valued`, title: c.expectedSkipped.join("\n") });
  if (c.qtyMismatch) f.push({ text: `Invoice qty ≠ received (${c.qtyMismatch})`, title: "The invoice quantity on the GRR differs from what was received" });
  if (c.qc === "rejected") f.push({ text: "QC rejected", title: "The goods were rejected at inspection" });
  if (c.qc === "partial") f.push({ text: "QC part accepted", title: "Only part of the goods were accepted at inspection" });
  if (!c.supplier) f.push({ text: "No supplier", title: "No PO to take the supplier from — type it when checking" });
  if (!f.length) return <Pill text="✓ Clear" color="#166534" bg="#DCFCE7" />;
  return <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>{f.map(x => <span key={x.text} title={x.title}><Pill text={x.text} color="#B45309" bg="#FEF3C7" /></span>)}</span>;
}

function MatchPill({ status, diff }: { status: "ok" | "over" | "under" | "unknown"; diff: number }) {
  if (status === "ok") return <Pill text="✓ Matches" color="#166534" bg="#DCFCE7" />;
  if (status === "unknown") return <Pill text="Not checked" color="#64748B" bg="#F1F5F9" />;
  return <Pill text={`${status === "over" ? "Invoice +" : "Invoice −"}${fmtRs(Math.abs(diff)).replace("Rs ", "Rs ")}`} color={status === "over" ? "#B91C1C" : "#B45309"} bg={status === "over" ? "#FEE2E2" : "#FEF3C7"} />;
}

function Due({ date, today }: { date: string | null; today: string }) {
  const d = dueInfo(date, today);
  if (d.tone === "none") return <span style={{ color: "var(--text3)" }}>—</span>;
  const tone = d.tone === "late" ? ["#B91C1C", "#FEE2E2"] : d.tone === "soon" ? ["#B45309", "#FEF3C7"] : ["#475569", "#F1F5F9"];
  return <span title={date ? fmtDate(date) : ""}><Pill text={d.label} color={tone[0]} bg={tone[1]} /></span>;
}

function Pill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;
}

function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub: string; tone: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="card" style={{ padding: "10px 12px", textAlign: "left", cursor: onClick ? "pointer" : "default", borderLeft: `4px solid ${tone}`, background: "var(--bg)" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: tone, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text3)" }}>{sub}</div>
    </button>
  );
}

function Modal({ title, sub, onClose, children, width = 640 }: { title: string; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div onClick={onClose} className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: width, width: "100%", padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>{sub && <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{sub}</div>}</div>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text2)" };

// ---------------------------------------------------------------- Check the invoice (the three-way match)
function CheckModal({ c, cases, canApprove, onClose, onSaved }: { c: ApCase; cases: ApCase[]; canApprove: boolean; onClose: () => void; onSaved: () => void }) {
  // Credit days: what this supplier was given last time, else the usual.
  const lastDays = cases.filter(x => x.grnId !== c.grnId && norm(x.supplier) === norm(c.supplier) && x.inv?.creditDays != null)
    .sort((a, b) => (b.inv?.verifiedAt || "").localeCompare(a.inv?.verifiedAt || ""))[0]?.inv?.creditDays;
  const [invoiceDate, setInvoiceDate] = useState(c.inv?.invoiceDate || c.grnDate);
  const [invoiceAmount, setInvoiceAmount] = useState(c.inv?.invoiceAmount != null ? String(c.inv.invoiceAmount) : "");
  const [payable, setPayable] = useState(c.inv?.payableAmount != null ? String(c.inv.payableAmount) : "");
  const [payableTouched, setPayableTouched] = useState(c.inv?.payableAmount != null);
  const [creditDays, setCreditDays] = useState(String(c.inv?.creditDays ?? lastDays ?? DEFAULT_CREDIT_DAYS));
  const [supplier, setSupplier] = useState(c.inv?.supplier || "");
  const [note, setNote] = useState(c.inv?.note || "");
  const [approve, setApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const inv = invoiceAmount.trim() === "" ? null : Number(invoiceAmount.replace(/,/g, ""));
  const suggested = suggestPayable(c.expected, inv);
  const pay = payableTouched ? (payable.trim() === "" ? null : Number(payable.replace(/,/g, ""))) : suggested;
  const m = matchResult(c.expected, inv);
  const noteNeeded = needsNote(c.expected, pay, inv);
  const days = Number(creditDays);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) && Number.isFinite(days) ? addDays(invoiceDate, Math.max(0, Math.round(days))) : null;

  async function save() {
    setBusy(true); setErr("");
    const e = await post(`/api/payables/${c.grnId}`, { action: "check", invoiceDate, invoiceAmount, payableAmount: pay ?? "", creditDays, supplier, note, approve });
    setBusy(false);
    if (e) setErr(e); else onSaved();
  }

  return (
    <Modal title={`Check invoice — GRR #${c.grr}`} sub={<>{c.supplier || "No supplier on the PO"} · Invoice <b>{c.invNo}</b>{c.po ? <> · PO #{c.po}</> : null}</>} onClose={onClose} width={700}>
      <MatchBox c={c} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 14 }}>
        {!c.supplier && <label style={field}>Supplier *<input className="auth-input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier's name" /></label>}
        <label style={field}>Invoice date *<input className="auth-input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></label>
        <label style={field}>Invoice amount (Rs, tax included) *<input className="auth-input" inputMode="decimal" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} placeholder="As on the supplier's invoice" autoFocus /></label>
        <label style={field}>Amount to pay (Rs) *
          <input className="auth-input" inputMode="decimal" value={payableTouched ? payable : suggested != null ? String(suggested) : ""}
            onChange={e => { setPayableTouched(true); setPayable(e.target.value); }} />
          {payableTouched && suggested != null && pay !== suggested && <button type="button" className="btn btn-xs" style={{ alignSelf: "flex-start" }} onClick={() => setPayableTouched(false)}>Use {fmtRs(suggested)}</button>}
        </label>
        <label style={field}>Credit days<input className="auth-input" inputMode="numeric" value={creditDays} onChange={e => setCreditDays(e.target.value)} />
          <span style={{ fontWeight: 400, color: "var(--text3)" }}>Due {due ? fmtDate(due) : "—"}{lastDays != null && !c.inv ? ` · ${c.supplier} had ${lastDays} days last time` : ""}</span>
        </label>
      </div>
      {inv != null && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {m.status === "ok" && <span style={{ color: "#166534", fontWeight: 700 }}>✓ The invoice agrees with the PO and the GRR.</span>}
          {m.status === "over" && <span style={{ color: "#B91C1C", fontWeight: 700 }}>The invoice is {fmtRs(m.diff)} more than the PO and GRR come to — pay what was received at the PO&apos;s rates, or put it on hold for a corrected invoice.</span>}
          {m.status === "under" && <span style={{ color: "#B45309", fontWeight: 700 }}>The invoice is {fmtRs(-m.diff)} less than the PO and GRR come to — check for short supply or a discount.</span>}
          {m.status === "unknown" && <span style={{ color: "var(--text2)" }}>The GRR couldn&apos;t be valued from its PO, so check the invoice by hand.</span>}
        </div>
      )}
      <label style={{ ...field, marginTop: 12 }}>Note {noteNeeded ? <span style={{ color: "#B91C1C" }}>* why the amount to pay differs</span> : "(optional)"}
        <textarea className="auth-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. 5 kg short — debit note to supplier; rate as per PO, not invoice" />
      </label>
      {canApprove && <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 13 }}><input type="checkbox" checked={approve} onChange={e => setApprove(e.target.checked)} /> Approve for payment too (skips To approve)</label>}
      {err && <p role="alert" style={{ color: "#B91C1C", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" disabled={busy || inv == null || pay == null || (noteNeeded && !note.trim())} onClick={save}>{busy ? "Saving…" : approve ? "Save & approve" : "Save — send for approval"}</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// PO × GRR, line by line: what the invoice should come to.
function MatchBox({ c }: { c: ApCase }) {
  return (
    <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <b>What the PO and the GRR come to</b>
        <b style={{ fontSize: 15 }}>{fmtRs(c.expected)}</b>
      </div>
      {c.expectedCalc.map(x => <div key={x} style={{ color: "var(--text2)", marginTop: 3 }}>{x}</div>)}
      {c.expectedSkipped.map(x => <div key={x} style={{ color: "#B45309", marginTop: 3 }}>⚠ {x}</div>)}
      {(c.qtyMismatch > 0 || c.qc === "rejected" || c.qc === "partial") && (
        <div style={{ marginTop: 6 }}><Flags c={c} /></div>
      )}
      <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href={`/procurement/grn/${c.grnId}`} target="_blank">Open GRR #{c.grr} ↗</Link>
        {c.poId != null && <Link href={`/procurement/po/${c.poId}`} target="_blank">Open PO #{c.po} ↗</Link>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- One case: everything about it
function CaseModal({ c, today, onClose }: { c: ApCase; today: string; onClose: () => void }) {
  const inv = c.inv;
  const m = matchResult(c.expected, inv?.invoiceAmount ?? null);
  const meta = stageMeta(c.stage);
  const steps: { when: string | null; text: string }[] = [
    { when: c.grnDate, text: `Goods received — GRR #${c.grr}` },
    ...(inv?.verifiedAt ? [{ when: inv.verifiedAt.slice(0, 10), text: `Invoice checked by ${inv.verifiedBy}: invoice ${fmtRs(inv.invoiceAmount)}, to pay ${fmtRs(inv.payableAmount)}` }] : []),
    ...(inv?.heldAt ? [{ when: inv.heldAt.slice(0, 10), text: `Put on hold by ${inv.heldBy}: ${inv.holdReason}` }] : []),
    ...(inv?.approvedAt ? [{ when: inv.approvedAt.slice(0, 10), text: `Approved for payment by ${inv.approvedBy}` }] : []),
    ...c.payments.map(p => ({ when: p.date, text: `${pvLabel(p.pvNo)} — ${fmtRs(p.amount)} by ${payMethodLabel(p.method)}${p.reference ? ` ${p.reference}` : ""}` })),
  ];
  return (
    <Modal title={`GRR #${c.grr} — ${c.supplier || "no supplier"}`} sub={<><Pill text={meta.label} color={meta.color} bg={meta.bg} /> &nbsp;Invoice {c.invNo || "not in yet"}{c.po ? ` · PO #${c.po}` : ""}</>} onClose={onClose} width={720}>
      <MatchBox c={c} />
      {inv?.invoiceAmount != null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 12, fontSize: 13 }}>
          <Fact k="Invoice" v={<>{fmtRs(inv.invoiceAmount)} <MatchPill status={m.status} diff={m.diff} /></>} />
          <Fact k="To pay" v={fmtRs(inv.payableAmount)} />
          <Fact k="Paid" v={fmtRs(c.paid)} />
          <Fact k="Balance" v={fmtRs(c.balance)} />
          <Fact k="Invoice date" v={inv.invoiceDate ? fmtDate(inv.invoiceDate) : "—"} />
          <Fact k="Due" v={<>{inv.dueDate ? fmtDate(inv.dueDate) : "—"} {c.stage === "pay" && <Due date={inv.dueDate} today={today} />}</>} />
        </div>
      )}
      {inv?.note && <p style={{ fontSize: 13, marginTop: 10 }}><b>Note:</b> {inv.note}</p>}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>History</div>
        {steps.sort((a, b) => (a.when || "").localeCompare(b.when || "")).map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--border)" : undefined }}>
            <span style={{ width: 86, color: "var(--text3)", flexShrink: 0 }}>{s.when ? fmtDate(s.when) : ""}</span><span>{s.text}</span>
          </div>
        ))}
      </div>
      {c.payments.length > 0 && <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>{c.payments.map(p => <Link key={p.id} className="btn btn-xs" href={`/finance/payments/${p.id}`}>🖨 {pvLabel(p.pvNo)}</Link>)}</div>}
    </Modal>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>{k}</div><div style={{ fontWeight: 700 }}>{v}</div></div>;
}

// ---------------------------------------------------------------- Record a payment
function PayModal({ list, today, onClose, onSaved }: { list: ApCase[]; today: string; onClose: () => void; onSaved: () => void }) {
  const [amounts, setAmounts] = useState<Record<number, string>>(Object.fromEntries(list.map(c => [c.grnId, String(c.balance ?? 0)])));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<string>("cheque");
  const [reference, setReference] = useState("");
  const [bank, setBank] = useState("");
  const [wht, setWht] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const total = list.reduce((s, c) => s + (Number(String(amounts[c.grnId] ?? "").replace(/,/g, "")) || 0), 0);
  const whtNum = Number(wht.replace(/,/g, "")) || 0;

  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/payables/payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, method, reference, bank, wht, notes, allocations: list.map(c => ({ grnId: c.grnId, amount: amounts[c.grnId] })) }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error || "Couldn't save the payment."); return; }
    if (confirm(`${pvLabel(d.pvNo)} saved. Print the payment voucher now?`)) window.open(`/finance/payments/${d.id}`, "_blank");
    onSaved();
  }

  return (
    <Modal title={`Record payment — ${list[0].supplier}`} sub={`${list.length} invoice${list.length === 1 ? "" : "s"}. Change an amount to pay part of it; the rest stays owing.`} onClose={onClose} width={720}>
      <table style={{ width: "100%" }}>
        <thead><tr><th>GRR #</th><th>Invoice</th><th>Due</th><th className="num">Balance</th><th className="num">Paying now</th></tr></thead>
        <tbody>{list.map(c => (
          <tr key={c.grnId}>
            <td>#{c.grr}</td><td>{c.invNo}</td><td><Due date={c.inv?.dueDate ?? null} today={today} /></td>
            <td className="num">{fmtRs(c.balance)}</td>
            <td className="num"><input className="auth-input" inputMode="decimal" aria-label={`Amount for GRR ${c.grr}`} style={{ width: 130, textAlign: "right" }}
              value={amounts[c.grnId] ?? ""} onChange={e => setAmounts(a => ({ ...a, [c.grnId]: e.target.value }))} /></td>
          </tr>
        ))}</tbody>
      </table>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14 }}>
        <label style={field}>Payment date *<input className="auth-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label style={field}>Paid by *<select value={method} onChange={e => setMethod(e.target.value)}>{PAY_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
        {method !== "cash" && <label style={field}>{method === "cheque" ? "Cheque No *" : "Transaction / ref No *"}<input className="auth-input" value={reference} onChange={e => setReference(e.target.value)} /></label>}
        {method !== "cash" && <label style={field}>Bank<input className="auth-input" value={bank} onChange={e => setBank(e.target.value)} placeholder="e.g. Meezan Bank" /></label>}
        <label style={field}>Tax withheld (Rs)<input className="auth-input" inputMode="decimal" value={wht} onChange={e => setWht(e.target.value)} placeholder="0" />
          <span style={{ fontWeight: 400, color: "var(--text3)" }}>Income / sales tax deducted at source</span></label>
      </div>
      <label style={{ ...field, marginTop: 12 }}>Notes<input className="auth-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional" /></label>
      <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg2)", borderRadius: 8, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
        <span>Settles <b>{fmtRs(total)}</b></span>
        {whtNum > 0 && <span>Tax withheld <b>{fmtRs(whtNum)}</b></span>}
        <span>Supplier receives <b style={{ color: "#166534", fontSize: 15 }}>{fmtRs(total - whtNum)}</b></span>
      </div>
      {err && <p role="alert" style={{ color: "#B91C1C", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" disabled={busy || !(total > 0)} onClick={save}>{busy ? "Saving…" : "Save payment"}</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function SettingsModal({ startDate, onClose, onSaved }: { startDate: string; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(startDate);
  const [err, setErr] = useState("");
  return (
    <Modal title="Payables settings" onClose={onClose} width={460}>
      <label style={field}>Start from GRRs dated
        <input className="auth-input" type="date" value={d} onChange={e => setD(e.target.value)} />
        <span style={{ fontWeight: 400, color: "var(--text3)" }}>GRRs before this date were paid the old way and stay out of Payables (unless one has already been checked here).</span>
      </label>
      {err && <p role="alert" style={{ color: "#B91C1C", fontSize: 13 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" onClick={async () => { const e = await post("/api/payables/settings", { startDate: d }, "PUT"); if (e) setErr(e); else onSaved(); }}>Save</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Payments (the vouchers)
function PaymentsView({ data }: { data: PayablesData }) {
  const router = useRouter();
  const canVoid = useCanEdit("payables.void");
  const [q, setQ] = usePageState("q", "");
  const [showVoid, setShowVoid] = usePageState("voided", false);
  const range = useReportRange(data.payments);
  const shown = range.rows.filter(p => (showVoid || !p.voidedAt)
    && (!q.trim() || hit(q, pvLabel(p.pvNo), p.supplier, p.reference, p.bank, p.notes, payMethodLabel(p.method), p.lines.map(l => `${l.grr} ${l.invNo}`).join(" "))));
  const live = shown.filter(p => !p.voidedAt);
  const total = live.reduce((s, p) => s + p.total, 0), wht = live.reduce((s, p) => s + p.wht, 0);

  async function voidIt(p: ApPaymentRow) {
    const reason = prompt(`Void ${pvLabel(p.pvNo)} (${fmtRs(p.total)} to ${p.supplier})? What it paid will be owed again. Say why:`);
    if (!reason || !reason.trim()) return;
    const e = await post(`/api/payables/payments/${p.id}`, { reason }, "DELETE");
    if (e) alert(e); else router.refresh();
  }

  return (
    <div className="fade-up">
      <ReportExportControls range={range} filename="payments" sheet={{
        sheetName: "Payments", title: "PAYMENTS TO SUPPLIERS",
        headers: ["PV No", "Date", "Supplier", "Paid by", "Reference", "Bank", "Invoices (GRR)", "Settled", "Tax withheld", "Paid to supplier", "Recorded by", "Voided"],
        colWidths: [10, 12, 28, 14, 16, 18, 30, 14, 14, 16, 18, 26],
        rows: shown.map(p => [pvLabel(p.pvNo), fmtDate(p.date), p.supplier, payMethodLabel(p.method), p.reference, p.bank, p.lines.map(l => `GRR ${l.grr} (${l.invNo})`).join(", "), p.total, p.wht, p.total - p.wht, p.createdBy, p.voidedAt ? `${p.voidReason} — ${p.voidedBy}` : ""]),
      }}
        chips={<><StatChip label="Payments" value={live.length} /><StatChip label="Paid" value={fmtRs(total - wht)} />{wht > 0 && <StatChip label="Tax withheld" value={fmtRs(wht)} />}</>}
        search={<SearchBox width={260} value={q} onChange={setQ} placeholder="🔍  PV, supplier, cheque, GRR, invoice…" />}
        tabs={<label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={showVoid} onChange={e => setShowVoid(e.target.checked)} /> Show voided</label>}
      />
      <div className="card fit-card">
        <table>
          <thead><tr><th>PV No</th><th>Date</th><th>Supplier</th><th>Paid by</th><th>Invoices</th><th className="num">Settled</th><th className="num">Tax withheld</th><th className="num">Paid</th><th>By</th><th className="no-print" style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {shown.length === 0 ? <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>{q ? "No payments match." : "No payments yet."}</td></tr>
              : shown.map(p => (
                <tr key={p.id} onClick={() => router.push(`/finance/payments/${p.id}`)} style={{ cursor: "pointer", opacity: p.voidedAt ? 0.55 : 1, textDecoration: p.voidedAt ? "line-through" : undefined }} title={p.voidedAt ? `Voided by ${p.voidedBy}: ${p.voidReason}` : "Open the payment voucher"}>
                  <td style={{ fontWeight: 700, color: "var(--brand)" }}>{pvLabel(p.pvNo)}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.supplier}</td>
                  <td>{payMethodLabel(p.method)}{p.reference ? <div style={{ fontSize: 11, color: "var(--text3)" }}>{p.reference}{p.bank ? ` · ${p.bank}` : ""}</div> : null}</td>
                  <td>{p.lines.map(l => `#${l.grr}`).join(", ")}</td>
                  <td className="num">{fmtRs(p.total)}</td>
                  <td className="num">{p.wht ? fmtRs(p.wht) : "—"}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmtRs(p.total - p.wht)}</td>
                  <td>{p.createdBy}</td>
                  <td className="no-print" style={{ textAlign: "right", whiteSpace: "nowrap", textDecoration: "none" }} onClick={e => e.stopPropagation()}>
                    <Link className="btn btn-xs" style={{ marginRight: 4 }} href={`/finance/payments/${p.id}`}>🖨 Voucher</Link>
                    {canVoid && !p.voidedAt && <button className="btn btn-xs" style={{ color: "#A32D2D" }} onClick={() => voidIt(p)}>Void</button>}
                    {p.voidedAt && <Pill text="Voided" color="#B91C1C" bg="#FEE2E2" />}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Supplier balances (who is owed what, and how late)
function SuppliersView({ data }: { data: PayablesData }) {
  const router = useRouter();
  const { today, cases } = data;
  const [q, setQ] = usePageState("q", "");
  const since30 = addDays(today, -30);
  // The dates, when given, pick which GRRs are counted (by GRR date).
  const range = useReportRange(cases.map(c => ({ ...c, date: c.grnDate })));
  const inRange = range.rows;
  const rows = useMemo(() => {
    const by = new Map<string, { supplier: string; open: number; inCheck: number; toApprove: number; owed: number; aging: number[]; overdue: number; paid30: number }>();
    const get = (s: string) => {
      const k = norm(s) || "—";
      if (!by.has(k)) by.set(k, { supplier: s || "(no supplier)", open: 0, inCheck: 0, toApprove: 0, owed: 0, aging: AGING_BUCKETS.map(() => 0), overdue: 0, paid30: 0 });
      return by.get(k)!;
    };
    for (const c of inRange) {
      if (c.stage === "noinvoice" || c.stage === "done") continue;
      const r = get(c.supplier);
      r.open++;
      if (c.stage === "check" || c.stage === "hold") r.inCheck += c.expected ?? 0;
      if (c.stage === "approve") r.toApprove += c.inv?.payableAmount ?? 0;
      if (c.stage === "pay") {
        const bal = c.balance ?? 0;
        r.owed += bal;
        const b = agingBucket(c.inv?.dueDate ?? null, today);
        r.aging[b] += bal;
        if (b > 0) r.overdue += bal;
      }
    }
    for (const p of data.payments) if (!p.voidedAt && p.date >= since30) get(p.supplier).paid30 += p.total;
    return [...by.values()].filter(r => r.open || r.paid30).sort((a, b) => b.overdue - a.overdue || b.owed - a.owed || a.supplier.localeCompare(b.supplier));
  }, [inRange, data.payments, today, since30]);
  const shown = rows.filter(r => !q.trim() || hit(q, r.supplier));
  const tot = (f: (r: typeof rows[number]) => number) => shown.reduce((s, r) => s + f(r), 0);

  return (
    <div className="fade-up">
      <ReportExportControls range={range} filename="supplier-balances" sheet={{
        sheetName: "Supplier balances", title: `SUPPLIER BALANCES — ${fmtDate(today)}`,
        headers: ["Supplier", "Open invoices", "Being checked (PO × GRR)", "To approve", "Owed", ...AGING_BUCKETS.map(b => `Owed: ${b}`), "Paid last 30 days"],
        colWidths: [30, 12, 18, 16, 16, 14, 14, 14, 14, 14, 18],
        rows: shown.map(r => [r.supplier, r.open, r.inCheck, r.toApprove, r.owed, ...r.aging, r.paid30]),
      }}
        chips={<><StatChip label="Owed" value={fmtRs(tot(r => r.owed))} /><StatChip label="Overdue" value={fmtRs(tot(r => r.overdue))} /></>}
        search={<SearchBox width={240} value={q} onChange={setQ} placeholder="🔍  Supplier…" />}
      />
      <div className="card fit-card">
        <table>
          <thead><tr>
            <th>Supplier</th><th className="num">Open</th><th className="num">Being checked</th><th className="num">To approve</th><th className="num">Owed</th>
            {AGING_BUCKETS.map(b => <th key={b} className="num">{b === "Not due" ? "Not due yet" : `${b} late`}</th>)}
            <th className="num">Paid (30 days)</th>
          </tr></thead>
          <tbody>
            {shown.length === 0 ? <tr><td colSpan={6 + AGING_BUCKETS.length} style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>Nothing owed.</td></tr>
              : shown.map(r => (
                <tr key={r.supplier} onClick={() => router.push(`/finance/payables?supplier=${encodeURIComponent(r.supplier)}`)} style={{ cursor: "pointer" }} title="Open this supplier's invoices">
                  <td style={{ fontWeight: 700 }}>{r.supplier}</td>
                  <td className="num">{r.open}</td>
                  <td className="num">{r.inCheck ? fmtRs(r.inCheck) : "—"}</td>
                  <td className="num">{r.toApprove ? fmtRs(r.toApprove) : "—"}</td>
                  <td className="num" style={{ fontWeight: 800 }}>{r.owed ? fmtRs(r.owed) : "—"}</td>
                  {r.aging.map((a, i) => <td key={i} className="num" style={{ color: a && i >= 3 ? "#B91C1C" : a && i >= 1 ? "#B45309" : undefined, fontWeight: a && i ? 700 : 400 }}>{a ? fmtRs(a) : "—"}</td>)}
                  <td className="num">{r.paid30 ? fmtRs(r.paid30) : "—"}</td>
                </tr>
              ))}
          </tbody>
          {shown.length > 1 && <tfoot><tr style={{ fontWeight: 800 }}>
            <td>Total</td><td className="num">{tot(r => r.open)}</td><td className="num">{fmtRs(tot(r => r.inCheck))}</td><td className="num">{fmtRs(tot(r => r.toApprove))}</td><td className="num">{fmtRs(tot(r => r.owed))}</td>
            {AGING_BUCKETS.map((_, i) => <td key={i} className="num">{fmtRs(tot(r => r.aging[i]))}</td>)}
            <td className="num">{fmtRs(tot(r => r.paid30))}</td>
          </tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
