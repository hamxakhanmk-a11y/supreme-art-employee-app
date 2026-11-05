import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardAuth, guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema } from "@/lib/store";

// Supplier and brand names hidden from the Add / Edit dropdowns in Inks &
// Consumables ("Manage suppliers / brands"). Hiding only takes a name off the
// suggestions: the items keep their supplier and brand, and a hidden name can be
// shown again.

const rowsOf = (r: any): any[] => (r as any).rows ?? (r as any);
const FIELDS = new Set(["supplier", "brand"]);

// GET — [{ field, value }]
export async function GET() {
  const guard = await guardAuth();
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    return NextResponse.json(rowsOf(await db.execute(sql`SELECT field, value FROM store_dropdown_hidden ORDER BY field, value`)));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { action: "hide" | "show", field: "supplier" | "brand", value }
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store.settings");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const action = String(b?.action || "");
    const field = String(b?.field || "");
    const value = String(b?.value || "").trim();
    if (!FIELDS.has(field)) return NextResponse.json({ error: "field must be supplier or brand" }, { status: 400 });
    if (!value) return NextResponse.json({ error: "value is required" }, { status: 400 });
    if (action === "hide") {
      await db.execute(sql`
        INSERT INTO store_dropdown_hidden (field, value, hidden_by) VALUES (${field}, ${value}, ${guard.name || ""})
        ON CONFLICT (field, value) DO NOTHING`);
      await logActivity({ user: guard, action: "store.consumables.dropdown.hide", summary: `hid the ${field} "${value}" from the Add / Edit dropdown` });
      return NextResponse.json({ ok: true });
    }
    if (action === "show") {
      await db.execute(sql`DELETE FROM store_dropdown_hidden WHERE field = ${field} AND value = ${value}`);
      await logActivity({ user: guard, action: "store.consumables.dropdown.show", summary: `showed the ${field} "${value}" in the Add / Edit dropdown again` });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "action must be hide or show" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
