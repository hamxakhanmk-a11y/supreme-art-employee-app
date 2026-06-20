import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords, otherDocuments } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const empId = parseInt(id);
  const [emp] = await db.select().from(employees).where(eq(employees.id, empId));
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(emp);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const empId = parseInt(id);
    const body = await req.json();

    const [updated] = await db.update(employees).set({
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
      basicSalary: body.basicSalary ? parseInt(body.basicSalary) : null,
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

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const empId = parseInt(id);
    await db.delete(employees).where(eq(employees.id, empId));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
