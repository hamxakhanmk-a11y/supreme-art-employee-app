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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id   SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parts (
        id          SERIAL PRIMARY KEY,
        name        TEXT    NOT NULL,
        category    TEXT    NOT NULL,
        unit        TEXT    NOT NULL DEFAULT 'pcs',
        qty         INTEGER NOT NULL DEFAULT 0,
        min_qty     INTEGER NOT NULL DEFAULT 0,
        description TEXT             DEFAULT ''
      )
    `);
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

    // Seed defaults only if categories is empty (matches old app behaviour).
    const existing = await db.execute(sql`SELECT COUNT(*)::int AS c FROM categories`);
    const count = Number((existing as any).rows?.[0]?.c ?? (existing as any)[0]?.c ?? 0);
    if (count === 0) {
      const defaults = ["Bearings", "Inks", "Belts", "Seals", "Filters", "Fasteners", "Lubricants", "Electrical", "Hydraulics", "Other"];
      for (const name of defaults) {
        await db.execute(sql`INSERT INTO categories (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`);
      }
    }
    return NextResponse.json({ ok: true, message: "Store tables ready" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Init failed" }, { status: 500 });
  }
}
