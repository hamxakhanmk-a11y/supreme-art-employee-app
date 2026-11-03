// What the Super Admin's dashboard reads. Server only. Each loader stands alone, so one
// that fails leaves the rest of the dashboard working.
import { sql, and, gte, lte, inArray, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { employees, attendance, purchaseRequisitions, purchaseOrders, grns } from "./schema";
import { ensureProcurementTables, loadChecklist } from "./procurement";
import { ensureFleetSchema } from "./fleet";
import { lateMinutes } from "./attendance";
import { karachiNow } from "./gateTime";
import { summarizeExpenses, type ExpenseSummary } from "./expenses";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The range asked for in the address, else this month so far (Karachi time). A reversed range is put right.
export function dashboardRange(sp: { from?: string; to?: string }): { from: string; to: string; today: string } {
  const today = karachiNow().date;
  let from = DATE_RE.test(sp.from || "") ? sp.from! : today.slice(0, 8) + "01";
  let to = DATE_RE.test(sp.to || "") ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  return { from, to, today };
}

export async function loadExpenses(from: string, to: string): Promise<ExpenseSummary> {
  await ensureProcurementTables();
  const [prs, grnRows, checklist] = await Promise.all([
    db.select({
      id: purchaseRequisitions.id, prNo: purchaseRequisitions.prNo, date: purchaseRequisitions.date,
      category: purchaseRequisitions.category, items: purchaseRequisitions.items,
      itemName: purchaseRequisitions.itemName, quantity: purchaseRequisitions.quantity, uom: purchaseRequisitions.uom,
      value: purchaseRequisitions.value, hodApproval: purchaseRequisitions.hodApproval, hrApproval: purchaseRequisitions.hrApproval,
    }).from(purchaseRequisitions),
    db.select({
      id: grns.id, grnNo: grns.grnNo, registered: grns.registered, date: grns.date, poId: grns.poId, poNo: grns.poNo,
      items: grns.items, inspection: grns.inspection,
    }).from(grns).where(and(gte(grns.date, from), lte(grns.date, to))),
    loadChecklist(),
  ]);
  const poIds = [...new Set(grnRows.map(g => g.poId).filter((x): x is number => x != null))];
  const poNos = [...new Set(grnRows.filter(g => g.poId == null).map(g => g.poNo).filter((x): x is number => x != null))];
  const poCols = { id: purchaseOrders.id, poNo: purchaseOrders.poNo, registered: purchaseOrders.registered, items: purchaseOrders.items, discount: purchaseOrders.discount };
  const [byId, byNo] = await Promise.all([
    poIds.length ? db.select(poCols).from(purchaseOrders).where(inArray(purchaseOrders.id, poIds)) : Promise.resolve([]),
    poNos.length ? db.select(poCols).from(purchaseOrders).where(inArray(purchaseOrders.poNo, poNos)) : Promise.resolve([]),
  ]);
  const pos = [...new Map([...byId, ...byNo].map(p => [p.id, p])).values()];
  return summarizeExpenses({ prs, grns: grnRows, pos, checklist }, from, to);
}

export interface CnicAlert { id: number; empCode: string; name: string; designation: string | null; expiry: string; daysLeft: number }

// Active employees whose CNIC has expired or expires within 90 days, soonest first.
export async function cnicAlerts(today: string): Promise<CnicAlert[]> {
  const rows = await db.select({
    id: employees.id, empCode: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName,
    designation: employees.designation, status: employees.status, cnicExpiry: employees.cnicExpiry,
  }).from(employees).where(isNotNull(employees.cnicExpiry));
  const t0 = Date.parse(today + "T00:00:00Z");
  const out: CnicAlert[] = [];
  for (const r of rows) {
    if (r.status !== "active" || !r.cnicExpiry) continue;
    const expiry = String(r.cnicExpiry).slice(0, 10);
    const daysLeft = Math.round((Date.parse(expiry + "T00:00:00Z") - t0) / 86400000);
    if (Number.isNaN(daysLeft) || daysLeft > 90) continue;
    out.push({ id: r.id, empCode: r.empCode, name: `${r.firstName} ${r.lastName}`.trim(), designation: r.designation, expiry, daysLeft });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface LateComer { id: number; empCode: string; name: string; department: string | null; days: number; minutes: number; lateToday: number }

// Everyone who checked in after 08:10 in the range (the register's rule), most late days first.
export async function lateComers(from: string, to: string, today: string): Promise<LateComer[]> {
  const rows = await db.select({
    employeeId: attendance.employeeId, date: attendance.date, checkIn: attendance.checkIn,
    empCode: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: employees.department,
  }).from(attendance)
    .innerJoin(employees, sql`${employees.id} = ${attendance.employeeId}`)
    .where(and(gte(attendance.date, from), lte(attendance.date, to), isNotNull(attendance.checkIn)));
  const map = new Map<number, LateComer>();
  for (const r of rows) {
    const late = lateMinutes(r.checkIn);
    if (late <= 0) continue;
    let e = map.get(r.employeeId);
    if (!e) { e = { id: r.employeeId, empCode: r.empCode, name: `${r.firstName} ${r.lastName}`.trim(), department: r.department, days: 0, minutes: 0, lateToday: 0 }; map.set(r.employeeId, e); }
    e.days++; e.minutes += late;
    if (String(r.date).slice(0, 10) === today) e.lateToday = late;
  }
  return [...map.values()].sort((a, b) => b.days - a.days || b.minutes - a.minutes);
}

export interface DaysOff { id: number; empCode: string; name: string; department: string | null; month: string; absent: number; leave: number; total: number }

// Per calendar month in the range: employees with more than 2 days marked Absent or Leave.
// Holidays and week-offs are the factory's days off, not the employee's, and a half-day is a day present.
export async function daysOffOver2(from: string, to: string): Promise<DaysOff[]> {
  const rows = await db.select({
    employeeId: attendance.employeeId, date: attendance.date, status: attendance.status,
    empCode: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: employees.department,
  }).from(attendance)
    .innerJoin(employees, sql`${employees.id} = ${attendance.employeeId}`)
    .where(and(gte(attendance.date, from), lte(attendance.date, to), inArray(attendance.status, ["absent", "leave"])));
  const map = new Map<string, DaysOff>();
  for (const r of rows) {
    const month = String(r.date).slice(0, 7);
    const k = `${r.employeeId}|${month}`;
    let e = map.get(k);
    if (!e) { e = { id: r.employeeId, empCode: r.empCode, name: `${r.firstName} ${r.lastName}`.trim(), department: r.department, month, absent: 0, leave: 0, total: 0 }; map.set(k, e); }
    if (r.status === "absent") e.absent++; else e.leave++;
    e.total++;
  }
  return [...map.values()].filter(e => e.total > 2).sort((a, b) => b.month.localeCompare(a.month) || b.total - a.total);
}

export interface CardOut { id: number; sn: string; vehicleNo: string | null; holder: string; since: string; sinceTime: string }

// PSO cards in someone's hands right now: the holder is kept on the card itself.
export async function cardsOut(): Promise<CardOut[]> {
  await ensureFleetSchema();
  const res = await db.execute(sql`
    SELECT c.id, c.sn, v.vehicle_no AS "vehicleNo", c.held_by_name AS holder,
           COALESCE(s.taken_date::text, c.held_since::text, '') AS since,
           COALESCE(s.taken_time, '') AS "sinceTime"
    FROM pso_cards c
    LEFT JOIN vehicles v ON v.id = c.vehicle_id
    LEFT JOIN pso_card_custody s ON s.card_id = c.id AND s.returned_date IS NULL
    WHERE c.held_by_name IS NOT NULL AND TRIM(c.held_by_name) <> ''
    ORDER BY since, c.sn
  `);
  const rows: any[] = (res as any).rows ?? (res as any);
  return rows.map(r => ({ id: Number(r.id), sn: r.sn, vehicleNo: r.vehicleNo ?? null, holder: r.holder, since: r.since, sinceTime: r.sinceTime }));
}
