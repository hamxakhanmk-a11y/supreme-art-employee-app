import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveRequests, leaveBalances } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newRequest = await db.insert(leaveRequests).values({
      employeeId: parseInt(body.employeeId),
      leaveTypeId: parseInt(body.leaveTypeId),
      startDate: body.startDate,
      endDate: body.endDate,
      days: body.days,
      reason: body.reason || null,
      status: "pending",
    }).returning();
    return NextResponse.json(newRequest[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to submit leave request" }, { status: 500 });
  }
}
