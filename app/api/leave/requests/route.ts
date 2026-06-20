import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveRequests } from "@/lib/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

// GET /api/leave/requests?employeeId=&status=&from=&to=
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const employeeId = url.searchParams.get("employeeId");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conds: any[] = [];
  if (employeeId) conds.push(eq(leaveRequests.employeeId, parseInt(employeeId)));
  if (status) conds.push(eq(leaveRequests.status, status));
  if (from) conds.push(gte(leaveRequests.startDate, from));
  if (to) conds.push(lte(leaveRequests.endDate, to));

  const rows = await db.select().from(leaveRequests)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(leaveRequests.createdAt));
  return NextResponse.json(rows);
}

// Calculate inclusive day count between two dates
function daysBetween(start: string, end: string): number {
  const s = new Date(start), e = new Date(end);
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.employeeId || !body.leaveTypeId || !body.startDate || !body.endDate) {
      return NextResponse.json({ error: "employeeId, leaveTypeId, startDate, endDate required" }, { status: 400 });
    }
    // Half-day requests are always 1 calendar day (counted as 0.5 elsewhere)
    const isHalfDay = !!body.halfSegment;
    const days = isHalfDay ? 1 : daysBetween(body.startDate, body.endDate);
    if (days <= 0) return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });

    const [c] = await db.insert(leaveRequests).values({
      employeeId: parseInt(body.employeeId),
      leaveTypeId: parseInt(body.leaveTypeId),
      startDate: body.startDate,
      endDate: isHalfDay ? body.startDate : body.endDate,
      days,
      halfSegment: body.halfSegment || null,
      reason: body.reason || null,
      dutiesAssignedTo: body.dutiesAssignedTo || null,
      medicalCertAttached: body.medicalCertAttached || null,
      status: "pending",
    }).returning();
    return NextResponse.json(c, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
