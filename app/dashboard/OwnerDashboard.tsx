// The Super Admin's dashboard: spending for a period, plus the things to keep an eye on
// (CNIC expiry, late comers, days off) and who and what is outside the factory right now.
// Everyone else keeps the Profile dashboard in app/page.tsx.
import Link from "next/link";
import { currentlyOut, type OutNow } from "@/lib/stationServer";
import { vehiclesOut } from "@/lib/fleetServer";
import { loadExpenses, cnicAlerts, lateComers, daysOffOver2, cardsOut, type CnicAlert, type LateComer, type DaysOff, type CardOut } from "@/lib/ownerDashboard";
import { formatLate } from "@/lib/attendance";
import { formatMins } from "@/lib/station";
import RangePicker from "./RangePicker";
import { pkr, dmy, monthLabel, rangeLabel } from "./format";

type VehicleOut = Awaited<ReturnType<typeof vehiclesOut>>[number];

// The server runs on UTC; the gate keeps Karachi time.
const karachiTime = (isoStr: string) =>
  new Date(isoStr).toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit", hour12: true });
const minsSince = (isoStr: string) => Math.max(0, Math.round((Date.now() - new Date(isoStr).getTime()) / 60000));

type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };
async function settle<T>(p: Promise<T>): Promise<Loaded<T>> {
  try { return { ok: true, data: await p }; }
  catch (e: any) { console.warn("Dashboard section failed:", e?.message); return { ok: false, error: e?.message || "Could not load" }; }
}

export default async function OwnerDashboard({ from, to, today }: { from: string; to: string; today: string }) {
  const [exp, cnic, late, off, people, vehicles, cards] = await Promise.all([
    settle(loadExpenses(from, to)),
    settle(cnicAlerts(today)),
    settle(lateComers(from, to, today)),
    settle(daysOffOver2(from, to)),
    settle(currentlyOut()),
    settle(vehiclesOut()),
    settle(cardsOut()),
  ]);
  const period = rangeLabel(from, to);
  const count = <T,>(l: Loaded<T[]>) => (l.ok ? String(l.data.length) : "—");
  const expired = cnic.ok ? cnic.data.filter(c => c.daysLeft < 0).length : 0;

  return (
    <div className="fade-up od">
      <RangePicker from={from} to={to} today={today} />

      <div className="od-tiles">
        <Link href={`/dashboard/expenses?from=${from}&to=${to}`} className="od-tile od-tile-money">
          <div className="od-tile-label">Total Expense <span className="od-tile-more">By category ›</span></div>
          <div className="od-tile-value">{exp.ok ? `PKR ${pkr(exp.data.total)}` : "—"}</div>
          <div className="od-tile-sub">
            {exp.ok
              ? <>Purchase {pkr(exp.data.purchase)} · Procurement {pkr(exp.data.procurement)}{exp.data.skipped.length > 0 && <> · <b>{exp.data.skipped.length} not counted</b></>}</>
              : "Could not load"}
          </div>
          <div className="od-tile-period">{period}</div>
        </Link>
        <Tile href="#cnic" label="CNIC Expiry" value={count(cnic)} sub={cnic.ok ? (expired ? `${expired} expired` : "within 90 days") : "Could not load"} warn={expired > 0} />
        <Tile href="#late" label="Late Comers" value={count(late)}
          sub={late.ok ? `${late.data.filter(l => l.lateToday > 0).length} late today` : "Could not load"} period={period} />
        <Tile href="#off" label="> 2 Days Off" value={count(off)} sub="absent + leave, per month" period={period} warn={off.ok && off.data.length > 0} />
        <Tile href="#people" label="Employees Out" value={count(people)} sub="right now" />
        <Tile href="#vehicles" label="Vehicles Out" value={count(vehicles)} sub="right now" />
        <Tile href="#cards" label="PSO Cards Out" value={count(cards)} sub="right now" />
      </div>

      <div className="od-grid">
        <Section id="people" title="Employees out" n={people} link="/station/out" empty="Everyone is inside.">
          {(rows: OutNow[]) => rows.map(r => (
            <Row key={r.id} href={`/employees/${r.employeeId}`} title={r.name} meta={`${r.empCode}${r.department ? " · " + r.department : ""}${r.reason ? " · " + r.reason : ""}`}
              badge={r.type === "official" ? "Official" : "Personal"} badgeTone={r.type === "official" ? "info" : "purple"}
              right={`${karachiTime(r.outAt)} · ${formatMins(minsSince(r.outAt))}`} />
          ))}
        </Section>

        <Section id="vehicles" title="Vehicles out" n={vehicles} link="/station/out" empty="All vehicles are in.">
          {(rows: VehicleOut[]) => rows.map(r => (
            <Row key={r.id} title={`${r.vehicleNo}${r.vehicleName ? " · " + r.vehicleName : ""}`}
              meta={[r.driver, r.destination].filter(Boolean).join(" · ")}
              right={`${karachiTime(r.outAt)} · ${formatMins(minsSince(r.outAt))}`} />
          ))}
        </Section>

        <Section id="cards" title="PSO cards out" n={cards} link="/station/pso" empty="All cards are in the drawer.">
          {(rows: CardOut[]) => rows.map(r => (
            <Row key={r.id} title={`Card ${r.sn}`} meta={`${r.holder}${r.vehicleNo ? " · " + r.vehicleNo : ""}`}
              right={r.since ? `since ${dmy(r.since)}${r.sinceTime ? " " + r.sinceTime : ""}` : ""} />
          ))}
        </Section>

        <Section id="cnic" title="CNIC expiry" sub="Active employees, expired or within 90 days" n={cnic} link="/employees" empty="No CNIC expires in the next 90 days.">
          {(rows: CnicAlert[]) => rows.map(r => (
            <Row key={r.id} href={`/employees/${r.id}`} title={r.name} meta={`${r.empCode}${r.designation ? " · " + r.designation : ""} · ${dmy(r.expiry)}`}
              badge={r.daysLeft < 0 ? `Expired ${-r.daysLeft}d ago` : r.daysLeft === 0 ? "Expires today" : `${r.daysLeft}d left`}
              badgeTone={r.daysLeft <= 0 ? "danger" : r.daysLeft <= 30 ? "warn" : "ok"} />
          ))}
        </Section>

        <Section id="late" title="Late comers" sub={`Checked in after 08:10 · ${period}`} n={late} link={`/attendance/history`} empty="Nobody came late in this period.">
          {(rows: LateComer[]) => rows.map(r => (
            <Row key={r.id} href={`/employees/${r.id}`} title={r.name} meta={`${r.empCode}${r.department ? " · " + r.department : ""}${r.lateToday ? ` · today ${formatLate(r.lateToday)}` : ""}`}
              badge={`${r.days} day${r.days === 1 ? "" : "s"}`} badgeTone={r.days >= 5 ? "danger" : "warn"} right={formatLate(r.minutes)} />
          ))}
        </Section>

        <Section id="off" title="More than 2 days off in a month" sub={`Absent + leave · ${period}`} n={off} link="/reports/attendance" empty="Nobody was off more than 2 days in a month.">
          {(rows: DaysOff[]) => rows.map(r => (
            <Row key={`${r.id}-${r.month}`} href={`/employees/${r.id}`} title={r.name}
              meta={`${r.empCode}${r.department ? " · " + r.department : ""} · ${monthLabel(r.month)}`}
              badge={`${r.total} days`} badgeTone="danger"
              right={[r.absent && `${r.absent} absent`, r.leave && `${r.leave} leave`].filter(Boolean).join(" · ")} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Tile({ href, label, value, sub, period, warn }: { href: string; label: string; value: string; sub: string; period?: string; warn?: boolean }) {
  return (
    <a href={href} className={`od-tile ${warn ? "od-tile-warn" : ""}`}>
      <div className="od-tile-label">{label}</div>
      <div className="od-tile-value">{value}</div>
      <div className="od-tile-sub">{sub}</div>
      {period && <div className="od-tile-period">{period}</div>}
    </a>
  );
}

function Section<T>({ id, title, sub, n, link, empty, children }: {
  id: string; title: string; sub?: string; n: Loaded<T[]>; link: string; empty: string; children: (rows: T[]) => React.ReactNode;
}) {
  return (
    <section id={id} className="card od-section">
      <div className="od-section-head">
        <div>
          <div className="od-section-title">{title} {n.ok && <span className="od-count">{n.data.length}</span>}</div>
          {sub && <div className="od-section-sub">{sub}</div>}
        </div>
        <Link href={link} className="od-open">Open ›</Link>
      </div>
      {!n.ok ? <div className="od-empty od-error">Could not load: {n.error}</div>
        : n.data.length === 0 ? <div className="od-empty">✓ {empty}</div>
        : <div className="od-list">{children(n.data)}</div>}
    </section>
  );
}

type Tone = "danger" | "warn" | "ok" | "info" | "purple";
function Row({ href, title, meta, badge, badgeTone = "warn", right }: { href?: string; title: string; meta?: string; badge?: string; badgeTone?: Tone; right?: string }) {
  const body = (
    <>
      <div className="od-row-main">
        <div className="od-row-title">{title}</div>
        {meta && <div className="od-row-meta">{meta}</div>}
      </div>
      <div className="od-row-side">
        {badge && <span className={`od-badge od-${badgeTone}`}>{badge}</span>}
        {right && <span className="od-row-right">{right}</span>}
      </div>
    </>
  );
  return href ? <Link href={href} className="od-row">{body}</Link> : <div className="od-row">{body}</div>;
}
