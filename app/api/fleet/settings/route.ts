import { NextRequest, NextResponse } from "next/server";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { setLowBalanceLevel } from "@/lib/cardBalance";

// PUT { lowBalance } — the balance under which a PSO card is flagged.
export async function PUT(req: NextRequest) {
  const guard = await guardWrite("station");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const n = Number(b?.lowBalance);
    if (b?.lowBalance === "" || b?.lowBalance === null || !Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Enter the low-balance amount in rupees" }, { status: 400 });
    }
    const level = Math.round(n);
    await setLowBalanceLevel(level);
    await logActivity({ user: guard, action: "station.card.lowlevel", summary: `set the PSO card low-balance warning to Rs ${level}` });
    return NextResponse.json({ ok: true, lowLevel: level });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
