import { notFound } from "next/navigation";
import Link from "next/link";
import { loadPayables } from "@/lib/payablesServer";
import { COMPANY, fmtDate } from "@/lib/procurement";
import { fmtRs, payMethodLabel, pvLabel, rupeesInWords } from "@/lib/payables";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const amt = (n: number) => fmtRs(n).replace("Rs ", "");

// The payment voucher: what was paid to whom, against which invoices, signed off on paper.
export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPayables();
  const p = data.payments.find(x => x.id === parseInt(id));
  if (!p) notFound();
  const caseOf = new Map(data.cases.map(c => [c.grnId, c]));
  const net = p.total - p.wht;
  const cell: React.CSSProperties = { border: "1px solid #999", padding: "6px 8px", fontSize: 12.5 };
  const head: React.CSSProperties = { ...cell, fontWeight: 700 };

  return (
    <div className="fade-up">
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Link href="/finance/payments" className="btn btn-back">← Back to Payments</Link>
        <PrintButton />
      </div>
      <div className="card" style={{ padding: 28, maxWidth: 860, margin: "0 auto", position: "relative" }}>
        {p.voidedAt && <div style={{ position: "absolute", top: 120, left: 0, right: 0, textAlign: "center", fontSize: 72, fontWeight: 900, color: "rgba(185,28,28,0.18)", transform: "rotate(-12deg)", pointerEvents: "none" }}>VOID</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, borderBottom: "2px solid #222", paddingBottom: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" style={{ height: 48 }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>{COMPANY.name}</div>
              <div style={{ fontSize: 11.5, color: "#444" }}>{COMPANY.address}</div>
              <div style={{ fontSize: 11.5, color: "#444" }}>NTN {COMPANY.ntn} · STRN {COMPANY.strn}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>PAYMENT VOUCHER</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{pvLabel(p.pvNo)}</div>
            <div style={{ fontSize: 12.5 }}>Date: {fmtDate(p.date)}</div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
          <tbody>
            <tr><td style={{ ...head, width: 160 }}>Paid to</td><td style={cell} colSpan={3}>{p.supplier}</td></tr>
            <tr>
              <td style={head}>Paid by</td><td style={cell}>{payMethodLabel(p.method)}</td>
              <td style={{ ...head, width: 140 }}>{p.method === "cheque" ? "Cheque No" : "Reference"}</td><td style={cell}>{p.reference || "—"}</td>
            </tr>
            <tr><td style={head}>Bank</td><td style={cell} colSpan={3}>{p.bank || "—"}</td></tr>
          </tbody>
        </table>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
          <thead><tr style={{ background: "#f1f1ec" }}>
            {["#", "GRR", "PO", "Supplier invoice", "Invoice date", "Items", "Amount (Rs)"].map(h => <th key={h} style={{ ...cell, textAlign: h.startsWith("Amount") ? "right" : "left" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {p.lines.map((l, i) => {
              const c = caseOf.get(l.grnId);
              return (
                <tr key={l.grnId}>
                  <td style={cell}>{i + 1}</td>
                  <td style={cell}>{l.grr}</td>
                  <td style={cell}>{c?.po || "—"}</td>
                  <td style={cell}>{l.invNo || "—"}</td>
                  <td style={cell}>{c?.inv?.invoiceDate ? fmtDate(c.inv.invoiceDate) : "—"}</td>
                  <td style={{ ...cell, maxWidth: 240 }}>{c?.itemsText || ""}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{amt(l.amount)}</td>
                </tr>
              );
            })}
            <tr><td style={{ ...head, textAlign: "right" }} colSpan={6}>Total settled</td><td style={{ ...head, textAlign: "right" }}>{amt(p.total)}</td></tr>
            {p.wht > 0 && <tr><td style={{ ...cell, textAlign: "right" }} colSpan={6}>Less: tax withheld at source</td><td style={{ ...cell, textAlign: "right" }}>({amt(p.wht)})</td></tr>}
            <tr><td style={{ ...head, textAlign: "right", fontWeight: 900 }} colSpan={6}>Paid to supplier</td><td style={{ ...head, textAlign: "right", fontWeight: 900 }}>{amt(net)}</td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10, fontSize: 13 }}><b>In words:</b> {rupeesInWords(net)}</div>
        {p.notes && <div style={{ marginTop: 6, fontSize: 13 }}><b>Notes:</b> {p.notes}</div>}
        {p.voidedAt && <div style={{ marginTop: 6, fontSize: 13, color: "#B91C1C" }}><b>Voided</b> by {p.voidedBy} on {fmtDate(p.voidedAt.slice(0, 10))}: {p.voidReason}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginTop: 56, fontSize: 12 }}>
          {[["Prepared by", p.createdBy], ["Checked by", ""], ["Approved by", ""], ["Received by (supplier)", ""]].map(([k, v]) => (
            <div key={k} style={{ borderTop: "1px solid #222", paddingTop: 4, textAlign: "center" }}>
              <div style={{ fontWeight: 700 }}>{k}</div>
              <div style={{ color: "#555", minHeight: 16 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
