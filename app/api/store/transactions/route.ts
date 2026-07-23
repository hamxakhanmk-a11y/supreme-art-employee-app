import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeParts, storeTransactions } from "@/lib/schema";
import { desc, eq, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

// GET /api/store/transactions → [{ id, type, partId, qty, date, ref, notes, issuedTo, purpose }]
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    const rows = await db.select({
      id: storeTransactions.id,
      type: storeTransactions.type,
      partId: storeTransactions.partId,
      qty: storeTransactions.qty,
      date: sql<string>`${storeTransactions.date}::text`.as("date"),
      ref: storeTransactions.ref,
      notes: storeTransactions.notes,
      issuedTo: storeTransactions.issuedTo,
      purpose: storeTransactions.purpose,
    }).from(storeTransactions).orderBy(desc(storeTransactions.id));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { type: 'in'|'out', partId, qty, date, ref?, notes?, issuedTo?, purpose? }
// Adjusts parts.qty in the same request. Rejects 'out' when stock is insufficient.
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
    const [p] = await db.select({ qty: storeParts.qty, name: storeParts.name }).from(storeParts).where(eq(storeParts.id, partId));
    if (!p) return NextResponse.json({ error: "Part not found" }, { status: 400 });
    if (type === "out" && p.qty < qty) {
      return NextResponse.json({ error: `Not enough stock! Available: ${p.qty}` }, { status: 400 });
    }
    if (type === "out") {
      await db.update(storeParts).set({ qty: p.qty - qty }).where(eq(storeParts.id, partId));
    } else {
      await db.update(storeParts).set({ qty: p.qty + qty }).where(eq(storeParts.id, partId));
    }
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
    await logActivity({
      user: guard, action: `store.txn.${type}`,
      summary: `${type === "in" ? "stocked" : "issued"} ${qty} × "${p.name}"${b?.issuedTo ? ` to ${b.issuedTo}` : ""}`,
    });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/store/transactions?id=42 — reverses the stock impact of the txn.
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const id = parseInt(idParam);
    const [txn] = await db.select().from(storeTransactions).where(eq(storeTransactions.id, id));
    if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    if (txn.type === "in") {
      const [p] = await db.select({ qty: storeParts.qty }).from(storeParts).where(eq(storeParts.id, txn.partId));
      if (p && p.qty < txn.qty) {
        return NextResponse.json({
          error: `Cannot delete: current stock (${p.qty}) is less than this record's qty (${txn.qty}). Adjust stock first.`,
        }, { status: 400 });
      }
      if (p) await db.update(storeParts).set({ qty: p.qty - txn.qty }).where(eq(storeParts.id, txn.partId));
    } else {
      const [p] = await db.select({ qty: storeParts.qty }).from(storeParts).where(eq(storeParts.id, txn.partId));
      if (p) await db.update(storeParts).set({ qty: p.qty + txn.qty }).where(eq(storeParts.id, txn.partId));
    }
    await db.delete(storeTransactions).where(eq(storeTransactions.id, id));
    await logActivity({ user: guard, action: "store.txn.delete", summary: `deleted store transaction #${id}` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
