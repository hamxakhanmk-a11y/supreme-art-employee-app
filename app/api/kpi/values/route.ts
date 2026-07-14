import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kpiValues, kpiTargets } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";

// GET /api/kpi/values?employeeId=&year=  -> all operand values + target overrides for the year
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const employeeId = parseInt(url.searchParams.get("employeeId") || "");
    const year = parseInt(url.searchParams.get("year") || "");
    if (!employeeId || !year) {
      return NextResponse.json({ error: "employeeId and year required" }, { status: 400 });
    }
    const [values, targets] = await Promise.all([
      db.select().from(kpiValues).where(and(eq(kpiValues.employeeId, employeeId), eq(kpiValues.year, year))),
      db.select().from(kpiTargets).where(and(eq(kpiTargets.employeeId, employeeId), eq(kpiTargets.year, year))),
    ]);
    return NextResponse.json({ values, targets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/kpi/values
//   { employeeId, templateCode, year, month, kpiIdx, inputKey, value }   -> upsert one operand
//   { employeeId, year, kpiIdx, target }                                 -> upsert one target override
export async function POST(req: NextRequest) {
  const guard = await guardWrite("kpi");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json();
    const { employeeId, year } = b;
    if (!employeeId || !year) {
      return NextResponse.json({ error: "employeeId and year required" }, { status: 400 });
    }

    // Target override branch
    if (b.kind === "target") {
      const { kpiIdx } = b;
      const target = b.target === null || b.target === "" ? null : Number(b.target);
      const existing = await db.select().from(kpiTargets)
        .where(and(eq(kpiTargets.employeeId, employeeId), eq(kpiTargets.year, year), eq(kpiTargets.kpiIdx, kpiIdx)));
      if (existing.length) {
        await db.update(kpiTargets).set({ target, updatedAt: new Date() }).where(eq(kpiTargets.id, existing[0].id));
      } else {
        await db.insert(kpiTargets).values({ employeeId, year, kpiIdx, target });
      }
      return NextResponse.json({ success: true });
    }

    // Operand value branch
    const { templateCode, month, kpiIdx, inputKey } = b;
    if (!templateCode || !month || kpiIdx === undefined || !inputKey) {
      return NextResponse.json({ error: "templateCode, month, kpiIdx, inputKey required" }, { status: 400 });
    }
    const value = b.value === null || b.value === "" ? null : Number(b.value);
    const existing = await db.select().from(kpiValues).where(and(
      eq(kpiValues.employeeId, employeeId), eq(kpiValues.year, year),
      eq(kpiValues.month, month), eq(kpiValues.kpiIdx, kpiIdx), eq(kpiValues.inputKey, inputKey),
    ));
    if (existing.length) {
      await db.update(kpiValues).set({ value, templateCode, updatedAt: new Date() }).where(eq(kpiValues.id, existing[0].id));
    } else {
      await db.insert(kpiValues).values({ employeeId, templateCode, year, month, kpiIdx, inputKey, value });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
