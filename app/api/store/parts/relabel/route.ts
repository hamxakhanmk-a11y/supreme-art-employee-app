import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardWrite } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ensureStoreSchema } from "@/lib/store";
import { storeModuleDenied } from "@/lib/storeAccess";

// Inks & Consumables → "Suppliers & Brands": change the supplier or the brand of
// several rows at once (move items to another supplier, or rename one everywhere).
// A row is one product + supplier + brand, so a change that would leave two rows of
// the same product with the same supplier and brand is refused.

const rowsOf = (r: any): any[] => (r as any).rows ?? (r as any);
const norm = (s: any) => String(s ?? "").trim().toLowerCase();

// POST { ids: number[], field: "supplier" | "brand", value: string }   (value "" clears it)
export async function POST(req: NextRequest) {
  const guard = await guardWrite("store.settings");
  if (guard instanceof NextResponse) return guard;
  try {
    await ensureStoreSchema();
    const b = await req.json().catch(() => ({}));
    const field = String(b?.field || "");
    if (field !== "supplier" && field !== "brand") return NextResponse.json({ error: "field must be supplier or brand" }, { status: 400 });
    const value = String(b?.value ?? "").trim().slice(0, 120);
    const ids: number[] = [...new Set((Array.isArray(b?.ids) ? b.ids : []).map((x: any) => parseInt(x, 10)).filter((n: number) => n > 0))].slice(0, 500) as number[];
    if (!ids.length) return NextResponse.json({ error: "Pick at least one item" }, { status: 400 });
    // Suppliers & brands belong to the Consumables store.
    const no = await storeModuleDenied(guard, "consumables");
    if (no) return no;

    const all = rowsOf(await db.execute(sql`
      SELECT id, name, supplier, brand FROM parts WHERE module = 'consumables' AND deleted_at IS NULL`));
    const picked = all.filter(r => ids.includes(Number(r.id)));
    if (!picked.length) return NextResponse.json({ error: "Those items were not found" }, { status: 404 });

    const keyOf = (r: any, changed: boolean) => {
      const sup = changed && field === "supplier" ? value : r.supplier;
      const br = changed && field === "brand" ? value : r.brand;
      return `${norm(r.name)}|${norm(sup)}|${norm(br)}`;
    };
    const seen = new Map<string, any>();
    for (const r of all) {
      const k = keyOf(r, ids.includes(Number(r.id)));
      const other = seen.get(k);
      if (other && (ids.includes(Number(r.id)) || ids.includes(Number(other.id)))) {
        const who = [field === "supplier" ? value : r.supplier, field === "brand" ? value : r.brand].filter(Boolean).join(" · ") || "no supplier / brand";
        return NextResponse.json({ error: `"${r.name}" would then be in the store twice as ${who}. Change the other one first, or pick different items.` }, { status: 409 });
      }
      seen.set(k, r);
    }

    const idList = sql.join(picked.map(r => sql`${Number(r.id)}`), sql`, `);
    if (field === "supplier") await db.execute(sql`UPDATE parts SET supplier = ${value} WHERE id IN (${idList}) AND module = 'consumables' AND deleted_at IS NULL`);
    else await db.execute(sql`UPDATE parts SET brand = ${value} WHERE id IN (${idList}) AND module = 'consumables' AND deleted_at IS NULL`);

    const names = [...new Set(picked.map(r => r.name))].slice(0, 3).join(", ");
    await logActivity({
      user: guard, action: `store.consumables.${field}.change`,
      summary: `changed the ${field} of ${picked.length} Inks & Consumables item${picked.length === 1 ? "" : "s"} (${names}${picked.length > 3 ? "…" : ""}) to ${value ? `"${value}"` : "none"}`,
    });
    return NextResponse.json({ ok: true, updated: picked.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
