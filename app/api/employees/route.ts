import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";

export async function GET() {
  try {
    const allEmployees = await db.select().from(employees);
    return NextResponse.json(allEmployees);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Generate Employee ID
    const count = await db.select().from(employees);
    const employeeId = `EMP-${String(count.length + 1).padStart(4, "0")}`;

    const newEmployee = await db.insert(employees).values({
      employeeId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone || null,
      cnic: body.cnic || null,
      cnicExpiry: body.cnicExpiry || null,
      address: body.address || null,
      dateOfBirth: body.dateOfBirth || null,
      dateOfJoining: body.dateOfJoining || null,
      designation: body.designation || null,
      employmentType: body.employmentType || "full-time",
      status: body.status || "active",
    }).returning();

    return NextResponse.json(newEmployee[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
