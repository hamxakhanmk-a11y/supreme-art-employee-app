import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords, otherDocuments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { setExitReason } from "@/lib/employeesServer";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const empId = parseInt(id);
  const [emp] = await db.select().from(employees).where(eq(employees.id, empId));
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(emp);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("employees");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const empId = parseInt(id);
    const body = await req.json();

    const [updated] = await db.update(employees).set({
      ...(body.employeeId && typeof body.employeeId === "string" && body.employeeId.trim()
        ? { employeeId: body.employeeId.trim() }
        : {}),
      firstName: body.firstName,
      lastName: body.lastName,
      fatherName: body.fatherName || null,
      dob: body.dob || null,
      gender: body.gender || null,
      maritalStatus: body.maritalStatus || null,
      nationality: body.nationality || null,
      religion: body.religion || null,
      bloodGroup: body.bloodGroup || null,
      cnic: body.cnic || null,
      cnicExpiry: body.cnicExpiry || null,
      passportNumber: body.passportNumber || null,
      passportExpiry: body.passportExpiry || null,
      ssiNumber: body.ssiNumber || null,
      ssiExpiry: body.ssiExpiry || null,
      ubiNumber: body.ubiNumber || null,
      ubiExpiry: body.ubiExpiry || null,
      phone: body.phone || null,
      altPhone: body.altPhone || null,
      email: body.email || null,
      currentAddress: body.currentAddress || null,
      permanentAddress: body.permanentAddress || null,
      city: body.city || null,
      emergencyName: body.emergencyName || null,
      emergencyRelation: body.emergencyRelation || null,
      emergencyPhone: body.emergencyPhone || null,
      designation: body.designation || null,
      department: body.department || null,
      joiningDate: body.joiningDate || null,
      employmentType: body.employmentType || null,
      reportingManager: body.reportingManager || null,
      workLocation: body.workLocation || null,
      shift: body.shift || null,
      status: body.status || "active",
      contractExpiry: body.contractExpiry || null,
      resignationDate: body.status === "resigned" ? (body.resignationDate || null) : null,
      basicSalary: body.basicSalary ? parseInt(body.basicSalary) : null,
      conveyance: body.conveyance ? parseInt(body.conveyance) : 0,
      houseRentPercent: body.houseRentPercent ? parseInt(body.houseRentPercent) : 0,
      medicalPercent: body.medicalPercent ? parseInt(body.medicalPercent) : 0,
      incomeTaxPercent: body.incomeTaxPercent ? parseInt(body.incomeTaxPercent) : 0,
      incomeTaxAmount: body.incomeTaxAmount ? parseInt(body.incomeTaxAmount) : 0,
      eobiEmployeePercent: body.eobiEmployeePercent ? parseInt(body.eobiEmployeePercent) : 0,
      eobiEmployeeAmount: body.eobiEmployeeAmount ? parseInt(body.eobiEmployeeAmount) : 0,
      eobiEmployerPercent: body.eobiEmployerPercent ? parseInt(body.eobiEmployerPercent) : 0,
      eobiEmployerAmount: body.eobiEmployerAmount !== undefined && body.eobiEmployerAmount !== "" ? parseInt(body.eobiEmployerAmount) : 1850,
      minimumWage: body.minimumWage !== undefined && body.minimumWage !== "" ? parseInt(body.minimumWage) : 37000,
      essiContribution: body.essiContribution !== undefined && body.essiContribution !== "" ? parseInt(body.essiContribution) : 2400,
      accommodation: body.accommodation ? parseInt(body.accommodation) : 0,
      food: body.food ? parseInt(body.food) : 0,
      bankName: body.bankName || null,
      accountTitle: body.accountTitle || null,
      accountNumber: body.accountNumber || null,
      iban: body.iban || null,
      photoUrl: body.photoUrl || null,
      cnicFrontUrl: body.cnicFrontUrl || null,
      cnicBackUrl: body.cnicBackUrl || null,
      passportUrl: body.passportUrl || null,
      ssiUrl: body.ssiUrl || null,
      ubiUrl: body.ubiUrl || null,
      notes: body.notes || null,
      updatedAt: new Date(),
    }).where(eq(employees.id, empId)).returning();

    // Replace education
    await db.delete(educationRecords).where(eq(educationRecords.employeeId, empId));
    if (Array.isArray(body.education) && body.education.length) {
      const rows = body.education
        .filter((e: any) => e.degree?.trim())
        .map((e: any) => ({
          employeeId: empId,
          degree: e.degree,
          institution: e.institution || null,
          yearCompleted: e.yearCompleted || null,
          grade: e.grade || null,
          certificateUrl: e.certificateUrl || null,
        }));
      if (rows.length) await db.insert(educationRecords).values(rows);
    }

    // Replace experience
    await db.delete(experienceRecords).where(eq(experienceRecords.employeeId, empId));
    if (Array.isArray(body.experience) && body.experience.length) {
      const rows = body.experience
        .filter((e: any) => e.company?.trim())
        .map((e: any) => ({
          employeeId: empId,
          company: e.company,
          position: e.position || null,
          fromDate: e.fromDate || null,
          toDate: e.toDate || null,
          description: e.description || null,
        }));
      if (rows.length) await db.insert(experienceRecords).values(rows);
    }

    // Replace other documents
    await db.delete(otherDocuments).where(eq(otherDocuments.employeeId, empId));
    if (Array.isArray(body.otherDocuments) && body.otherDocuments.length) {
      const rows = body.otherDocuments
        .filter((d: any) => d.label?.trim() && d.url?.trim())
        .map((d: any) => ({ employeeId: empId, label: d.label.trim(), url: d.url.trim() }));
      if (rows.length) await db.insert(otherDocuments).values(rows);
    }

    await logActivity({
      user: guard, action: "employee.update", employeeId: empId,
      employeeName: `${updated.firstName} ${updated.lastName}`,
      summary: "profile updated",
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error(e);
    // Postgres unique-violation on employees.employee_id
    if (e?.code === "23505" || /unique/i.test(e?.message || "")) {
      return NextResponse.json({ error: "That Employee ID is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

// PATCH — lightweight status change only (Exit / Re-activate from the list).
// Never touches the employee's history; attendance/salary/kpi/etc. already
// filter to active employees, so a non-active status simply stops new records.
const STATUS_VALUES = ["active", "inactive", "resigned"] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("employees");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const empId = parseInt(id);
    const body = await req.json().catch(() => ({}));
    const status = String(body.status || "");
    if (!(STATUS_VALUES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const [emp] = await db.select({
      firstName: employees.firstName, lastName: employees.lastName, code: employees.employeeId,
    }).from(employees).where(eq(employees.id, empId));
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    await db.update(employees).set({
      status,
      resignationDate: status === "resigned" ? (body.resignationDate || today) : null,
      updatedAt: new Date(),
    }).where(eq(employees.id, empId));

    // Exit reason (why they left) — recorded on exit, cleared on re-activate.
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    await setExitReason(empId, status === "resigned" ? (reason || null) : null);

    await logActivity({
      user: guard, action: "employee.status", employeeId: empId,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      summary: status === "active" ? "re-activated" : `exited${reason ? ` — ${reason}` : ""}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardWrite("employees");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await ctx.params;
    const empId = parseInt(id);
    // Snapshot the name before the row (and its FK'd children) disappear.
    const [victim] = await db.select({ firstName: employees.firstName, lastName: employees.lastName, code: employees.employeeId })
      .from(employees).where(eq(employees.id, empId));
    await db.delete(employees).where(eq(employees.id, empId));
    await logActivity({
      user: guard, action: "employee.delete", employeeId: empId,
      employeeName: victim ? `${victim.firstName} ${victim.lastName}` : `#${empId}`,
      summary: `deleted from employees${victim ? ` (${victim.code})` : ""}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
