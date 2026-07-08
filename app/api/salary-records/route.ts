import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salaryRecords, employees } from "@/lib/schema";
import { and, eq, desc, asc, inArray } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import { guardWrite, getSession } from "@/lib/auth";
import { computeSlip, MONTHS, DEFAULT_MIN_WAGE_PKR, DEFAULT_ESSI_CONTRIBUTION } from "@/lib/salary";

// GET /api/salary-records?employeeId=1&month=June&year=2025
// All filters optional. employeeId scopes to one employee. month+year scopes to one period.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get("employeeId");
  const month = sp.get("month");
  const year = sp.get("year");

  try {
    const conds: any[] = [];
    if (employeeId) conds.push(eq(salaryRecords.employeeId, parseInt(employeeId)));
    if (month) conds.push(eq(salaryRecords.month, month));
    if (year) conds.push(eq(salaryRecords.year, parseInt(year)));

    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
    const rows = where
      ? await db.select().from(salaryRecords).where(where).orderBy(desc(salaryRecords.year), desc(salaryRecords.monthNum), asc(salaryRecords.employeeName))
      : await db.select().from(salaryRecords).orderBy(desc(salaryRecords.year), desc(salaryRecords.monthNum), asc(salaryRecords.employeeName));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/salary-records
// Body: either a single slip object OR { slips: [...] } for bulk.
// Each slip requires { employeeId, month, year }. The server snapshots employee structure
// (basic, conveyance, percentages) at generation time and recomputes all derived amounts.
export async function POST(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  const session = await getSession();
  const generatedBy = session ? `${session.name} <${session.email}>` : null;

  try {
    const body = await req.json();
    const slipsIn: any[] = Array.isArray(body?.slips) ? body.slips : [body];
    if (slipsIn.length === 0) return NextResponse.json({ error: "No slips provided" }, { status: 400 });

    // Bulk-load all employees touched
    const empIds = Array.from(new Set(slipsIn.map(s => Number(s.employeeId)).filter(Boolean)));
    if (empIds.length === 0) return NextResponse.json({ error: "employeeId is required on each slip" }, { status: 400 });
    const empRows = await db.select().from(employees).where(inArray(employees.id, empIds));
    const empById = new Map(empRows.map(e => [e.id, e]));

    const results: any[] = [];
    for (const s of slipsIn) {
      const empDbId = Number(s.employeeId);
      const emp = empById.get(empDbId);
      if (!emp) { results.push({ employeeId: empDbId, error: "Employee not found" }); continue; }
      const month = String(s.month || "");
      const year = Number(s.year);
      if (!month || !year) { results.push({ employeeId: empDbId, error: "month/year required" }); continue; }
      const monthNum = MONTHS.indexOf(month) + 1;

      const minWage = Number((emp as any).minimumWage ?? DEFAULT_MIN_WAGE_PKR) || DEFAULT_MIN_WAGE_PKR;
      const essi = Number((emp as any).essiContribution ?? DEFAULT_ESSI_CONTRIBUTION);
      const inputs = {
        basicSalary: Number(emp.basicSalary || 0),
        conveyance: Number(emp.conveyance || 0),
        minimumWage: minWage,
        incomeTaxPercent: Number(emp.incomeTaxPercent || 0),
        incomeTaxAmount: Number((emp as any).incomeTaxAmount || 0),
        eobiEmployeePercent: Number(emp.eobiEmployeePercent || 0),
        eobiEmployeeAmount: Number((emp as any).eobiEmployeeAmount || 0),
        eobiEmployerAmount: Number((emp as any).eobiEmployerAmount || 0),
        essiContribution: essi,
        accommodation: Number(emp.accommodation || 0),
        food: Number(emp.food || 0),
        overtime: Number(s.overtime || 0),
        otherDeduction: Number(s.otherDeduction || 0),
        daysPresent: Number(s.daysPresent || 0),
        daysAbsent: Number(s.daysAbsent || 0),
        daysLeave: Number(s.daysLeave || 0),
      };
      const c = computeSlip(inputs);

      const values = {
        employeeId: empDbId,
        month, monthNum, year,
        employeeCode: emp.employeeId,
        employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
        designation: emp.designation || null,
        department: emp.department || null,
        basicSalary: inputs.basicSalary,
        conveyance: inputs.conveyance,
        houseRentPercent: 0,
        medicalPercent: 0,
        incomeTaxPercent: inputs.incomeTaxPercent,
        incomeTaxAmount: inputs.incomeTaxAmount,
        eobiEmployeePercent: inputs.eobiEmployeePercent,
        eobiEmployeeAmount: inputs.eobiEmployeeAmount,
        eobiEmployerPercent: 0,
        eobiEmployerAmount: inputs.eobiEmployerAmount,
        minimumWage: minWage,
        overtime: inputs.overtime,
        otherDeduction: inputs.otherDeduction,
        daysPresent: inputs.daysPresent,
        daysAbsent: inputs.daysAbsent,
        daysLeave: inputs.daysLeave,
        weekOffs: Number(s.weekOffs || 0),
        houseRent: 0,
        medical: 0,
        grossEarnings: c.grossEarnings,
        incomeTax: c.incomeTax,
        eobiEmployee: c.eobiEmployee,
        eobiEmployer: 0,
        absentDeduction: c.absentDeduction,
        totalDeductions: c.totalDeductions,
        netPay: c.netPay,
        accommodation: c.accommodation,
        food: c.food,
        essiContribution: c.essiContribution,
        eobiEmployerContribution: c.eobiEmployerContribution,
        totalNotDeducted: c.totalNotDeducted,
        notes: s.notes || null,
        generatedBy,
      };

      // Upsert by (employee, month, year)
      const existing = await db.select({ id: salaryRecords.id }).from(salaryRecords)
        .where(and(eq(salaryRecords.employeeId, empDbId), eq(salaryRecords.month, month), eq(salaryRecords.year, year)));
      if (existing.length > 0) {
        const [r] = await db.update(salaryRecords).set(values).where(eq(salaryRecords.id, existing[0].id)).returning();
        results.push(r);
      } else {
        const [r] = await db.insert(salaryRecords).values(values).returning();
        results.push(r);
      }
    }

    const ok = results.filter((r: any) => !r.error);
    if (ok.length) {
      const period = `${String(slipsIn[0]?.month || "")} ${slipsIn[0]?.year || ""}`.trim();
      await logActivity({
        user: guard, action: "salary.generate",
        employeeId: ok.length === 1 ? ok[0].employeeId : null,
        employeeName: ok.length === 1 ? ok[0].employeeName : null,
        summary: ok.length === 1
          ? `salary slip generated for ${period}`
          : `generated ${ok.length} salary slips for ${period}`,
      });
    }
    if (results.length === 1) return NextResponse.json(results[0], { status: 201 });
    return NextResponse.json({ slips: results }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/salary-records?id=1
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await db.delete(salaryRecords).where(eq(salaryRecords.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
