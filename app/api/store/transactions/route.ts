import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeParts, storeTransactions } from "@/lib/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// GET — only returns transactions whose part isn't in the trash.
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const rows = await db.execute(sql`
      SELECT t.id, t.type,
             t.part_id   AS "partId",
             t.qty,
             t.date::text AS date,
             t.ref, t.notes,
             t.issued_to AS "issuedTo",
             t.purpose
      FROM transactions t
      JOIN parts p ON p.id = t.part_id
      WHERE p.deleted_at IS NULL
      ORDER BY t.id DESC
    `);
    const list = (rows as any).rows ?? (rows as any);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — create an in / out transaction and adjust the part's qty.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    const b = await req.json().catch(() => ({}));
    const type = String(b?.type || "");
    const partId = parseInt(b?.partId);
    const qty = parseInt(b?.qty);
    const date = String(b?.date || "");
    if (!type || !partId || !qty || !date) {
      return NextResponse.json({ error: "type, partId, qty and date are required" }, { status: 400 });
    }
    if (type !== "in" && type !== "out") {
      return NextResponse.json({ error: "type must be 'in' or 'out'" }, { status: 400 });
    }
    const [p] = await db.select({ qty: storeParts.qty, name: storeParts.name, sku: storeParts.sku, unit: storeParts.unit })
      .from(storeParts).where(eq(storeParts.id, partId));
    if (!p) return NextResponse.json({ error: "Part not found" }, { status: 400 });
    if (type === "out" && p.qty < qty) {
      return NextResponse.json({ error: `Not enough stock! Available: ${p.qty}` }, { status: 400 });
    }
    await db.update(storeParts)
      .set({ qty: type === "in" ? p.qty + qty : p.qty - qty })
      .where(eq(storeParts.id, partId));

    const [row] = await db.insert(storeTransactions).values({
      type, partId, qty, date,
      ref: (b?.ref || "").toString(),
      notes: (b?.notes || "").toString(),
      issuedTo: (b?.issuedTo || "").toString(),
      purpose: (b?.purpose || "").toString(),
    }).returning({
      id: storeTransactions.id, type: storeTransactions.type, partId: storeTransactions.partId,
      qty: storeTransactions.qty, date: sql<string>`${storeTransactions.date}::text`.as("date"),
      ref: storeTransactions.ref, notes: storeTransactions.notes,
      issuedTo: storeTransactions.issuedTo, purpose: storeTransactions.purpose,
    });
    const label = `${p.sku ? `[${p.sku}] ` : ""}${p.name}`;
    await logActivity({
      user: guard, action: `store.txn.${type}`,
      summary: `${type === "in" ? "stocked" : "issued"} ${qty} ${p.unit || ""} of "${label}"${b?.issuedTo ? ` to ${b.issuedTo}` : ""}`.trim(),
    });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — supports ?id=42 (single, reverse qty) OR JSON body { ids: [...], historyOnly?: bool }
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    let ids: number[] = [];
    let historyOnly = false;
    const idQuery = req.nextUrl.searchParams.get("id");
    if (idQuery) {
      ids = [parseInt(idQuery)].filter(Boolean);
    } else {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.ids)) ids = body.ids.map((x: any) => Number(x)).filter(Boolean);
      historyOnly = body?.historyOnly === true;
    }
    if (!ids.length) return NextResponse.json({ error: "ID(s) required" }, { status: 400 });

    const txns = await db.select().from(storeTransactions).where(inArray(storeTransactions.id, ids));
    if (!txns.length) return NextResponse.json({ ok: true, deleted: 0 });

    const partIds = Array.from(new Set(txns.map(t => t.partId)));
    const parts = await db.select({
      id: storeParts.id, name: storeParts.name, sku: storeParts.sku,
      unit: storeParts.unit, qty: storeParts.qty,
    }).from(storeParts).where(inArray(storeParts.id, partIds));
    const partsMap = new Map(parts.map(p => [p.id, p]));

    if (!historyOnly) {
      const delta = new Map<number, number>();
      for (const t of txns) {
        delta.set(t.partId, (delta.get(t.partId) || 0) + (t.type === "in" ? -t.qty : t.qty));
      }
      for (const pid of partIds) {
        const p = partsMap.get(pid);
        if (!p) continue;
        const projected = p.qty + (delta.get(pid) || 0);
        if (projected < 0) {
          return NextResponse.json({
            error: `Cannot delete: would make "${p.name}" go below zero (current ${p.qty}, net reversal ${delta.get(pid)}). Adjust stock first or use 'Delete from History' to purge without reversing qty.`,
          }, { status: 400 });
        }
      }
      for (const [pid, d] of delta.entries()) {
        if (!d) continue;
        const p = partsMap.get(pid);
        if (!p) continue;
        await db.update(storeParts).set({ qty: p.qty + d }).where(eq(storeParts.id, pid));
      }
    }
    await db.delete(storeTransactions).where(inArray(storeTransactions.id, ids));

    for (const t of txns) {
      const p = partsMap.get(t.partId);
      const label = `${p?.sku ? `[${p.sku}] ` : ""}${p?.name || `part #${t.partId}`}`;
      const verb = t.type === "in" ? "Stock In" : "Stock Out";
      const sign = t.type === "in" ? "+" : "-";
      const who = t.type === "in" ? (t.ref || "—") : (t.issuedTo || "—");
      const prefix = historyOnly ? "Purged from history" : "Reversed";
      await logActivity({
        user: guard, action: historyOnly ? "store.txn.purge" : "store.txn.delete",
        summary: `${prefix} ${verb}: ${sign}${t.qty} ${p?.unit || ""} of "${label}" on ${t.date} (${t.type === "in" ? "ref" : "to"}: ${who})`,
      });
    }
    return NextResponse.json({ ok: true, deleted: txns.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
