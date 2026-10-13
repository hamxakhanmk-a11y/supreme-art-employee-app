import { db } from "@/lib/db";
import { employees, vehicles } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { ensureFleetSchema } from "@/lib/fleet";
import { custodyOn, psoRegister } from "@/lib/fleetServer";
import { isViewOnly } from "@/lib/pageGuard";
import { getSession } from "@/lib/auth";
import { roleCanEdit } from "@/lib/permissions";
import PsoCardsClient from "./PsoCardsClient";
import { karachiNow } from "@/lib/gateTime";

export const dynamic = "force-dynamic";

type SP = { date?: string; from?: string; to?: string; tab?: string; by?: string; cards?: string; label?: string; back?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// PSO Cards, one tab with two views inside it: the Cards Logbook (who has a
// card now, and every fill drawn) and All cards (the list, to add and edit).
export default async function PsoCardsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await ensureFleetSchema();
  const sp = await searchParams;
  const today = karachiNow().date;   // UTC would still be yesterday until 5am
  const date = ISO.test(sp.date || "") ? sp.date! : today;
  const isToday = date === today;
  // The logbook's own range: this month so far, unless one was picked.
  const from = ISO.test(sp.from || "") ? sp.from! : `${today.slice(0, 8)}01`;
  const to = ISO.test(sp.to || "") ? sp.to! : today;
  const tab = sp.tab === "cards" ? "cards" : "logbook";
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
    custodyOn(date),
    psoRegister(from, to, focused ? { by: "entered", cardIds } : {}),
    getSession(),
  ]);

  const canDelete = user?.role === "superadmin" || (user ? await roleCanEdit(user.role, "station.delete") : false);

  return (
    <PsoCardsClient
      vehicles={vehicleList}
      people={people.map(p => ({ id: p.id, code: p.code, name: `${p.firstName} ${p.lastName}`.trim() }))}
      readOnly={await isViewOnly("station.cards")}
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
