"use client";
import { useMemo, useState } from "react";
import EmployeePrintPage, { type AttachDoc, type EmployeePrintData } from "@/components/EmployeePrintPage";

export default function PrintableForm({ data = {} }: { data?: EmployeePrintData }) {
  const v = (x?: any) => x ? String(x) : "";

  // All attachable documents discovered from the employee record.
  const allAttachables: AttachDoc[] = useMemo(() => {
    const list: AttachDoc[] = [];
    if (data.photoUrl)       list.push({ id: "photo",       label: "Profile Photo",       url: data.photoUrl });
    if (data.cnicFrontUrl)   list.push({ id: "cnic-front",  label: "CNIC (Front)",        url: data.cnicFrontUrl });
    if (data.cnicBackUrl)    list.push({ id: "cnic-back",   label: "CNIC (Back)",         url: data.cnicBackUrl });
    if (data.passportUrl)    list.push({ id: "passport",    label: "Passport",            url: data.passportUrl });
    if (data.ssiUrl)         list.push({ id: "eobi",        label: "EOBI Document",       url: data.ssiUrl });
    if (data.ubiUrl)         list.push({ id: "essi",        label: "ESSI Document",       url: data.ubiUrl });
    (data.education || []).forEach((e, i) => {
      if (e.certificateUrl) list.push({ id: `edu-${i}`, label: `Education Certificate — ${e.degree || ("Record " + (i + 1))}`, url: e.certificateUrl });
    });
    (data.otherDocuments || []).forEach(d => {
      list.push({ id: `other-${d.id}`, label: d.label, url: d.url });
    });
    return list;
  }, [data]);

  // Selection state — nothing pre-checked; user picks before printing.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const setAll = (on: boolean) => setSelected(on ? new Set(allAttachables.map(a => a.id)) : new Set());
  const attached = allAttachables.filter(a => selected.has(a.id));
  const isImage = (u: string) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u);

  return (
    <>
      {/* Print controls + document picker (hidden when printing) */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <a href="/employees" style={{ fontSize: 12, color: "var(--primary)" }}>← Back</a>
        <button className="btn btn-print" onClick={() => window.print()}>
          🖨 Print Form{attached.length > 0 ? ` + ${attached.length} doc${attached.length === 1 ? "" : "s"}` : ""}
        </button>
      </div>

      {allAttachables.length > 0 && (
        <div className="no-print card" style={{ maxWidth: 850, margin: "0 auto 16px", borderColor: "var(--brand)", borderWidth: 2, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 0.8 }}>📎 Attach documents to print?</div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>
                Each ticked document will be appended on its own page after the profile form.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setAll(true)} className="btn btn-sm">Select all</button>
              <button onClick={() => setAll(false)} className="btn btn-sm">Clear</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6 }}>
            {allAttachables.map(a => (
              <label key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text)", cursor: "pointer", padding: "4px 0" }}>
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} style={{ width: 16, height: 16 }} />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <EmployeePrintPage data={data} attached={attached} />

      {/* Appended document pages — one per selected attachment, each on its own
          printed page. Hidden on screen for non-print use to keep the page clean. */}
      {attached.map(a => (
        <div key={a.id} className="print-page attached-doc" style={{
          background: "#fff",
          maxWidth: 850,
          margin: "16px auto 0",
          padding: "20px 24px",
          border: "1px solid var(--border)",
          pageBreakBefore: "always",
          breakBefore: "page",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #A32D2D", paddingBottom: 8, marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Supreme Art" style={{ height: 56, width: "auto", objectFit: "contain" }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#A32D2D" }}>{a.label}</div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                {v(data.firstName)} {v(data.lastName)} · <strong>{v(data.employeeId)}</strong>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            {isImage(a.url) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={a.url} alt={a.label} style={{ maxWidth: "100%", maxHeight: 940, objectFit: "contain", border: "1px solid #ddd" }} />
            ) : (
              <div style={{ padding: 30, border: "1px dashed #999", borderRadius: 6, color: "#555", fontSize: 12 }}>
                📄 <strong>{a.label}</strong>
                <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                  Non-image attachment ({a.url.split(".").pop()?.toUpperCase()}). Print the file separately from its source.
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
