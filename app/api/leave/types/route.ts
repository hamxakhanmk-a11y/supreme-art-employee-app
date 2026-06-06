import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveTypes } from "@/lib/schema";

export async function GET() {
  const types = await db.select().from(leaveTypes);
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newType = await db.insert(leaveTypes).values({
      name: body.name,
      daysAllowed: parseInt(body.daysAllowed),
      carryForward: body.carryForward || false,
      isPaid: body.isPaid !== false,
    }).returning();
    return NextResponse.json(newType[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create leave type" }, { status: 500 });
  }
}
