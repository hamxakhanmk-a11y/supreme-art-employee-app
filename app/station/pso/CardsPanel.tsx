"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import TopupHistory from "./TopupHistory";
import { balanceState, BALANCE_COLOR, rs } from "@/lib/pso";

// The cards themselves, above the register they appear in: what the terminal
// hands out, and where a card is moved to another vehicle, blocked, or written
// off. Lives on the PSO Cards tab rather than a tab of its own.

type VehicleRow = { id: number; vehicleNo: string; name: string | null; active: boolean };
type Card = {
  id: number; sn: string; vehicleId: number | null; vehicleNo: string | null; vehiclePin: string | null;
  status: string; notes: string;
  balance: number | null;   // null until the card's opening balance is set
  out: { driver: string; since: string | null } | null;
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  in_use:  { label: "In use",  color: "#15803D", bg: "#dcf5dc" },
  spare:   { label: "Spare",   color: "#185FA5", bg: "#e0f2fe" },
  blocked: { label: "Blocked", color: "#92400E", bg: "#FEF3C7" },
  lost:    { label: "Lost",    color: "#A32D2D", bg: "#fde2e2" },
};

const BLANK = { id: 0, sn: "", vehicleId: "" as number | "", status: "in_use", notes: "" };

export default function CardsPanel({ vehicles, readOnly, canDelete = false, onChanged }: {
  vehicles: VehicleRow[]; readOnly: boolean; canDelete?: boolean; onChanged?: () => void;
}) {
  const [list, setList] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ ...BLANK });
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lowLevel, setLowLevel] = useState(5000);
  const [lowDraft, setLowDraft] = useState("");
  // The card whose money form is open, and whether it is a first count.
  const [money, setMoney] = useState<{ cardId: number; kind: "opening" | "topup"; date: string; amount: string; refNo: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/cards", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load cards");
      setList(j.cards); setLowLevel(j.lowLevel); setLowDraft(String(j.lowLevel)); setErr("");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({ ...BLANK }); setErr(""); setFormOpen(true); };
  const closeForm = () => { setForm({ ...BLANK }); setErr(""); setFormOpen(false); };

  const save = async () => {
    if (!form.sn.trim()) { setErr("Card SN is required"); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/cards", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vehicleId: form.vehicleId || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      closeForm();
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const edit = (c: Card) => {
    setErr(""); setFormOpen(true);
    setForm({ id: c.id, sn: c.sn, vehicleId: c.vehicleId ?? "", status: c.status, notes: c.notes || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (c: Card) => {
    if (!confirm(`Delete card ${c.sn}? Only a card with no entries behind it can go.`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/fleet/cards?id=${c.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not delete");
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const today = () => new Date().toLocaleDateString("en-CA");
  const openMoney = (c: Card) => {
    setErr(""); setHistoryFor(null);
    setMoney({ cardId: c.id, kind: c.balance === null ? "opening" : "topup", date: today(), amount: "", refNo: "" });
  };
  const saveMoney = async () => {
    if (!money) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/topups", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(money),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setMoney(null);
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const saveLow = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lowBalance: lowDraft }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setLowLevel(j.lowLevel);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="no-print" style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>All cards</h2>
          <div style={{ color: "#888", marginTop: 2, fontSize: 12 }}>
            Which vehicle each belongs to, and whether it&apos;s in use, blocked or lost. Cards are handed out at the Station terminal.
          </div>
        </div>
        {!readOnly && !formOpen && <button className="btn btn-sm btn-primary" onClick={openAdd}>+ Add card</button>}
      </div>

      {err && <div className="card" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 14, fontSize: 13 }}>{err}</div>}

      {!readOnly && formOpen && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>{form.id ? `Edit card ${form.sn}` : "Add a card"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Card SN *
              <input value={form.sn} onChange={e => setForm({ ...form, sn: e.target.value })} placeholder="e.g. 2840018173" />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Vehicle
              <select value={form.vehicleId} onChange={e => setForm({ ...form, vehicleId: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">— not assigned —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.vehicleNo}{v.active ? "" : " (retired)"}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
              Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", gridColumn: "1 / -1" }}>
              Notes
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. moved from JA-9370 on 11-Aug" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add card"}
            </button>
            <button className="btn" onClick={closeForm}>Cancel</button>
          </div>
        </div>
      )}

      <div className="toolbar-row">
        <span style={{ fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>Warn when a card is under</span>
        <input type="number" min={0} step={500} value={lowDraft} disabled={readOnly || busy}
          onChange={e => setLowDraft(e.target.value)} style={{ width: 110 }} />
        {!readOnly && Number(lowDraft) !== lowLevel && (
          <button className="btn btn-xs btn-primary" disabled={busy} onClick={saveLow}>Save</button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Card SN</th><th>Vehicle</th><th>Vehicle PIN</th><th>Status</th><th className="num">Balance</th><th>Where it is</th><th>Notes</th>
              {!readOnly && <th style={{ width: 140 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={readOnly ? 7 : 8} style={{ color: "var(--text3)", padding: 18 }}>Loading…</td></tr>}
            {!loading && list.length === 0 && (
              <tr><td colSpan={readOnly ? 7 : 8} style={{ color: "var(--text3)", padding: 18 }}>
                No cards yet{readOnly ? "." : " — use “+ Add card” above."}
              </td></tr>
            )}
            {list.map(c => {
              const st = STATUS[c.status] ?? { label: c.status, color: "var(--text2)", bg: "var(--bg2)" };
              return (
                <Fragment key={c.id}>
                <tr>
                  <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.sn}</td>
                  <td>{c.vehicleNo || <span style={{ color: "var(--text3)" }}>not assigned</span>}</td>
                  {/* The PIN that brings this card up at the station terminal. */}
                  <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: c.vehiclePin ? "var(--brand)" : "var(--text3)" }}
                    title={c.vehicleNo && !c.vehiclePin ? "This vehicle has no PIN yet — set one on Station → Vehicles" : undefined}>
                    {c.vehiclePin || (c.vehicleNo ? "no PIN" : "—")}
                  </td>
                  <td>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700 }}>
                      {st.label}
                    </span>
                  </td>
                  <td className="num">
                    {(() => {
                      const bs = balanceState(c.balance, lowLevel);
                      return (
                        <button type="button" onClick={() => { setMoney(null); setHistoryFor(historyFor === c.id ? null : c.id); }}
                          title="Show this card's top-ups"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit",
                                   fontWeight: 700, color: BALANCE_COLOR[bs], textDecoration: "underline dotted" }}>
                          {c.balance === null ? "—" : rs(c.balance)}
                        </button>
                      );
                    })()}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.out
                      ? <span style={{ color: "#B45309", fontWeight: 600 }}>With {c.out.driver} since {c.out.since}</span>
                      : <span style={{ color: "var(--text3)" }}>In the drawer</span>}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{c.notes || "—"}</td>
                  {!readOnly && (
                    <td>
                      <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => openMoney(c)}>
                          {c.balance === null ? "Set opening balance" : "⊕ Top up"}
                        </button>
                        <button className="btn btn-sm" disabled={busy} onClick={() => edit(c)}>Edit</button>
                        {/* Deleting is its own grant (Station · Delete). */}
                        {canDelete && <button className="btn btn-sm btn-restricted" disabled={busy} onClick={() => remove(c)}>Delete</button>}
                      </div>
                    </td>
                  )}
                </tr>
                {money?.cardId === c.id && !readOnly && (
                  <tr>
                    <td colSpan={8} style={{ background: "var(--bg2)" }}>
                      <div className="toolbar-row" style={{ marginBottom: 0 }}>
                        {c.balance === null ? (
                          <strong style={{ fontSize: 13 }}>Opening balance on {c.sn}</strong>
                        ) : (
                          // A card already counted can be counted again: the
                          // new figure takes over from the old one, rather
                          // than the old opening being edited (which would
                          // subtract every fill since then a second time).
                          <select value={money.kind} style={{ width: "auto", fontWeight: 700 }}
                            onChange={e => setMoney({ ...money, kind: e.target.value === "opening" ? "opening" : "topup" })}>
                            <option value="topup">Top up {c.sn}</option>
                            <option value="opening">Recount {c.sn} — new opening balance</option>
                          </select>
                        )}
                        <input type="date" value={money.date} max={today()} onChange={e => setMoney({ ...money, date: e.target.value })} style={{ width: 150 }} />
                        <input type="number" min={0} step="any" value={money.amount} placeholder={money.kind === "opening" ? "Balance on the card (Rs)" : "Amount loaded (Rs)"}
                          onChange={e => setMoney({ ...money, amount: e.target.value })} style={{ width: 190 }} />
                        <input value={money.refNo} placeholder="Ref / receipt no." onChange={e => setMoney({ ...money, refNo: e.target.value })} style={{ width: 170 }} />
                        <button className="btn btn-sm btn-primary" disabled={busy || money.amount === ""} onClick={saveMoney}>{busy ? "Saving…" : "Save"}</button>
                        <button className="btn btn-sm" onClick={() => setMoney(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
                {historyFor === c.id && (
                  <tr>
                    <td colSpan={8} style={{ background: "var(--bg2)" }}>
                      <TopupHistory cardId={c.id} readOnly={readOnly} canDelete={canDelete} onChanged={load} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
