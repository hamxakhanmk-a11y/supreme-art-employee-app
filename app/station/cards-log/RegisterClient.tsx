"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PrintLandscape from "@/components/PrintLandscape";
import PrintHeader from "@/components/PrintHeader";
import { downloadRegisterXlsx } from "@/lib/xlsx";
import type { PsoRow } from "@/lib/fleetServer";


type VehicleRow = { id: number; vehicleNo: string; name: string | null; active: boolean };
export type Person = { id: number; code: string; name: string };

function fmt(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}
const rupees = (n: number | null) => (n === null ? "" : `Rs ${n.toLocaleString("en-PK")}`);

export default function RegisterClient({
  rows, vehicles, people, from, to, readOnly, canDelete,
}: {
  rows: PsoRow[]; vehicles: VehicleRow[]; people: Person[];
  from: string; to: string; readOnly: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const go = (patch: { from?: string; to?: string }) => {
    const p = new URLSearchParams({ from: patch.from ?? from, to: patch.to ?? to });
    router.push(`/station/pso?${p.toString()}`);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.sn + " " + r.driver + " " + r.vehicleNo + " " + r.notes).toLowerCase().includes(q));
  }, [rows, search]);

  const totalAmount = shown.reduce((s, r) => s + (r.amount ?? 0), 0);

  const startEdit = (r: PsoRow) => {
    setErr(""); setEditId(r.id);
    setDraft({
      vehicleId: r.vehicleId ? String(r.vehicleId) : "",
      driverId: r.driverId ? String(r.driverId) : "",
      driverName: r.driverId ? "" : r.driver === "—" ? "" : r.driver,
      collectedDate: r.collectedDate, collectedTime: r.collectedTime,
      submittedDate: r.submittedDate ?? "", submittedTime: r.submittedTime,
      amount: r.amount === null ? "" : String(r.amount),

      slipNo: r.slipNo,
      notes: r.notes,
    });
  };


  const saveEdit = async (id: number) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/card-issues", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...draft, driverId: draft.driverId || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setEditId(null);
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (r: PsoRow) => {
    if (!confirm(`Delete the entry for card ${r.sn} collected ${fmt(r.collectedDate)}? Any fuel it recorded goes with it.`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/fleet/card-issues?id=${r.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not delete");
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const exportXlsx = async () => {
    await downloadRegisterXlsx({
      filename: `pso-card-register-${from}-to-${to}.xlsx`,
      sheetName: "PSO Cards",
      title: `PSO Card Register — ${fmt(from)} to ${fmt(to)}`,
      headers: ["Sr No", "Driver Name", "Veh No.", "Collection Date", "Collection Time", "Date submitted", "Time submitted", "Card SN", "Slip No.", "Fuel (PKR)", "Notes"],
      colWidths: [7, 24, 12, 15, 14, 15, 14, 16, 14, 13, 26],
      rows: shown.map((r, i) => [
        i + 1, r.driver, r.vehicleNo, fmt(r.collectedDate), r.collectedTime,
        fmt(r.submittedDate), r.submittedTime, r.sn, r.slipNo, r.amount ?? "", r.notes,
      ]),
    });
  };

  const cols = readOnly ? 10 : 11;

  return (
    <div className="fade-up">
      <PrintLandscape />
      <PrintHeader title="PSO Cards — Fuel Logbook" meta={`${fmt(from)} to ${fmt(to)} · ${shown.length} entries · ${rupees(totalAmount)}`} />

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📋 Cards Logbook</h1>
          <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
            Every fuel record drawn on a PSO card. Records are entered on <Link href="/station/pso" style={{ color: "var(--brand)" }}>PSO Cards</Link>,
            against whoever is holding the card, and corrected here.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>

          <button className="btn btn-sm" onClick={() => window.print()}>🖨 Print</button>
          <button className="btn btn-sm" onClick={exportXlsx} disabled={!shown.length}>📊 Excel</button>
          <Link href="/station" className="btn btn-sm">🏭 Terminal</Link>
        </div>
      </div>

      {err && <div className="card no-print" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 12, fontSize: 13 }}>{err}</div>}



      <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input placeholder="Search SN, driver, vehicle…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 230 }} />
        <span style={{ fontSize: 12, color: "#666" }}>From</span>
        <input type="date" value={from} onChange={e => e.target.value && go({ from: e.target.value })} style={{ width: 150 }} />
        <span style={{ fontSize: 12, color: "#666" }}>To</span>
        <input type="date" value={to} onChange={e => e.target.value && go({ to: e.target.value })} style={{ width: 150 }} />
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700 }}>{rupees(totalAmount)}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th>Sr</th><th>Driver Name</th><th>Veh No.</th>
              <th>Collection Date</th><th>Time</th>
              <th>Date submitted</th><th>Time</th>
              <th>Card / Slip</th><th className="num">Fuel (PKR)</th><th>Notes</th>
              {!readOnly && <th className="no-print" style={{ width: 120 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={cols} style={{ color: "var(--text3)", padding: 22, textAlign: "center" }}>
                No entries in this range.
              </td></tr>
            )}
            {shown.map((r, i) => editId === r.id ? (
              <tr key={r.id} className="no-print">
                <td style={{ color: "#bbb" }}>{i + 1}</td>
                <td>
                  <select value={draft.driverId} onChange={e => setDraft({ ...draft, driverId: e.target.value })}>
                    <option value="">— typed name —</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                  {!draft.driverId && (
                    <input value={draft.driverName} onChange={e => setDraft({ ...draft, driverName: e.target.value })} placeholder="Name" style={{ marginTop: 4 }} />
                  )}
                </td>
                <td>
                  <select value={draft.vehicleId} onChange={e => setDraft({ ...draft, vehicleId: e.target.value })}>
                    <option value="">—</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
                  </select>
                </td>
                <td><input type="date" value={draft.collectedDate} onChange={e => setDraft({ ...draft, collectedDate: e.target.value })} /></td>
                <td><input type="time" value={draft.collectedTime} onChange={e => setDraft({ ...draft, collectedTime: e.target.value })} /></td>
                <td><input type="date" value={draft.submittedDate} onChange={e => setDraft({ ...draft, submittedDate: e.target.value })} /></td>
                <td><input type="time" value={draft.submittedTime} onChange={e => setDraft({ ...draft, submittedTime: e.target.value })} /></td>
                <td style={{ fontFamily: "monospace" }}>
                  {r.sn}
                  <input value={draft.slipNo} onChange={e => setDraft({ ...draft, slipNo: e.target.value })} placeholder="slip no." style={{ marginTop: 4 }} />
                </td>
                <td>
                  <input type="number" step="any" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} placeholder="PKR" style={{ fontWeight: 700 }} />
                </td>
                <td><input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></td>
                <td className="no-print">
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => saveEdit(r.id)}>Save</button>
                    <button className="btn btn-sm" disabled={busy} onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={r.id} style={!r.submittedDate ? { background: "#FFFBEB" } : undefined}>
                <td style={{ color: "#bbb" }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{r.driver}</td>
                <td style={{ fontFamily: "monospace" }}>{r.vehicleNo}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmt(r.collectedDate)}</td>
                <td>{r.collectedTime}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.submittedDate ? fmt(r.submittedDate) : <span style={{ color: "#B45309", fontWeight: 700 }}>slip pending</span>}
                </td>
                <td>{r.submittedTime}</td>
                <td style={{ fontFamily: "monospace" }}>
                  {r.sn}
                  {r.slipNo && <div style={{ fontSize: 11, color: "var(--text3)" }}>slip {r.slipNo}</div>}
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {r.amount === null ? "" : r.amount.toLocaleString("en-PK")}

                </td>
                <td style={{ color: "var(--text2)" }}>{r.notes}</td>
                {!readOnly && (
                  <td className="no-print">
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm" disabled={busy} onClick={() => startEdit(r)}>Edit</button>
                      {canDelete && <button className="btn btn-sm" style={{ color: "#A32D2D" }} disabled={busy} onClick={() => remove(r)}>Delete</button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={8} style={{ textAlign: "right" }}>Total</td>
                <td className="num">{totalAmount.toLocaleString("en-PK")}</td>
                <td colSpan={readOnly ? 1 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

    </div>
  );
}
