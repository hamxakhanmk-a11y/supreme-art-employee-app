"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe, useCanEdit } from "@/components/MeProvider";
import {
  CAPA_STAGES, CAPA_CATEGORIES, CAPA_STATUS_META, CAPA_FORM_REV, CAPA_FOOTER_NOTE, CAPA_DOC_NO,
  parseCapaData, type CapaData, type CapaStatus,
} from "@/lib/capa";

type Capa = {
  id: number;
  capaRef: string;
  status: string;
  issueDate: string | null;
  data: string;
  createdByName: string | null;
};

export default function CapaFormClient({ capa }: { capa: Capa }) {
  const router = useRouter();
  const me = useMe();
  const canEdit = useCanEdit();

  const [d, setD] = useState<CapaData>(() => parseCapaData(capa.data));
  const [issueDate, setIssueDate] = useState(capa.issueDate || "");
  const [status, setStatus] = useState(capa.status);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // A closed CAPA is a signed-off record — locked to everyone but the owner.
  const isSuperAdmin = me.user?.role === "superadmin";
  const locked = status === "closed" && !isSuperAdmin;
  const ro = !canEdit || locked;

  const set = (k: keyof CapaData, v: string) => setD(p => ({ ...p, [k]: v }));

  async function save(nextStatus?: string) {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/capa/${capa.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: d, status: nextStatus ?? status, issueDate: issueDate || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg({ kind: "err", text: j.error || "Save failed." });
      return;
    }
    if (nextStatus) setStatus(nextStatus);
    setMsg({ kind: "ok", text: nextStatus === "closed" ? "CAPA closed." : "Saved." });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete ${capa.capaRef}? This cannot be undone.`)) return;
    const res = await fetch(`/api/capa/${capa.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg({ kind: "err", text: j.error || "Delete failed." });
      return;
    }
    router.push("/forms/capa");
  }

  const meta = CAPA_STATUS_META[(status as CapaStatus)] || CAPA_STATUS_META.open;

  return (
    <div className="fade-up capa-page">
      {/* ── Action bar (screen only) ── */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href="/forms/capa" className="btn btn-sm">← All CAPAs</Link>
        <span style={{
          display: "inline-block", padding: "4px 12px", borderRadius: 999,
          fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
          background: meta.bg, color: meta.fg,
        }}>{meta.label}</span>
        <div style={{ flex: 1 }} />
        {canEdit && !locked && (
          <>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 150 }}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
            <button className="btn btn-primary" onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {status !== "closed" && (
              <button className="btn btn-success" onClick={() => save("closed")} disabled={saving}>
                ✓ Close CAPA
              </button>
            )}
            <button className="btn btn-danger-soft btn-sm" onClick={remove}>Delete</button>
          </>
        )}
        <button className="btn btn-print" onClick={() => window.print()}>🖨 Print / PDF</button>
      </div>

      {locked && (
        <div className="no-print" style={{
          background: "#fef3c7", color: "#92400e", padding: "8px 12px",
          borderRadius: 6, fontSize: 12, marginBottom: 12,
        }}>
          🔒 This CAPA is closed and locked. Only a Super Admin can edit it.
        </div>
      )}
      {msg && (
        <div className="no-print" style={{
          padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 12,
          background: msg.kind === "ok" ? "#eaf6ee" : "#fcebeb",
          color: msg.kind === "ok" ? "#15803D" : "#7C1F1F",
          border: `1px solid ${msg.kind === "ok" ? "#a9e3a9" : "#f3c2c2"}`,
        }}>{msg.text}</div>
      )}

      {/* ── The report ── */}
      <div className="capa-sheet">
        <div className="capa-watermark" aria-hidden />
        <div className="capa-docno">Doc No: {CAPA_DOC_NO}</div>

        {/* A <div>, not a <header> — the global print stylesheet hides every
            <header> element, which would drop this report's own header. */}
        <div className="capa-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Supreme Art" className="capa-logo" />
          <div className="capa-head-text">
            <h1 className="capa-title">CORRECTIVE &amp; PREVENTIVE ACTION REPORT</h1>
            <div className="capa-sub">Supreme Art (Private) Limited</div>
          </div>
          <div className="capa-logo-spacer" />
        </div>

        <div className="capa-refbar">
          <span className="capa-lbl">CAPA No.:</span>
          <strong>{capa.capaRef}</strong>
        </div>

        <SectionHead n={1} title="COMPANY DETAILS" />
        <div className="capa-grid">
          <Cell label="Company / Customer (raising the complaint)" value={d.company_name} onChange={v => set("company_name", v)} ph="e.g. Global Pharmaceuticals (Pvt) Ltd" ro={ro} />
          <Cell label="Contact Person" value={d.contact_person} onChange={v => set("contact_person", v)} ph="Name + designation" ro={ro} />
          <Cell label="Job Name" value={d.job_name} onChange={v => set("job_name", v)} ph="e.g. Tavizem 100mg/5ml Suspension" ro={ro} />
          <Cell label="Reference / PO No." value={d.ref_no} onChange={v => set("ref_no", v)} ph="Optional" ro={ro} />
          <DateCell label="Complaint Date" value={issueDate} onChange={setIssueDate} ro={ro} />
        </div>

        <SectionHead n={2} title="PROBLEM DESCRIPTION" />
        <div className="capa-grid">
          <Area label="Description of Non-Conformance / Issue" value={d.problem_description} onChange={v => set("problem_description", v)} ph="Describe the observed defect, deviation, or quality issue in detail" rows={6} ro={ro} />
          <ListCell label="Detected At Stage" value={d.detected_at_stage} onChange={v => set("detected_at_stage", v)} options={CAPA_STAGES} id="stage" ro={ro} />
          <Cell label="Detected By" value={d.detected_by} onChange={v => set("detected_by", v)} ph="Name" ro={ro} />
          <DateCell label="Detection Date" value={d.detection_date} onChange={v => set("detection_date", v)} ro={ro} />
        </div>

        <SectionHead n={3} title="ROOT CAUSE ANALYSIS" />
        <div className="capa-grid">
          <Area label="Root Cause (5-Why / Fishbone Analysis)" value={d.root_cause} onChange={v => set("root_cause", v)} ph="Why → Why → Why…" rows={4} ro={ro} />
          <ListCell label="Category" value={d.category} onChange={v => set("category", v)} options={CAPA_CATEGORIES} id="cat" ro={ro} />
          <Cell label="Analysis Done By" value={d.analysis_done_by} onChange={v => set("analysis_done_by", v)} ph="Name" ro={ro} />
          <DateCell label="Analysis Date" value={d.analysis_date} onChange={v => set("analysis_date", v)} ro={ro} />
        </div>

        <SectionHead n={4} title="ACTIONS" />
        <div className="capa-grid">
          <Area label="Corrective Action (immediate steps to contain / correct)" value={d.corrective_action} onChange={v => set("corrective_action", v)} rows={3} ro={ro} />
          <Area label="Preventive Action (systematic changes to prevent recurrence)" value={d.preventive_action} onChange={v => set("preventive_action", v)} rows={3} ro={ro} />
          <DateCell label="Action Date" value={d.action_date} onChange={v => set("action_date", v)} ro={ro} />
          <Cell label="Action By" value={d.action_by} onChange={v => set("action_by", v)} ph="Name" ro={ro} />
        </div>

        <SectionHead n={5} title="VERIFICATION & CLOSURE" />
        <div className="capa-grid">
          <Area label="Effectiveness Verification" value={d.verification} onChange={v => set("verification", v)} ph="How was the corrective action verified as effective?" rows={3} ro={ro} />
          <Cell label="Verified By" value={d.verified_by} onChange={v => set("verified_by", v)} ph="Name" ro={ro} />
          <DateCell label="Verification Date" value={d.verification_date} onChange={v => set("verification_date", v)} ro={ro} />
          <Cell label="Prepared By" value={d.prepared_by} onChange={v => set("prepared_by", v)} ph="Name" ro={ro} />
          <DateCell label="Prepared Date" value={d.prepared_date} onChange={v => set("prepared_date", v)} ro={ro} />
          <Cell label="Reviewed By" value={d.reviewed_by} onChange={v => set("reviewed_by", v)} ph="Name" ro={ro} />
          <DateCell label="Reviewed Date" value={d.reviewed_date} onChange={v => set("reviewed_date", v)} ro={ro} />
          <Cell label="Approved By" value={d.approved_by} onChange={v => set("approved_by", v)} ph="Name" ro={ro} />
          <DateCell label="Approved Date" value={d.approved_date} onChange={v => set("approved_date", v)} ro={ro} />
          <Area label="CEO Note / Review (for CEO to write)" value={d.ceo_note} onChange={v => set("ceo_note", v)} ph="CEO comments — additional review, resource requests, escalation notes" rows={3} ro={ro} />
        </div>

        <div className="capa-foot">
          {capa.capaRef} · {CAPA_FORM_REV} · {CAPA_FOOTER_NOTE}
        </div>
      </div>

      <style jsx global>{`
        .capa-sheet {
          position: relative;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 26px 30px 22px;
          max-width: 1100px;
          box-shadow: var(--shadow-sm);
        }
        .capa-watermark {
          position: absolute; inset: 0;
          background: url('/logo.png') center 55% / 46% no-repeat;
          opacity: 0.05; pointer-events: none;
        }
        /* Document-control number — fixed top-right on every CAPA report. */
        .capa-docno {
          position: absolute; top: 14px; right: 16px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
          color: var(--text2); white-space: nowrap;
        }
        .capa-head {
          display: flex; align-items: center; gap: 16px;
          padding-bottom: 10px; position: relative;
        }
        .capa-logo { height: 52px; width: auto; object-fit: contain; flex-shrink: 0; }
        .capa-logo-spacer { width: 52px; flex-shrink: 0; }
        .capa-head-text { flex: 1; text-align: center; }
        .capa-title {
          font-size: 19px; font-weight: 800; letter-spacing: 0.02em;
          color: var(--text); margin: 0; line-height: 1.25;
        }
        .capa-sub { font-size: 12px; color: var(--text2); margin-top: 3px; }
        .capa-sub .accent { color: var(--brand); }
        .capa-refbar {
          display: flex; align-items: baseline; gap: 8px;
          border: 1px solid var(--border); border-radius: 8px;
          background: var(--bg2); padding: 9px 14px; margin-bottom: 16px;
          position: relative; font-size: 14px;
        }
        .capa-section-head {
          background: #22303f; color: #fff;
          font-size: 12px; font-weight: 800; letter-spacing: 0.06em;
          padding: 7px 14px; border-radius: 4px;
          margin: 18px 0 12px; position: relative;
        }
        .capa-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 14px 26px; position: relative;
        }
        .capa-cell { display: flex; flex-direction: column; }
        .capa-cell.full { grid-column: 1 / -1; }
        .capa-lbl {
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em;
          text-transform: uppercase; color: #6b7c8f; margin-bottom: 5px;
        }
        .capa-cell input[type="text"], .capa-cell input[type="date"] {
          border: none; border-bottom: 1px solid var(--border2);
          border-radius: 0; padding: 6px 2px; background: transparent; font-size: 14px;
        }
        .capa-cell input:focus { box-shadow: none; border-bottom-color: var(--brand); }
        .capa-cell textarea {
          border: 1px solid var(--border2); border-radius: 6px;
          padding: 9px 11px; font-size: 14px; resize: vertical;
        }
        .capa-cell input:disabled, .capa-cell textarea:disabled {
          background: transparent; color: var(--text); opacity: 1; cursor: default;
        }
        .capa-foot {
          margin-top: 22px; padding-top: 10px;
          border-top: 1px solid var(--border);
          font-size: 11px; color: var(--text2); position: relative;
        }

        @media print {
          @page { size: A4 portrait; margin: 10mm 10mm; }
          .no-print, .app-sidebar, header { display: none !important; }
          html, body { background: #fff !important; }
          main { padding: 0 !important; }
          .capa-sheet {
            border: none; border-radius: 0; box-shadow: none;
            padding: 0; max-width: none;
          }
          .capa-watermark { opacity: 0.05; }

          /* Doc-control number — pin to the sheet's top-right corner on paper. */
          .capa-docno { top: 0; right: 0; font-size: 8.5pt; color: #7C1F1F; }
          /* Header — logo, title and company line stay on the printout. */
          .capa-head { gap: 12px; padding-bottom: 5px; }
          .capa-logo { height: 40px; }
          .capa-logo-spacer { width: 40px; }
          .capa-title { font-size: 14pt; color: #7C1F1F; }
          .capa-sub { font-size: 9pt; margin-top: 1px; }

          .capa-refbar {
            background: transparent !important; border: none;
            border-bottom: 1px solid #7C1F1F; padding: 3px 0;
            margin-bottom: 8px; font-size: 10.5pt;
          }
          /* Print the section bars as light rules with red text — matches the
             approved paper form rather than the dark on-screen bars. */
          .capa-section-head {
            background: transparent !important; color: #7C1F1F !important;
            border-bottom: 1.25px solid #7C1F1F; border-radius: 0;
            padding: 1px 0; margin: 8px 0 5px;
            font-size: 9.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .capa-grid { gap: 6px 20px; }
          .capa-lbl { font-size: 7pt; color: #1a3a5c; margin-bottom: 2px; }
          .capa-cell input[type="text"], .capa-cell input[type="date"] {
            font-size: 9pt; padding: 1px 0; border-bottom: 1px solid #333;
          }
          .capa-cell textarea {
            font-size: 9pt; line-height: 1.3; border: none; border-bottom: 1px solid #333;
            border-radius: 0; padding: 1px 0; min-height: 0;
          }
          .capa-foot { margin-top: 10px; padding-top: 6px; font-size: 8pt; }

          /* Every field has a fixed height (single-line inputs, and textareas
             sized by their rows), so the printout is a constant length no matter
             how much is typed — it lands within two pages every time. Keep each
             section heading with the fields under it, but let the field grids
             flow across the page break so both pages fill densely instead of
             spilling onto a third. */
          .capa-section-head { break-after: avoid; page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

function SectionHead({ n, title }: { n: number; title: string }) {
  return <div className="capa-section-head">{n}. {title}</div>;
}

function Cell({ label, value, onChange, ph, ro }: {
  label: string; value?: string; onChange: (v: string) => void; ph?: string; ro?: boolean;
}) {
  return (
    <div className="capa-cell">
      <div className="capa-lbl">{label}</div>
      <input type="text" value={value || ""} placeholder={ph} disabled={ro}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function DateCell({ label, value, onChange, ro }: {
  label: string; value?: string; onChange: (v: string) => void; ro?: boolean;
}) {
  return (
    <div className="capa-cell">
      <div className="capa-lbl">{label}</div>
      <input type="date" value={value || ""} disabled={ro}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange, ph, rows = 3, ro }: {
  label: string; value?: string; onChange: (v: string) => void; ph?: string; rows?: number; ro?: boolean;
}) {
  return (
    <div className="capa-cell full">
      <div className="capa-lbl">{label}</div>
      <textarea rows={rows} value={value || ""} placeholder={ph} disabled={ro}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ListCell({ label, value, onChange, options, id, ro }: {
  label: string; value?: string; onChange: (v: string) => void;
  options: string[]; id: string; ro?: boolean;
}) {
  return (
    <div className="capa-cell">
      <div className="capa-lbl">{label}</div>
      <input type="text" list={`capa-dl-${id}`} value={value || ""} placeholder="Pick or type…"
        disabled={ro} onChange={e => onChange(e.target.value)} />
      <datalist id={`capa-dl-${id}`}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}
