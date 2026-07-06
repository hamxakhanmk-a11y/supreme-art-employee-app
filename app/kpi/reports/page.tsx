import { db } from "@/lib/db";
import { employees, kpiValues, kpiTargets } from "@/lib/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDesignation, byDepartment } from "@/lib/kpi/catalog";
import { computeEmployeeYear, mean } from "@/lib/kpi/report";
import ReportsClient, { type EmpSummary } from "./ReportsClient";

export const dynamic = "force-dynamic";

type SP = { year?: string };

export default async function KpiReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.year || String(now.getFullYear()));

  const [emps, values, targets] = await Promise.all([
    db.select({
      id: employees.id,
      employeeId: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      kpiTemplate: employees.kpiTemplate,
    }).from(employees).where(and(eq(employees.status, "active"), isNotNull(employees.kpiTemplate))),
    db.select({
      employeeId: kpiValues.employeeId, month: kpiValues.month,
      kpiIdx: kpiValues.kpiIdx, inputKey: kpiValues.inputKey, value: kpiValues.value,
    }).from(kpiValues).where(eq(kpiValues.year, year)),
    db.select({
      employeeId: kpiTargets.employeeId, kpiIdx: kpiTargets.kpiIdx, target: kpiTargets.target,
    }).from(kpiTargets).where(eq(kpiTargets.year, year)),
  ]);

  const valsByEmp = new Map<number, typeof values>();
  for (const v of values) { if (!valsByEmp.has(v.employeeId)) valsByEmp.set(v.employeeId, []); valsByEmp.get(v.employeeId)!.push(v); }
  const tgtByEmp = new Map<number, typeof targets>();
  for (const t of targets) { if (!tgtByEmp.has(t.employeeId)) tgtByEmp.set(t.employeeId, []); tgtByEmp.get(t.employeeId)!.push(t); }

  const summaries: EmpSummary[] = emps.map(e => {
    const res = computeEmployeeYear(e.kpiTemplate!, valsByEmp.get(e.id) ?? [], tgtByEmp.get(e.id) ?? []);
    const tpl = getDesignation(e.kpiTemplate!);
    return {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      employeeId: e.employeeId,
      templateCode: e.kpiTemplate!,
      templateTitle: tpl?.title ?? e.kpiTemplate!,
      department: tpl?.department ?? "—",
      kpiCount: tpl?.kpis.length ?? 0,
      overall: res?.overall ?? null,
      ragCounts: res?.ragCounts ?? { green: 0, amber: 0, red: 0, na: 0 },
      hasData: (valsByEmp.get(e.id)?.length ?? 0) > 0,
    };
  });

  // Rollups: department -> designation -> employees, in catalog order.
  const deptOrder = byDepartment();
  const departments = deptOrder.map(g => {
    const desigs = g.designations.map(d => {
      const rows = summaries.filter(s => s.templateCode === d.code);
      return { code: d.code, title: d.title, employees: rows, avg: mean(rows.map(r => r.overall)) };
    }).filter(d => d.employees.length > 0);
    const allRows = desigs.flatMap(d => d.employees);
    return { department: g.department, designations: desigs, avg: mean(allRows.map(r => r.overall)), count: allRows.length };
  }).filter(d => d.designations.length > 0);

  const companyAvg = mean(summaries.map(s => s.overall));
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <ReportsClient
      year={year} years={years}
      departments={departments}
      companyAvg={companyAvg}
      empty={emps.length === 0}
    />
  );
}
