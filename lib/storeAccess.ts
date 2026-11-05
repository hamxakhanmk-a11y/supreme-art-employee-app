// The Store's two sections — Machinery and Consumables — are each a row in the Access Register
// (Store · Machinery, Store · Consumables). The store's APIs check the section a request touches:
// the `module` it names, or the module of the parts / entries it changes.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { getPerm, type ModuleKey } from "./permissions";

export type StoreModule = "machinery" | "consumables";
export const STORE_MODULES: StoreModule[] = ["machinery", "consumables"];
const LABEL: Record<StoreModule, string> = { machinery: "Machinery", consumables: "Consumables" };

export function normalizeStoreModule(m: unknown): StoreModule {
  return m === "consumables" ? "consumables" : "machinery";
}

// The store sections this role can open (both for the Super Admin; none without the Store itself).
export async function storeModulesFor(role: string): Promise<StoreModule[]> {
  if (role === "superadmin") return [...STORE_MODULES];
  const p = await getPerm(role);
  if (!p.modules.includes("store")) return [];
  return STORE_MODULES.filter(m => p.modules.includes(`store.${m}` as ModuleKey));
}

function denied(mod: StoreModule) {
  return NextResponse.json({ error: `Your role doesn't have access to the ${LABEL[mod]} store.` }, { status: 403 });
}

// A request that names its section.
export async function storeModuleDenied(user: { role: string }, mod: unknown): Promise<NextResponse | null> {
  const m = normalizeStoreModule(mod);
  return (await storeModulesFor(user.role)).includes(m) ? null : denied(m);
}

const rowsOf = (r: unknown): Record<string, unknown>[] => ((r as { rows?: unknown[] }).rows ?? r) as Record<string, unknown>[];

async function deniedFor(user: { role: string }, modules: unknown[]): Promise<NextResponse | null> {
  if (user.role === "superadmin") return null;
  const allowed = await storeModulesFor(user.role);
  for (const m of modules) { const mod = normalizeStoreModule(m); if (!allowed.includes(mod)) return denied(mod); }
  return null;
}

// A request that changes parts by id.
export async function storePartsDenied(user: { role: string }, partIds: number[]): Promise<NextResponse | null> {
  const ids = partIds.filter(n => Number.isFinite(n) && n > 0);
  if (!ids.length || user.role === "superadmin") return null;
  const rows = rowsOf(await db.execute(sql`SELECT DISTINCT module FROM parts WHERE id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`));
  return deniedFor(user, rows.map(r => r.module));
}

// A request that changes stock entries by id.
export async function storeTxnsDenied(user: { role: string }, txnIds: number[]): Promise<NextResponse | null> {
  const ids = txnIds.filter(n => Number.isFinite(n) && n > 0);
  if (!ids.length || user.role === "superadmin") return null;
  const rows = rowsOf(await db.execute(sql`
    SELECT DISTINCT p.module FROM transactions t JOIN parts p ON p.id = t.part_id
    WHERE t.id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`));
  return deniedFor(user, rows.map(r => r.module));
}
