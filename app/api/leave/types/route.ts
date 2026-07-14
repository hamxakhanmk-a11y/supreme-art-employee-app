import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leaveTypes } from "@/lib/schema";
import { asc } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";

export async function GET() {
  const rows = await db.select().from(leaveTypes).orderBy(asc(leaveTypes.name));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardWrite("forms");
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await req.json();
    const [c] = await db.insert(leaveTypes).values({
      name: body.name,
      daysAllowed: parseInt(body.daysAllowed) || 0,
      isPaid: body.isPaid !== false,
      color: body.color || "#185FA5",
      description: body.description || null,
    }).returning();
    return NextResponse.json(c, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
