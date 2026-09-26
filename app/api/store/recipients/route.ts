import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeRecipients } from "@/lib/schema";
import { asc, eq, sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema } from "@/lib/store";

// Extra "Issued To" names the store keeps for itself — contractors, outside
// workshops, anyone stock goes to who isn't on the payroll. The employee
// picker shows these alongside the live staff list so an outsider is spelled
// the same way every time instead of being retyped from memory.

// GET /api/store/recipients → [{ id, name }]
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const rows = await db.select({ id: storeRecipients.id, name: storeRecipients.name })
      .from(storeRecipients)
      .orderBy(asc(storeRecipients.name));
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { name } → the stored row, whether it was just created or already there.
// Adding a name that exists returns the existing one rather than failing: from
// the picker's side "make sure this name is on the list" is the whole ask.
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const name = String(b?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (name.length > 120) return NextResponse.json({ error: "Name is too long" }, { status: 400 });

    // ON CONFLICT names the expression index, which Drizzle doesn't know about.
    const ins = await db.execute(sql`
      INSERT INTO store_recipients (name) VALUES (${name})
      ON CONFLICT (LOWER(name)) DO NOTHING
      RETURNING id, name
    `);
    const created: any[] = (ins as any).rows ?? (ins as any);
    if (created.length > 0) {
      await logActivity({ user: guard, action: "store.recipient.add", summary: `added store issue recipient "${name}"` });
      return NextResponse.json(created[0]);
    }
    const existing = await db.execute(sql`
      SELECT id, name FROM store_recipients WHERE LOWER(name) = LOWER(${name}) LIMIT 1
    `);
    const rows: any[] = (existing as any).rows ?? (existing as any);
    return NextResponse.json(rows[0] ?? { id: 0, name });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/store/recipients?id=4 — takes the name off the picker only.
// Issuances already recorded against it keep their text: "Issued To" is stored
// on the transaction itself, so history doesn't move when this list does.
export async function DELETE(req: NextRequest) {
  const guard = await guardWrite("store");
  if (guard instanceof NextResponse) return guard;
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    await ensureStoreSchema();
    const id = parseInt(idParam);
    const [existing] = await db.select({ name: storeRecipients.name })
      .from(storeRecipients).where(eq(storeRecipients.id, id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.delete(storeRecipients).where(eq(storeRecipients.id, id));
    await logActivity({ user: guard, action: "store.recipient.delete", summary: `removed store issue recipient "${existing.name}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
