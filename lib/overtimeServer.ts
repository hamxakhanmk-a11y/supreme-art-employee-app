import { db } from "@/lib/db";
import { overtime } from "@/lib/schema";
import { and, gte, lte, eq, sql } from "drizzle-orm";

// Self-provision the overtime table (same pattern as the procurement/station
// tables) so production migrates on first use without a manual step.
let ensured = false;
export async function ensureOvertimeTable() {
  if (ensured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS overtime (
      id serial PRIMARY KEY,
      employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      date date NOT NULL,
      hours double precision NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE(employee_id, date)
    )
  `);
  ensured = true;
}

export interface OvertimeRow { employeeId: number; date: string; hours: number }

// All overtime rows within a date range (inclusive), for the monthly grid.
export async function overtimeInRange(fromISO: string, toISO: string): Promise<OvertimeRow[]> {
  await ensureOvertimeTable();
  const rows = await db.select({ employeeId: overtime.employeeId, date: overtime.date, hours: overtime.hours })
    .from(overtime)
    .where(and(gte(overtime.date, fromISO), lte(overtime.date, toISO)));
  return rows.map(r => ({ employeeId: r.employeeId, date: r.date, hours: r.hours ?? 0 }));
}

// The overtime recorded for one date, as { employeeId: hours }.
export async function overtimeForDate(dateISO: string): Promise<Record<number, number>> {
  await ensureOvertimeTable();
  const rows = await db.select({ employeeId: overtime.employeeId, hours: overtime.hours })
    .from(overtime).where(eq(overtime.date, dateISO));
  const out: Record<number, number> = {};
  for (const r of rows) out[r.employeeId] = r.hours ?? 0;
  return out;
}
