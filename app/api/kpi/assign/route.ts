import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { getDesignation } from "@/lib/kpi/catalog";

// POST /api/kpi/assign  { employeeId, templateCode }  (templateCode null = untrack)
export async function POST(req: NextRequest) {
  const guard = await guardWrite();
  if (guard instanceof NextResponse) return guard;
  try {
    const { employeeId, templateCode } = await req.json();
    if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });
    const code = templateCode || null;
    if (code && !getDesignation(code)) {
      return NextResponse.json({ error: `Unknown template ${code}` }, { status: 400 });
    }
    await db.update(employees).set({ kpiTemplate: code }).where(eq(employees.id, employeeId));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
