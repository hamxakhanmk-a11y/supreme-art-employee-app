import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, educationRecords, experienceRecords, otherDocuments } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";

export async function GET() {
  const rows = await db.select().from(employees).orderBy(desc(employees.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await req.json();

    const [created] = await db.insert(employees).values({
      employeeId: body.employeeId,
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

    if (Array.isArray(body.otherDocuments) && body.otherDocuments.length) {
      const rows = body.otherDocuments
        .filter((d: any) => d.label?.trim() && d.url?.trim())
        .map((d: any) => ({ employeeId: created.id, label: d.label.trim(), url: d.url.trim() }));
      if (rows.length) await db.insert(otherDocuments).values(rows);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Create failed" }, { status: 500 });
  }
}
