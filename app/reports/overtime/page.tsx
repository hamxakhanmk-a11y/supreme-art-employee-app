import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { requireModule } from "@/lib/pageGuard";
import { overtimeInRange } from "@/lib/overtimeServer";
import OvertimeReportClient from "./OvertimeReportClient";

export const dynamic = "force-dynamic";

type SP = { year?: string; month?: string };

export default async function OvertimeReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireModule("reports.attendance");
  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year || String(now.getFullYear()));
  const month = parseInt(sp.month || String(now.getMonth() + 1));

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const firstISO = first.toISOString().slice(0, 10);
  const lastISO = last.toISOString().slice(0, 10);
  const daysInMonth = last.getDate();

  const [emps, records] = await Promise.all([
    db.select({
      id: employees.id,
      employeeId: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      department: employees.department,
      status: employees.status,
      createdAt: employees.createdAt,
    }).from(employees).orderBy(employees.employeeId),
    overtimeInRange(firstISO, lastISO),
  ]);

  return (
    <OvertimeReportClient
      year={year}
      month={month}
      daysInMonth={daysInMonth}
      employees={emps}
      records={records}
    />
  );
}
