"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import EditCell from "../EditCell";
import { rs } from "@/lib/pso";

// Every rupee loaded onto a PSO card, newest first, with a button to load more on any card. Each entry can be
// corrected where it stands; a card's balance is worked out from these rows (lib/cardBalance.ts), so it follows.

type Card = { id: number; sn: string; vehicleNo: string | null; balance: number | null };
type Entry = {
  id: number; cardId: number; cardSn: string; vehicleNo: string | null;
  kind: "opening" | "topup"; date: string; amount: number; refNo: string; createdBy: string;
};
type Form = { cardId: number | ""; kind: "opening" | "topup"; date: string; amount: string; refNo: string };

const today = () => new Date().toLocaleDateString("en-CA");

export default function TopupsPanel({ readOnly, canDelete }: { readOnly: boolean; canDelete: boolean }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [cardFilter, setCardFilter] = useState<number | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        fetch("/api/fleet/cards", { cache: "no-store" }).then(async r => ({ ok: r.ok, j: await r.json() })),
        fetch("/api/fleet/topups", { cache: "no-store" }).then(async r => ({ ok: r.ok, j: await r.json() })),
      ]);
      if (!c.ok) throw new Error(c.j.error || "Could not load the cards");
      if (!t.ok) throw new Error(t.j.error || "Could not load the top-ups");
      setCards(c.j.cards); setRows(t.j); setErr("");
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cardById = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);
  const shown = useMemo(() => (rows ?? []).filter(r =>
    (cardFilter === "" || r.cardId === cardFilter) && (!from || r.date >= from) && (!to || r.date <= to)), [rows, cardFilter, from, to]);
  const loaded = shown.filter(r => r.kind === "topup").reduce((s, r) => s + r.amount, 0);

  const openForm = () => { setErr(""); setForm({ cardId: cardFilter, kind: "topup", date: today(), amount: "", refNo: "" }); };
  const pick = (id: number | "") => {
    if (!form) return;
    // A card with no money recorded yet has to start from a count.
    const kind = id !== "" && cardById.get(id)?.balance === null ? "opening" : form.kind;
    setForm({ ...form, cardId: id, kind });
  };

  const save = async () => {
    if (!form || form.cardId === "") return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/fleet/topups", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      setForm(null);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const change = async (id: number, patch: Record<string, unknown>): Promise<boolean> => {
    setErr("");
    try {
      const res = await fetch("/api/fleet/topups", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      await load();
      return true;
    } catch (e: any) { setErr(e.message); return false; }
  };

  const remove = async (t: Entry, reverse = false) => {
    const what = `${t.kind === "opening" ? "opening balance" : "top-up"} of ${rs(t.amount)} on card ${t.cardSn}`;
    if (!confirm(reverse
      ? `Reverse this ${what}? It is taken out and the card's balance is worked out without it. The Activity Log keeps a record.`
      : `Delete this ${what}?`)) return;
    setErr("");
    const res = await fetch(`/api/fleet/topups?id=${t.id}${reverse ? "&reverse=1" : ""}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) { setErr(j.error || "Could not delete"); return; }
    await load();
  };

  const selected = form && form.cardId !== "" ? cardById.get(form.cardId) : undefined;

  return (
    <div className="no-print" style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Top-ups</h2>
          <div style={{ color: "#888", marginTop: 2, fontSize: 12 }}>
            Every opening balance and top-up on every card. Click a date, an amount or a reference to correct it; the card&apos;s balance follows.
          </div>
        </div>
        {!readOnly && !form && <button className="btn btn-sm btn-primary" onClick={openForm}>⊕ Top up a card</button>}
      </div>

      {err && <div className="card" style={{ borderColor: "#DC2626", color: "#DC2626", marginBottom: 14, fontSize: 13 }}>{err}</div>}

      {!readOnly && form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="toolbar-row" style={{ marginBottom: 0 }}>
            <select value={form.cardId} style={{ width: "auto", fontWeight: 700 }}
              onChange={e => pick(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choose a card…</option>
              {cards.map(c => (
                <option key={c.id} value={c.id}>
                  {c.sn}{c.vehicleNo ? ` — ${c.vehicleNo}` : ""}{c.balance === null ? " (no balance yet)" : ` · ${rs(c.balance)}`}
                </option>
              ))}
            </select>
            {selected && selected.balance !== null ? (
              // A card already counted can be counted again: the new figure takes over from the old one.
              <select value={form.kind} style={{ width: "auto" }}
                onChange={e => setForm({ ...form, kind: e.target.value === "opening" ? "opening" : "topup" })}>
                <option value="topup">Top up</option>
                <option value="opening">Recount — new opening balance</option>
              </select>
            ) : selected ? (
              <strong style={{ fontSize: 13 }}>Opening balance</strong>
            ) : null}
            <input type="date" value={form.date} max={today()} onChange={e => setForm({ ...form, date: e.target.value })} style={{ width: 150 }} />
            <input type="number" min={0} step="any" value={form.amount}
              placeholder={form.kind === "opening" ? "Balance on the card (Rs)" : "Amount loaded (Rs)"}
              onChange={e => setForm({ ...form, amount: e.target.value })} style={{ width: 190 }} />
            <input value={form.refNo} placeholder="Ref / receipt no." onChange={e => setForm({ ...form, refNo: e.target.value })} style={{ width: 170 }} />
            <button className="btn btn-sm btn-primary" disabled={busy || form.cardId === "" || form.amount === ""} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-sm" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="toolbar-row">
        <span style={{ fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>Card</span>
        <select value={cardFilter} style={{ width: "auto" }} onChange={e => setCardFilter(e.target.value ? Number(e.target.value) : "")}>
          <option value="">All cards</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.sn}{c.vehicleNo ? ` — ${c.vehicleNo}` : ""}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>From</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
        <span style={{ fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>To</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
        {(cardFilter !== "" || from || to) && (
          <button className="btn btn-xs" onClick={() => { setCardFilter(""); setFrom(""); setTo(""); }}>Clear</button>
        )}
        {cardFilter !== "" && cardById.get(cardFilter)?.balance != null && (
          <span style={{ fontSize: 12.5, color: "var(--text2)", marginLeft: "auto" }}>
            Balance now <strong style={{ color: "var(--text)" }}>{rs(cardById.get(cardFilter)!.balance!)}</strong>
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="fit-book">
          <thead>
            <tr>
              <th>Date</th><th>Card SN</th><th>Vehicle</th><th>Entry</th><th className="num">Amount</th>
              <th>Ref / receipt</th><th>Entered by</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows === null && <tr><td colSpan={8} style={{ color: "var(--text3)", padding: 18 }}>Loading…</td></tr>}
            {rows !== null && shown.length === 0 && (
              <tr><td colSpan={8} style={{ color: "var(--text3)", padding: 18 }}>
                {rows.length === 0 ? "No money recorded on any card yet." : "Nothing matches these filters."}
              </td></tr>
            )}
            {shown.map(t => (
              <tr key={t.id}>
                <td><EditCell type="date" value={t.date} minWidth={130} readOnly={readOnly} onSave={v => change(t.id, { date: v })} /></td>
                <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{t.cardSn}</td>
                <td>{t.vehicleNo || <span style={{ color: "var(--text3)" }}>—</span>}</td>
                <td style={{ fontWeight: 600, color: t.kind === "opening" ? "var(--brand)" : "#15803D" }}>
                  {t.kind === "opening" ? "Opening balance" : "Top-up"}
                </td>
                <td className="num">
                  <EditCell type="number" value={String(t.amount)} minWidth={100} align="right" bold readOnly={readOnly}
                    print={rs(t.amount)} onSave={v => change(t.id, { amount: v })} />
                </td>
                <td><EditCell value={t.refNo} minWidth={120} placeholder="—" readOnly={readOnly} onSave={v => change(t.id, { refNo: v })} /></td>
                <td style={{ color: "var(--text2)" }}>{t.createdBy || "—"}</td>
                {!readOnly && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-xs" style={{ color: "#854F0B" }} title="Take a wrong entry out" onClick={() => remove(t, true)}>Reverse</button>
                      {canDelete && <button className="btn btn-xs btn-restricted" onClick={() => remove(t)}>Delete</button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 700 }}>Topped up{cardFilter !== "" || from || to ? " (shown)" : ""}</td>
                <td className="num" style={{ fontWeight: 800 }}>{rs(loaded)}</td>
                <td colSpan={readOnly ? 2 : 3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>
        The total counts top-ups only; an opening balance is a count of what was on the card, not money loaded.
      </div>
    </div>
  );
}
