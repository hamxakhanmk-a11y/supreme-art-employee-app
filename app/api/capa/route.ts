import { NextRequest, NextResponse } from "next/server";
import { desc, eq, max, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { capaReports } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureCapaTable, buildCapaRef } from "@/lib/capa";

export const dynamic = "force-dynamic";

// GET /api/capa?status=open — list all CAPAs, newest first.
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureCapaTable();
  const status = req.nextUrl.searchParams.get("status");
  const rows = status && status !== "all"
    ? await db.select().from(capaReports).where(eq(capaReports.status, status)).orderBy(desc(capaReports.id))
    : await db.select().from(capaReports).orderBy(desc(capaReports.id));
  return NextResponse.json({ capas: rows });
}

// POST /api/capa — create a blank CAPA, numbered CAPA-{year}-{seq}.
export async function POST(req: Request) {
  const guard = await guardWrite("capa");
  if (guard instanceof NextResponse) return guard;
  await ensureCapaTable();
  const b = await req.json().catch(() => ({}));

  const year = new Date().getFullYear();
  // Sequence restarts each calendar year.
  const [{ n }] = await db.select({ n: max(capaReports.seq) })
    .from(capaReports).where(eq(capaReports.year, year));
  const seq = (n ?? 0) + 1;
  const capaRef = buildCapaRef(year, seq);

  const [row] = await db.insert(capaReports).values({
    capaRef,
    seq,
    year,
    status: "open",
    issueDate: b.issueDate || new Date().toISOString().slice(0, 10),
    data: JSON.stringify(b.data ?? {}),
    createdByUserId: guard.id,
    createdByName: guard.name,
  }).returning();

  await logActivity({
    user: guard, action: "capa.create",
    summary: `raised CAPA ${capaRef}`,
  });
  return NextResponse.json({ capa: row }, { status: 201 });
}
