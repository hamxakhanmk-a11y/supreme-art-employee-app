"use client";
import { useCallback, useEffect, useState } from "react";
import EditCell from "../EditCell";
import { rs } from "@/lib/pso";

type Topup = { id: number; kind: "opening" | "topup"; date: string; amount: number; refNo: string; createdBy: string; createdAt: string };

// One card's money history, opened from its balance on All cards. Each entry
// can be corrected where it stands; the balance follows, since it is worked
// out from these rows rather than kept.
export default function TopupHistory({ cardId, readOnly, canDelete, onChanged }: {
  cardId: number; readOnly: boolean; canDelete: boolean; onChanged: () => void;
}) {
  const [rows, setRows] = useState<Topup[] | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/fleet/topups?cardId=${cardId}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load the history");
      setRows(j); setErr("");
    } catch (e: any) { setErr(e.message); }
  }, [cardId]);
  useEffect(() => { load(); }, [load]);

  const save = async (id: number, patch: Record<string, unknown>): Promise<boolean> => {
    setErr("");
    try {
      const res = await fetch("/api/fleet/topups", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      onChanged();
      return true;
    } catch (e: any) { setErr(e.message); return false; }
  };

  const remove = async (t: Topup) => {
    if (!confirm(`Delete this ${t.kind === "opening" ? "opening balance" : "top-up"} of ${rs(t.amount)}?`)) return;
    setErr("");
    const res = await fetch(`/api/fleet/topups?id=${t.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) { setErr(j.error || "Could not delete"); return; }
    await load(); onChanged();
  };

  if (rows === null) return <div style={{ fontSize: 12, color: "var(--text3)", padding: 8 }}>{err || "Loading…"}</div>;
  return (
    <div style={{ padding: "6px 0" }}>
      {err && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 6 }}>{err}</div>}
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text3)" }}>No money recorded on this card yet.</div>
      ) : (
        <table style={{ fontSize: 12, width: "auto", background: "transparent" }}>
          <thead>
            <tr><th>Date</th><th>Entry</th><th className="num">Amount</th><th>Ref / receipt</th><th>Entered by</th>{!readOnly && canDelete && <th />}</tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id}>
                <td><EditCell type="date" value={t.date} minWidth={130} readOnly={readOnly} onSave={v => save(t.id, { date: v })} /></td>
                <td style={{ fontWeight: 600, color: t.kind === "opening" ? "var(--brand)" : "#15803D" }}>
                  {t.kind === "opening" ? "Opening balance" : "Top-up"}
                </td>
                <td className="num">
                  <EditCell type="number" value={String(t.amount)} minWidth={100} align="right" bold readOnly={readOnly}
                    onSave={v => save(t.id, { amount: v })} />
                </td>
                <td><EditCell value={t.refNo} minWidth={120} placeholder="—" readOnly={readOnly} onSave={v => save(t.id, { refNo: v })} /></td>
                <td style={{ color: "var(--text2)" }}>{t.createdBy || "—"}</td>
                {!readOnly && canDelete && (
                  <td><button className="btn btn-xs btn-restricted" onClick={() => remove(t)}>Delete</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
