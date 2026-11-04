"use client";
// The Super Admin dashboard, in the Tracker CEO dashboard's way: small tiles (a label, the figure, a short line)
// grouped in bands, and each tile's details in a pop-up from its "See more" button, so the page stays one screen.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CnicAlert, LateComer, DaysOff, CardOut } from "@/lib/ownerDashboard";
import type { OutNow } from "@/lib/stationServer";
import { formatLate } from "@/lib/attendance";
import RangePicker from "./RangePicker";
import { pkr, dmy, monthLabel } from "./format";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };
export type Range = { from: string; to: string };
type CategoryRow = { category: string; total: number; purchase: number; procurement: number; lines: number };
type VehicleRow = { id: number; vehicleNo: string; vehicleName: string; driver: string; destination: string; at: string; since: string };
export interface DashData {
  expRange: Range; attRange: Range; receivedOnly: boolean; today: string;
  exp: Loaded<{ total: number; purchase: number; procurement: number; earlierPos: number; skipped: number; categories: CategoryRow[] }>;
  cnic: Loaded<CnicAlert[]>;
  late: Loaded<LateComer[]>;
  lateToday: Loaded<LateComer[]>;
  off: Loaded<DaysOff[]>;
  people: Loaded<(OutNow & { at: string; since: string })[]>;
  vehicles: Loaded<VehicleRow[]>;
  cards: Loaded<CardOut[]>;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export default function DashboardView({ data }: { data: DashData }) {
  const { expRange: er, attRange: ar, receivedOnly, today, exp, cnic, late, lateToday, off, people, vehicles, cards } = data;
  // Each band's period is kept in the address under its own names, next to the other band's.
  const recv: Record<string, string> = receivedOnly ? { erecv: "1" } : {};
  const expKeep = { afrom: ar.from, ato: ar.to, ...recv }, attKeep = { efrom: er.from, eto: er.to, ...recv };
  const router = useRouter(), pathname = usePathname();
  const toggleReceived = () => {
    const q = new URLSearchParams({ efrom: er.from, eto: er.to, afrom: ar.from, ato: ar.to });
    if (!receivedOnly) q.set("erecv", "1");
    router.push(`${pathname}?${q}`, { scroll: false });
  };
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const expLink = `/dashboard/expenses?from=${er.from}&to=${er.to}${receivedOnly ? "&recv=1" : ""}`;
  const details: Record<string, { fam: string; label: string; body: () => ReactNode }> = {};
  const tile = (key: string, fam: string, label: string, l: Loaded<unknown>, value: (d: any) => ReactNode, sub: (d: any) => ReactNode, more?: (d: any) => ReactNode, wide?: boolean) => {
    if (l.ok && more) details[key] = { fam, label, body: () => more(l.data) };
    return (
      <div key={key} className={`od-tile od-${fam}${wide ? " od-wide" : ""}`}>
        <div className="od-label">{label}</div>
        <div className="od-value">{l.ok ? value(l.data) : "—"}</div>
        <div className="od-sub">{l.ok ? sub(l.data) : "Could not load"}</div>
        {l.ok && more && <div className="od-foot"><button type="button" className="od-more" onClick={() => setOpen(key)}>See more ›</button></div>}
      </div>
    );
  };
  const catList = (rows: CategoryRow[], pick: (c: CategoryRow) => number, empty: string) => {
    const r = rows.filter(c => pick(c) !== 0).sort((a, b) => pick(b) - pick(a));
    return r.length ? <List>{r.map(c => <Row key={c.category} left={c.category} right={pkr(pick(c))} />)}</List> : <div className="od-sub">{empty}</div>;
  };
  const expMore = (key: "total" | "purchase" | "procurement") => (d: Extract<DashData["exp"], { ok: true }>["data"]) => (
    <>
      {key !== "purchase" && d.procurement > 0 && (
        <div className="od-sub od-split">
          Procurement counts goods by the day they arrived (GRR date). Of {pkr(d.procurement)}: <b>{pkr(d.procurement - d.earlierPos)}</b> against POs placed in this period,
          {" "}<b>{pkr(d.earlierPos)}</b> against POs placed before it. The Supplier Directory counts POs by the day they were placed, whether the goods have arrived or not.
        </div>
      )}
      {catList(d.categories, c => c[key], "No expense in this period")}
      {d.skipped > 0 && <div className="od-sub od-note">{plural(d.skipped, "line")} could not be counted (no value, no PO rate…) — listed on the full page.</div>}
      <Link href={expLink} className="od-poplink">Full detail by category, every line ›</Link>
    </>
  );
  const emp = (id: number, name: string, code: string) => <><Link href={`/employees/${id}`}>{name}</Link> <span className="od-dim">{code}</span></>;
  const expired = cnic.ok ? cnic.data.filter(c => c.daysLeft < 0).length : 0;

  // Read once the tiles above have been laid out, since laying them out is what fills `details`.
  const popUp = () => {
    const pop = open ? details[open] : null;
    return pop && (
      <div className="od-pop-bg" onClick={e => { if (e.target === e.currentTarget) setOpen(null); }}>
        <div className={`od-pop od-${pop.fam}`} role="dialog" aria-label={pop.label}>
          <div className="od-pop-top"><b>{pop.label}</b><button type="button" className="od-pop-x" onClick={() => setOpen(null)} title="Close">✕</button></div>
          <div className="od-pop-body">{pop.body()}</div>
        </div>
      </div>
    );
  };
  return (
    <div className="fade-up od">
      <div className="od-zones">
      <div className="od-zone od-zone-1">
        <div className="od-sec">Expense</div>
        <div className="od-bar-row">
          <RangePicker from={er.from} to={er.to} today={today} fromKey="efrom" toKey="eto" keep={expKeep} />
          <button type="button" className={`od-recv${receivedOnly ? " on" : ""}`} onClick={toggleReceived} aria-pressed={receivedOnly}
            title={receivedOnly ? "Showing only what is complete — tap to show everything that arrived, part deliveries too"
              : "Show only requisitions marked received and PO lines received in full"}>{receivedOnly ? "✓ " : ""}Received only</button>
        </div>
        <div className="od-grid">
          {tile("exp-total", "money", "Total expense", exp, d => `PKR ${pkr(d.total)}`,
            d => <>{receivedOnly ? "Received in full only" : "Purchase + Procurement"}{d.skipped > 0 && <> · <b className="od-warn-text">{d.skipped} not counted</b></>}</>, expMore("total"), true)}
          {tile("exp-purchase", "purchase", "Purchase", exp, d => pkr(d.purchase), () => (receivedOnly ? "marked received" : "requisitions"), expMore("purchase"))}
          {tile("exp-proc", "proc", "Procurement", exp, d => pkr(d.procurement), d => (receivedOnly ? "PO lines received in full" : "") + (d.earlierPos > 0 ? `${receivedOnly ? " · " : "received · "}${pkr(d.earlierPos)} on earlier POs` : receivedOnly ? "" : "received on GRRs"), expMore("procurement"))}
        </div>
      </div>

      <div className="od-zone od-zone-2">
        <div className="od-sec">Attendance <small>· Late today and CNIC are as of today</small></div>
        <RangePicker from={ar.from} to={ar.to} today={today} fromKey="afrom" toKey="ato" keep={attKeep} />
        <div className="od-grid">
          {tile("late", "late", "Late comers", late, d => d.length, d => `${plural(d.reduce((t: number, r: LateComer) => t + r.days, 0), "late day")}`, (d: LateComer[]) => (
            <><div className="od-sub">Checked in after 08:10 — most late days first.</div>
              {d.length ? <List>{d.map(r => <Row key={r.id} left={emp(r.id, r.name, r.empCode)} right={`${plural(r.days, "day")} · ${formatLate(r.minutes)}`} />)}</List> : <div className="od-sub">Nobody came late.</div>}</>
          ))}
          {tile("late-today", lateToday.ok && lateToday.data.length ? "late" : "calm", "Late today", lateToday, d => d.length, () => dmy(today), (d: LateComer[]) => (
            d.length ? <List>{[...d].sort((a, b) => b.minutes - a.minutes).map(r => <Row key={r.id} left={emp(r.id, r.name, r.empCode)} right={formatLate(r.minutes)} />)}</List> : <div className="od-sub">Nobody late today.</div>
          ))}
          {tile("off", off.ok && off.data.length ? "out" : "calm", "> 2 days off", off, d => d.length, () => "absent + leave, a month", (d: DaysOff[]) => (
            <><div className="od-sub">More than 2 days Absent or on Leave in one month. Holidays, week-offs and half-days are not counted.</div>
              {d.length ? <List>{d.map(r => <Row key={`${r.id}-${r.month}`} left={<>{emp(r.id, r.name, r.empCode)} <span className="od-dim">· {monthLabel(r.month)}</span></>} right={`${r.total} days (${[r.absent && `${r.absent} absent`, r.leave && `${r.leave} leave`].filter(Boolean).join(", ")})`} />)}</List> : <div className="od-sub">Nobody.</div>}</>
          ))}
          {tile("cnic", expired ? "out" : "cnic", "CNIC expiry", cnic, d => d.length, () => (expired ? `${expired} expired` : "within 90 days"), (d: CnicAlert[]) => (
            <><div className="od-sub">Active employees whose CNIC has expired or expires within 90 days.</div>
              {d.length ? <List>{d.map(r => <Row key={r.id} left={emp(r.id, r.name, r.empCode)}
                right={<span className={r.daysLeft <= 0 ? "od-red" : r.daysLeft <= 30 ? "od-amber" : ""}>{r.daysLeft < 0 ? `expired ${-r.daysLeft}d ago` : r.daysLeft === 0 ? "expires today" : `${r.daysLeft}d left`} · {dmy(r.expiry)}</span>} />)}</List> : <div className="od-sub">No CNIC expires in the next 90 days.</div>}</>
          ))}
        </div>
      </div>

      <div className="od-zone od-zone-3">
        <div className="od-sec">Outside <small>· right now</small></div>
        <div className="od-grid">
          {tile("people", "people", "Employees out", people, d => d.length, (d: (OutNow & { at: string; since: string })[]) => `${d.filter(r => r.type === "official").length} official · ${d.filter(r => r.type !== "official").length} personal`, (d: (OutNow & { at: string; since: string })[]) => (
            <>{d.length ? <List>{d.map(r => <Row key={r.id} left={<>{emp(r.employeeId, r.name, r.empCode)} <span className="od-dim">· {r.type === "official" ? "Official" : "Personal"}{r.reason ? ` · ${r.reason}` : ""}</span></>} right={`out ${r.at} · ${r.since}`} />)}</List> : <div className="od-sub">Everyone is inside.</div>}
              <Link href="/station/out" className="od-poplink">Who&apos;s Out ›</Link></>
          ))}
          {tile("vehicles", "vehicle", "Vehicles out", vehicles, d => d.length, () => "on a trip", (d: VehicleRow[]) => (
            <>{d.length ? <List>{d.map(r => <Row key={r.id} left={<>{r.vehicleNo}{r.vehicleName ? ` · ${r.vehicleName}` : ""} <span className="od-dim">· {[r.driver, r.destination].filter(Boolean).join(" · ")}</span></>} right={`out ${r.at} · ${r.since}`} />)}</List> : <div className="od-sub">All vehicles are in.</div>}
              <Link href="/station/out" className="od-poplink">Who&apos;s Out ›</Link></>
          ))}
          {tile("cards", "card", "PSO cards out", cards, d => d.length, () => "with a driver", (d: CardOut[]) => (
            <>{d.length ? <List>{d.map(r => <Row key={r.id} left={<>Card {r.sn} <span className="od-dim">· {r.holder}{r.vehicleNo ? ` · ${r.vehicleNo}` : ""}</span></>} right={r.since ? `since ${dmy(r.since)}${r.sinceTime ? " " + r.sinceTime : ""}` : ""} />)}</List> : <div className="od-sub">All cards are in the drawer.</div>}
              <Link href="/station/pso" className="od-poplink">PSO Cards ›</Link></>
          ))}
        </div>
      </div>

      </div>

      {popUp()}
    </div>
  );
}

function List({ children }: { children: ReactNode }) { return <div className="od-list">{children}</div>; }
function Row({ left, right }: { left: ReactNode; right: ReactNode }) { return <div><span>{left}</span><b>{right}</b></div>; }
