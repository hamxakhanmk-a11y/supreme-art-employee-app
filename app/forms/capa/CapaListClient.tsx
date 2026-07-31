"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCanEdit } from "@/components/MeProvider";
import { CAPA_STATUS_META, parseCapaData, fmtDate, type CapaStatus } from "@/lib/capa";

type Row = {
  id: number;
  capaRef: string;
  status: string;
  issueDate: string | null;
  data: string;
  createdByName: string | null;
  createdAt: string;
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "closed", label: "Closed" },
];

export default function CapaListClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const canEdit = useCanEdit();
  const [rows] = useState<Row[]>(initial);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = filter === "all" ? rows : rows.filter(r => r.status === filter);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(r => {
        const d = parseCapaData(r.data);
        return [r.capaRef, d.company_name, d.job_name, d.problem_description, d.detected_by]
          .some(v => (v || "").toLowerCase().includes(term));
      });
    }
    return list;
  }, [rows, filter, q]);

  const counts = useMemo(() => ({
    all: rows.length,
    open: rows.filter(r => r.status === "open").length,
    in_progress: rows.filter(r => r.status === "in_progress").length,
    closed: rows.filter(r => r.status === "closed").length,
  } as Record<string, number>), [rows]);

  async function createCapa() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/capa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setCreating(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not create the CAPA.");
      return;
    }
    const { capa } = await res.json();
    router.push(`/forms/capa/${capa.id}`);
  }

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>CAPA Reports</h1>
          <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 4 }}>
            Corrective &amp; Preventive Action reports raised against customer complaints and internal non-conformances.
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={createCapa} disabled={creating}>
            {creating ? "Creating…" : "＋ New CAPA"}
          </button>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: 12 }}>{error}</div>
      )}

      {/* Filters + search */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div className="tabs">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`tab ${filter === f.key ? "active" : ""}`}>
              {f.label}
              <span style={{ opacity: 0.75, fontWeight: 700 }}>{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search ref, company, job, issue…"
          style={{ maxWidth: 300 }} />
      </div>

      {filtered.length === 0 ? (
        <div className="card empty" style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--text2)" }}>
          {rows.length === 0
            ? <>No CAPA reports yet. Click <strong>New CAPA</strong> to raise the first one.</>
            : <>No CAPAs match this filter.</>}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
                <Th style={{ width: 130 }}>CAPA No.</Th>
                <Th>Company / Customer</Th>
                <Th>Job Name</Th>
                <Th style={{ width: 120 }}>Complaint Date</Th>
                <Th style={{ width: 120 }}>Status</Th>
                <Th style={{ width: 80, textAlign: "right" }}></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const d = parseCapaData(r.data);
                const meta = CAPA_STATUS_META[(r.status as CapaStatus)] || CAPA_STATUS_META.open;
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Td><Link href={`/forms/capa/${r.id}`} style={{ fontWeight: 700, color: "var(--brand)", textDecoration: "none" }}>{r.capaRef}</Link></Td>
                    <Td>{d.company_name || <span style={{ color: "var(--text3)" }}>—</span>}</Td>
                    <Td>{d.job_name || <span style={{ color: "var(--text3)" }}>—</span>}</Td>
                    <Td>{fmtDate(r.issueDate) || <span style={{ color: "var(--text3)" }}>—</span>}</Td>
                    <Td>
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 999,
                        fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
                        background: meta.bg, color: meta.fg,
                      }}>{meta.label}</span>
                    </Td>
                    <Td style={{ textAlign: "right" }}>
                      <Link href={`/forms/capa/${r.id}`} className="btn btn-sm">Open</Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--text2)", ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 14px", verticalAlign: "middle", ...style }}>{children}</td>;
}
