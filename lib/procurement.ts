// Shared helpers for the Procurement module (Demand → PO → GRN).
// Line items live as JSON in each form's `items` column.
import { sql } from "drizzle-orm";
import { db } from "./db";

export type Stage = "demand" | "po" | "grn";

export interface DemandItem { srNo: number; material: string; requiredFor: string; quantity: string; remarks: string }
export interface PoItem { srNo: number; item: string; specifications: string; quality: string; quantity: string }
export interface GrnItem { srNo: number; gatePassNo: string; supplierName: string; item: string; quantity: string; remarks: string }

// Document-control code + title printed at the top of each form.
export const FORM_META = {
  demand: { code: "PUR/QR/005", title: "MATERIAL DEMAND FORM" },
  po:     { code: "PUR/QR/006", title: "PURCHASE ORDER" },
  grn:    { code: "STR/QR/003", title: "GOODS RECEIVING REPORT" },
} as const;

export const PO_DEFAULT_REMARKS =
  "Send us this order as soon as possible. Your quick response will be highly appreciated.";

export function parseItems<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}/${m}/${y}` : d;
}

// Idempotently create the three tables — lets production self-migrate on first
// use, since the prod DB URL isn't available locally.
let ensured = false;
export async function ensureProcurementTables() {
  if (ensured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS demands (
      id serial PRIMARY KEY,
      demand_no integer NOT NULL,
      date date NOT NULL,
      required_by date,
      demand_by varchar(160),
      department varchar(120),
      prepared_by varchar(120),
      approved_by varchar(120),
      section_incharge varchar(120),
      items text NOT NULL DEFAULT '[]',
      status varchar(20) NOT NULL DEFAULT 'open',
      created_by_user_id integer,
      created_by_name varchar(120),
      created_at timestamp NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id serial PRIMARY KEY,
      po_no integer NOT NULL,
      demand_id integer,
      demand_no integer,
      date date NOT NULL,
      demand_by_name varchar(160),
      supplier_name varchar(200),
      expected_date date,
      order_placed_by varchar(120),
      approved_by varchar(120),
      remarks text,
      items text NOT NULL DEFAULT '[]',
      status varchar(20) NOT NULL DEFAULT 'open',
      created_by_user_id integer,
      created_by_name varchar(120),
      created_at timestamp NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS grns (
      id serial PRIMARY KEY,
      grn_no integer NOT NULL,
      po_id integer,
      po_no integer,
      date date NOT NULL,
      received_by varchar(120),
      verified_by varchar(120),
      items text NOT NULL DEFAULT '[]',
      created_by_user_id integer,
      created_by_name varchar(120),
      created_at timestamp NOT NULL DEFAULT now()
    )`);
  ensured = true;
}
