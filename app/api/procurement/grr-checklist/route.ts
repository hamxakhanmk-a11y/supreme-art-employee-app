import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guardWrite, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { cleanChecklist, loadChecklist } from "@/lib/procurement";

export const dynamic = "force-dynamic";

// The GRR inspection checklist: the general points and the categories with
// theirs. Whoever can edit GRRs can change it (GRR → Settings).
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ checklist: await loadChecklist() });
}

export async function PUT(req: Request) {
  const guard = await guardWrite("grn");
  if (guard instanceof NextResponse) return guard;
  const b = await req.json().catch(() => ({}));
  const checklist = cleanChecklist(b.checklist);
  await loadChecklist();   // makes sure procurement_settings exists
  await db.execute(sql`
    INSERT INTO procurement_settings (key, value) VALUES ('grr_checklist', ${JSON.stringify(checklist)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
  const points = checklist.general.length + checklist.categories.reduce((n, c) => n + c.points.length, 0);
  await logActivity({
    user: guard, action: "grr.checklist",
    summary: `updated the GRR inspection checklist (${checklist.categories.length} categories, ${points} points)`,
  });
  return NextResponse.json({ checklist });
}
