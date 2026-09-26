import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";
import { guardAuth } from "@/lib/auth";

// GET /api/store/employees → [{ code: "SAPL-6", name: "Aamir Khan", department }]
//
// Who stock can be issued to, read live from the Employees module so the
// picker follows hiring and exits on its own rather than from a list copied
// into the store. Only active staff: someone who has left shouldn't be
// offered, though issuances already recorded against them keep their name,
// since "Issued To" is stored as plain text on the transaction.
//
// Deliberately only the id, name and department — the store has no business
// seeing CNICs, salaries or the rest of an employee record, and every signed-in
// store user can read this (guardAuth, like the other store lists) without
// needing access to the Employees module itself.
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const rows = await db.select({
      code: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      department: employees.department,
    }).from(employees)
      .where(eq(employees.status, "active"))
      .orderBy(asc(employees.firstName), asc(employees.lastName));

    return NextResponse.json(rows.map(r => ({
      code: r.code,
      name: `${r.firstName} ${r.lastName}`.trim(),
      department: r.department || "",
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
