"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Emp = { id: number; employeeId: string; firstName: string; lastName: string; designation: string | null };

const FORM_TYPES = [
  { key: "leave-form",    label: "Leave Form" },
  { key: "half-day-form", label: "Half-Day Form" },
  { key: "misc",          label: "Other / Misc" },
] as const;

export default function FileFormClient({ employees }: { employees: Emp[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState<"leave-form" | "half-day-form" | "misc">("leave-form");
  const [formDate, setFormDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const selectedEmp = employees.find(e => String(e.id) === employeeId);
  const typeLabel = FORM_TYPES.find(t => t.key === category)!.label;
  const niceDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const autoLabel = formDate ? `${typeLabel} — ${niceDate(formDate)}` : typeLabel;

  const uploadFile = async (f: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Upload failed");
    }
    const data = await res.json();
    return data.url as string;
  };

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true); setErr(null);
    try { setFileUrl(await uploadFile(f)); }
    catch (e: any) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !fileUrl) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: autoLabel,
          url: fileUrl,
          category,
          formDate,
          notes: notes || null,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Failed"); }
      setOk(true);
      setTimeout(() => router.push(`/employees/${employeeId}`), 900);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 680, margin: "0 auto" }}>
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        {err && <div style={{ color: "var(--danger)", fontSize: 12, padding: "8px 12px", background: "var(--danger-bg)", borderRadius: 6 }}>{err}</div>}
        {ok && <div style={{ color: "var(--success)", fontSize: 12, padding: "8px 12px", background: "var(--success-bg)", borderRadius: 6 }}>✓ Form filed. Redirecting to employee…</div>}

        <div>
          <label className="form-label">Employee *</label>
          <select required value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">— Select Employee —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId}) — {e.designation || "—"}</option>)}
          </select>
        </div>

        {selectedEmp && (
          <div style={{ background: "var(--bg2)", padding: 10, borderRadius: 7, fontSize: 12, color: "var(--text2)" }}>
            Filing under <strong>{selectedEmp.firstName} {selectedEmp.lastName}</strong> · {selectedEmp.employeeId}
          </div>
        )}

        <div>
          <label className="form-label">Form Type *</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FORM_TYPES.map(t => {
              const active = category === t.key;
              return (
                <button key={t.key} type="button" onClick={() => setCategory(t.key)}
                  style={{
                    padding: "8px 16px", borderRadius: 999,
                    border: `1.5px solid ${active ? "#185FA5" : "var(--border)"}`,
                    background: active ? "#185FA5" : "var(--bg)",
                    color: active ? "#fff" : "var(--text)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    boxShadow: active ? "0 2px 6px rgba(24,95,165,0.25)" : "none",
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="form-label">Form Date *</label>
            <input type="date" required value={formDate} onChange={e => setFormDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Auto-Label</label>
            <div style={{ padding: "9px 12px", border: "1px dashed var(--border)", borderRadius: 7, background: "var(--bg2)", fontSize: 12, color: "var(--text2)" }}>
              {autoLabel}
            </div>
          </div>
        </div>

        <div>
          <label className="form-label">Scanned / Photographed Form *</label>
          {fileUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg2)" }}>
              {/\.(png|jpe?g|gif|webp)$/i.test(fileUrl) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={fileUrl} alt="" style={{ height: 60, borderRadius: 6, border: "1px solid var(--border)" }} />
              ) : (
                <span style={{ fontSize: 13, color: "var(--text)" }}>📄 File uploaded</span>
              )}
              <a href={fileUrl} target="_blank" className="btn btn-sm">Open</a>
              <button type="button" className="btn btn-sm btn-danger-soft" onClick={() => setFileUrl("")}>Replace</button>
            </div>
          ) : (
            <input type="file" accept="image/*,application/pdf"
              onChange={e => handleFile(e.target.files?.[0] as any)}
              disabled={uploading} />
          )}
          {uploading && <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>Uploading…</div>}
        </div>

        <div>
          <label className="form-label">Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Approved by Ahmed, filed in cabinet #3" />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" onClick={() => router.push("/forms")} className="btn">Cancel</button>
          <button type="submit" disabled={saving || uploading || !employeeId || !fileUrl} className="btn btn-primary">
            {saving ? "Filing…" : "📎 File Form"}
          </button>
        </div>
      </form>
    </div>
  );
}
