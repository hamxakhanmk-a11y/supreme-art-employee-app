import { NextResponse } from "next/server";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureApTables, setApStartDate } from "@/lib/payablesServer";

export const dynamic = "force-dynamic";

// PUT /api/payables/settings { startDate } — the GRR date Payables starts from. GRRs before it were paid the
// old way and stay out (unless finance had already taken one in hand).
export async function PUT(req: Request) {
  const guard = await guardWrite("payables.approve");
  if (guard instanceof NextResponse) return guard;
  await ensureApTables();
  const b = await req.json().catch(() => ({}));
  const startDate = String(b.startDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return NextResponse.json({ error: "Give a date." }, { status: 400 });
  await setApStartDate(startDate);
  await logActivity({ user: guard, action: "payables.settings", summary: `set Payables to start from GRRs dated ${startDate}` });
  return NextResponse.json({ ok: true });
}
