import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { guardAuth } from "@/lib/auth";

// POST /api/store/init — creates store tables + seeds default categories.
// Idempotent (uses IF NOT EXISTS + ON CONFLICT), safe to hit repeatedly.
// Superadmin only.
export async function POST() {
  const guard = await guardAuth(["superadmin"]);
  if (guard instanceof NextResponse) return guard;
  try {
    // Categories (per module)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id     SERIAL PRIMARY KEY,
        name   TEXT NOT NULL,
        module TEXT NOT NULL DEFAULT 'machinery'
      )
    `);
    await db.execute(sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'machinery'`);
    await db.execute(sql`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS categories_module_name_key ON categories(module, name)`);

    // Parts (per module, with SKUs, images, machines, soft delete)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parts (
        id          SERIAL PRIMARY KEY,
        sku         TEXT,
        name        TEXT    NOT NULL,
        category    TEXT    NOT NULL,
        module      TEXT    NOT NULL DEFAULT 'machinery',
        unit        TEXT    NOT NULL DEFAULT 'pcs',
        qty         INTEGER NOT NULL DEFAULT 0,
        min_qty     INTEGER NOT NULL DEFAULT 0,
        description TEXT             DEFAULT ''
      )
    `);
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS sku TEXT`);
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'machinery'`);
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS machine TEXT DEFAULT ''`);
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS image_url TEXT`);
    // Consumables-only attributes (brand / supplier / rack location).
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT ''`);
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT ''`);
    await db.execute(sql`ALTER TABLE parts ADD COLUMN IF NOT EXISTS rack_no TEXT DEFAULT ''`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS parts_sku_active_unique_ci ON parts(LOWER(sku)) WHERE sku IS NOT NULL AND deleted_at IS NULL`);

    // Machines (per module)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS machines (
        id     SERIAL PRIMARY KEY,
        name   TEXT NOT NULL,
        module TEXT NOT NULL DEFAULT 'machinery'
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS machines_module_name_key ON machines(module, name)`);

    // Transactions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id        SERIAL  PRIMARY KEY,
        type      TEXT    NOT NULL CHECK (type IN ('in','out')),
        part_id   INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        qty       INTEGER NOT NULL,
        date      DATE    NOT NULL,
        ref       TEXT    DEFAULT '',
        notes     TEXT    DEFAULT '',
        issued_to TEXT    DEFAULT '',
        purpose   TEXT    DEFAULT ''
      )
    `);

    // Seed defaults only if categories is empty
    const existing = await db.execute(sql`SELECT COUNT(*)::int AS c FROM categories`);
    const count = Number((existing as any).rows?.[0]?.c ?? (existing as any)[0]?.c ?? 0);
    if (count === 0) {
      const defaults = ["Bearings", "Belts", "Seals", "Filters", "Fasteners", "Lubricants", "Electrical", "Hydraulics", "Other"];
      for (const name of defaults) {
        await db.execute(sql`INSERT INTO categories (name, module) VALUES (${name}, 'machinery') ON CONFLICT (module, name) DO NOTHING`);
      }
    }
    return NextResponse.json({ ok: true, message: "Store tables ready" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Init failed" }, { status: 500 });
  }
}
