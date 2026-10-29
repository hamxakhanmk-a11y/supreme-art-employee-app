import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema, roundQty } from "@/lib/store";

// The "does not add up" box on the Store pages: a part whose quantity on hand
// differs from what its stock movements add up to. Two things can be done about
// a line — reconcile it (record an adjustment so the movements match), or
// ignore it (hide that warning; it comes back if the difference changes).

const rowsOf = (r: any): any[] => (r as any).rows ?? (r as any);

// GET — the warnings currently ignored: [{ partId, diff }].
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const rows = rowsOf(await db.execute(sql`SELECT part_id AS "partId", diff FROM store_ledger_ignores`));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { action: "ignore" | "unignore" | "reconcile", partId, diff? }
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const action = String(b?.action || "");
    const partId = parseInt(b?.partId);
    if (!partId) return NextResponse.json({ error: "partId is required" }, { status: 400 });

    const [part] = rowsOf(await db.execute(sql`SELECT id, sku, name, unit, module FROM parts WHERE id = ${partId}`));
    if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });
    const label = `${part.sku ? `[${part.sku}] ` : ""}${part.name}`;

    if (action === "ignore") {
      const diff = roundQty(Number(b?.diff));
      if (!isFinite(diff) || diff === 0) return NextResponse.json({ error: "diff is required" }, { status: 400 });
      await db.execute(sql`
        INSERT INTO store_ledger_ignores (part_id, diff, ignored_by) VALUES (${partId}, ${diff}, ${guard.name || ""})
        ON CONFLICT (part_id) DO UPDATE SET diff = EXCLUDED.diff, ignored_by = EXCLUDED.ignored_by, ignored_at = now()
      `);
      await logActivity({ user: guard, action: `store.${part.module}.ledger.ignore`, summary: `ignored the "does not add up" warning for "${label}" (difference ${diff} ${part.unit || ""})` });
      return NextResponse.json({ ok: true });
    }

    if (action === "unignore") {
      await db.execute(sql`DELETE FROM store_ledger_ignores WHERE part_id = ${partId}`);
      await logActivity({ user: guard, action: `store.${part.module}.ledger.unignore`, summary: `stopped ignoring the "does not add up" warning for "${label}"` });
      return NextResponse.json({ ok: true });
    }

    if (action === "reconcile") {
      // ONE statement: it works out the gap between the quantity on hand and the
      // movements, and records an adjustment for exactly that. The quantity on
      // hand is NOT changed — only the history is brought in line with it.
      //  • Stock on hand that no record explains (quantity above the movements)
      //    is recorded as an IN dated the day before the part's first movement
      //    (today if it has none): it reads as the opening stock.
      //  • Stock the records say is there but isn't (quantity below the
      //    movements) is recorded as an OUT dated today, when it was found
      //    missing — so a running balance never dips below zero in the past.
      const saved = rowsOf(await db.execute(sql`
        INSERT INTO transactions (type, part_id, qty, date, ref, notes, issued_to, purpose, challan_no)
        SELECT CASE WHEN p.qty > s.total THEN 'in' ELSE 'out' END,
               p.id,
               ABS(ROUND((p.qty - s.total)::numeric, 3))::double precision,
               CASE WHEN p.qty > s.total THEN COALESCE(s.first_day - 1, (now() AT TIME ZONE 'Asia/Karachi')::date)
                    ELSE (now() AT TIME ZONE 'Asia/Karachi')::date END,
               CASE WHEN p.qty > s.total THEN 'Adjustment' ELSE '' END,
               'Opening balance adjustment - brings the history in line with the quantity on hand',
               CASE WHEN p.qty > s.total THEN '' ELSE 'Adjustment' END,
               'Adjustment',
               ''
        FROM parts p
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END), 0) AS total, MIN(date) AS first_day
          FROM transactions WHERE part_id = p.id
        ) s
        WHERE p.id = ${partId} AND ABS(p.qty - s.total) > 0.0005
        RETURNING id, type, qty, date::text AS date
      `));
      const row = saved[0];
      if (!row) return NextResponse.json({ error: "This part already adds up - nothing to reconcile." }, { status: 400 });
      await db.execute(sql`DELETE FROM store_ledger_ignores WHERE part_id = ${partId}`);
      await logActivity({
        user: guard, action: `store.${part.module}.txn.reconcile`,
        summary: `reconciled "${label}": recorded an adjustment of ${row.type === "in" ? "+" : "-"}${row.qty} ${part.unit || ""} dated ${row.date} (quantity on hand unchanged)`,
      });
      return NextResponse.json({ ok: true, adjustment: row });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
