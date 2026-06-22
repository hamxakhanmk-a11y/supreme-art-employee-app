import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salaryRecords } from "@/lib/schema";
import { and, eq, desc } from "drizzle-orm";

// GET /api/salary-records?employeeId=1
export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  try {
    const rows = await db.select().from(salaryRecords)
      .where(eq(salaryRecords.employeeId, parseInt(employeeId)))
      .orderBy(desc(salaryRecords.year), desc(salaryRecords.id));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/salary-records  — upsert by employeeId + month + year
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, month, year } = body;
    if (!employeeId || !month || !year) return NextResponse.json({ error: "employeeId, month, year required" }, { status: 400 });

    const existing = await db.select().from(salaryRecords)
      .where(and(eq(salaryRecords.employeeId, employeeId), eq(salaryRecords.month, month), eq(salaryRecords.year, year)));

    const values = {
      employeeId,
      month,
      year,
      basicSalary: body.basicSalary ?? 0,
      conveyance: body.conveyance ?? 6000,
      overtime: body.overtime ?? 0,
      daysPresent: body.daysPresent ?? 0,
      daysAbsent: body.daysAbsent ?? 0,
      daysLeave: body.daysLeave ?? 0,
      weekOffs: body.weekOffs ?? 0,
      otherDeduction: body.otherDeduction ?? 0,
      notes: body.notes || null,
    };

    if (existing.length > 0) {
      await db.update(salaryRecords).set(values).where(eq(salaryRecords.id, existing[0].id));
      return NextResponse.json({ id: existing[0].id });
    } else {
      const [row] = await db.insert(salaryRecords).values(values).returning();
      return NextResponse.json({ id: row.id });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/salary-records?id=1
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await db.delete(salaryRecords).where(eq(salaryRecords.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
