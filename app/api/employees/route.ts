import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords } from "@/lib/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(employees).orderBy(desc(employees.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Auto-generate next employee ID
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(employees);
    const nextNum = (count ?? 0) + 1;
    const employeeId = `EMP-${String(nextNum).padStart(4, "0")}`;

    const [created] = await db.insert(employees).values({
      employeeId,
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
    }).returning();

    // Education
    if (Array.isArray(body.education) && body.education.length) {
      await db.insert(educationRecords).values(
        body.education
          .filter((e: any) => e.degree?.trim())
          .map((e: any) => ({
            employeeId: created.id,
            degree: e.degree,
            institution: e.institution || null,
            yearCompleted: e.yearCompleted || null,
            grade: e.grade || null,
            certificateUrl: e.certificateUrl || null,
          }))
      );
    }

    // Experience
    if (Array.isArray(body.experience) && body.experience.length) {
      await db.insert(experienceRecords).values(
        body.experience
          .filter((e: any) => e.company?.trim())
          .map((e: any) => ({
            employeeId: created.id,
            company: e.company,
            position: e.position || null,
            fromDate: e.fromDate || null,
            toDate: e.toDate || null,
            description: e.description || null,
          }))
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Create failed" }, { status: 500 });
  }
}
