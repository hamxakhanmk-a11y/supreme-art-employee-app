import { NextResponse } from "next/server";
import { asc, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { suppliers } from "@/lib/schema";
import { guardWrite, getSession } from "@/lib/auth";
import { ensureProcurementTables } from "@/lib/procurement";

export const dynamic = "force-dynamic";

// GET — the saved supplier directory (name A→Z) for the PO picker.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await ensureProcurementTables();
  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.name));
  return NextResponse.json({ suppliers: rows });
}

// POST { name, address?, contact? } — save a new supplier. If one with the same
// name already exists (case-insensitive) it's updated with any new details
// rather than duplicated.
export async function POST(req: Request) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
  const address = String(b.address || "").trim() || null;
  const contact = String(b.contact || "").trim() || null;
  const registered = typeof b.registered === "boolean" ? b.registered : null;

  const [existing] = await db.select().from(suppliers).where(ilike(suppliers.name, name)).limit(1);
  if (existing) {
    const [updated] = await db.update(suppliers)
      .set({
        address: address ?? existing.address,
        contact: contact ?? existing.contact,
        registered: registered ?? existing.registered,
      })
      .where(eq(suppliers.id, existing.id)).returning();
    return NextResponse.json({ supplier: updated, existed: true });
  }
  const [row] = await db.insert(suppliers).values({ name, address, contact, registered }).returning();
  return NextResponse.json({ supplier: row });
}

// PATCH { id, registered } — retag a saved supplier as registered / unregistered
// from the supplier lists panel.
export async function PATCH(req: Request) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const b = await req.json().catch(() => ({}));
  const id = parseInt(String(b.id), 10);
  if (isNaN(id)) return NextResponse.json({ error: "Supplier id is required" }, { status: 400 });
  const registered = typeof b.registered === "boolean" ? b.registered : null;
  const [row] = await db.update(suppliers).set({ registered }).where(eq(suppliers.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ supplier: row });
}

// DELETE { id } — remove a saved supplier from the directory. Existing POs keep
// their own copy of the supplier's details, so this only affects the picker.
export async function DELETE(req: Request) {
  const guard = await guardWrite("po");
  if (guard instanceof NextResponse) return guard;
  await ensureProcurementTables();
  const b = await req.json().catch(() => ({}));
  const id = parseInt(String(b.id), 10);
  if (isNaN(id)) return NextResponse.json({ error: "Supplier id is required" }, { status: 400 });
  await db.delete(suppliers).where(eq(suppliers.id, id));
  return NextResponse.json({ ok: true });
}
