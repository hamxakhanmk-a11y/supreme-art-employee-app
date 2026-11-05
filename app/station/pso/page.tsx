import { db } from "@/lib/db";
import { employees, vehicles } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { custodyOn, psoRegister } from "@/lib/fleetServer";
import { grantsOf } from "@/lib/pageGuard";
import { getSession } from "@/lib/auth";
import { roleCanEdit } from "@/lib/permissions";
import PsoCardsClient from "./PsoCardsClient";
import { karachiNow } from "@/lib/gateTime";

export const dynamic = "force-dynamic";

type SP = { date?: string; from?: string; to?: string; tab?: string; by?: string; cards?: string; label?: string; back?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// PSO Cards, one tab with three views inside it: the Cards Logbook (who has a
// card now, and every fill drawn), All cards (the list, to add and edit) and
// Top-ups (the money loaded on every card, and a button to load more).
export default async function PsoCardsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await ensureFleetSchema();
  const sp = await searchParams;
  const today = karachiNow().date;   // UTC would still be yesterday until 5am
  const date = ISO.test(sp.date || "") ? sp.date! : today;
  const isToday = date === today;
  // The logbook's own range: this month so far, unless one was picked.
  const from = ISO.test(sp.from || "") ? sp.from! : `${today.slice(0, 8)}01`;
  const to = ISO.test(sp.to || "") ? sp.to! : today;
  // Each view only for a role with its row (Station · PSO Cards · Cards Logbook / All cards / Top-ups).
  const g = await grantsOf();
  const tabs = { logbook: g.see("station.cards"), cards: g.see("station.cardlist"), topups: g.see("station.topups") };
  const asked = sp.tab === "cards" ? "cards" : sp.tab === "topups" ? "topups" : "logbook";
  const tab = tabs[asked] ? asked : tabs.logbook ? "logbook" : tabs.cards ? "cards" : "topups";
  // Opened from a Monthly Report consumption: the fills it counted for one
  // vehicle's card(s), placed by the day each was entered.
  const focused = sp.by === "entered";
  const cardIds = focused ? String(sp.cards || "").split(",").map(Number).filter(n => n > 0) : undefined;
  const focus = focused
    ? { label: String(sp.label || "").slice(0, 60) || "this card", back: /^\d{4}-\d{2}$/.test(sp.back || "") ? sp.back! : null }
    : null;

  const [vehicleList, people, custody, rows, user] = await Promise.all([
    db.select({ id: vehicles.id, vehicleNo: vehicles.vehicleNo, name: vehicles.name, active: vehicles.active })
      .from(vehicles).orderBy(asc(vehicles.vehicleNo)),
    db.select({
      id: employees.id, code: employees.employeeId,
      firstName: employees.firstName, lastName: employees.lastName,
    }).from(employees).where(eq(employees.status, "active")).orderBy(employees.firstName),
    // Who held what that day. On today this is the same set the cards
    // themselves report, but it carries the times and what was drawn.
    tabs.logbook ? custodyOn(date) : Promise.resolve([] as Awaited<ReturnType<typeof custodyOn>>),
    tabs.logbook ? psoRegister(from, to, focused ? { by: "entered", cardIds } : {}) : Promise.resolve([] as Awaited<ReturnType<typeof psoRegister>>),
    getSession(),
  ]);

  const canDelete = user?.role === "superadmin" || (user ? await roleCanEdit(user.role, "station.delete") : false);

  return (
    <PsoCardsClient
      vehicles={vehicleList}
      people={people.map(p => ({ id: p.id, code: p.code, name: `${p.firstName} ${p.lastName}`.trim() }))}
      readOnly={!g.edit("station.cards")}
      tabs={tabs}
      cardsReadOnly={!g.edit("station.cardlist")}
      topupsReadOnly={!g.edit("station.topups")}
      canDelete={canDelete}
      custody={custody}
      date={date}
      isToday={isToday}
      rows={rows}
      from={from}
      to={to}
      tab={tab}
      focus={focus}
    />
  );
}
