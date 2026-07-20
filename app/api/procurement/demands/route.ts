import { NextResponse } from "next/server";
import { desc, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { demands } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureProcurementTables } from "@/lib/procurement";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const rows = await db.select().from(demands).orderBy(desc(demands.demandNo));
  return NextResponse.json({ demands: rows });
}

export async function POST(req: Request) {
  const guard = await guardWrite("demand");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const b = await req.json().catch(() => ({}));

  const [{ n }] = await db.select({ n: max(demands.demandNo) }).from(demands);
  const demandNo = Number(n ?? 0) + 1;

  const items = Array.isArray(b.items) ? b.items : [];
  const [row] = await db.insert(demands).values({
    demandNo,
    date: b.date || new Date().toISOString().slice(0, 10),
    requiredBy: b.requiredBy || null,
    demandBy: b.demandBy || null,
    department: b.department || null,
    preparedBy: b.preparedBy || null,
    approvedBy: b.approvedBy || null,
    sectionIncharge: b.sectionIncharge || null,
    items: JSON.stringify(items),
    status: "open",
    createdByUserId: guard.id,
    createdByName: guard.name,
  }).returning();

  await logActivity({ user: guard, action: "demand.create", summary: `raised Demand #${demandNo}` });
  return NextResponse.json({ demand: row });
}
