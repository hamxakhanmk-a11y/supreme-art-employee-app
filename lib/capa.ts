// CAPA — Corrective & Preventive Action Report.
// Ported from the Job Tracker app's standalone ("General") CAPA. Shared
// constants + types used by both the API routes and the client form.
import { sql } from "drizzle-orm";
import { db } from "./db";

// Where in the production flow the non-conformance was spotted. Free text is
// still allowed — these just populate the datalist.
export const CAPA_STAGES = [
  "Printing",
  "UV / Coating",
  "Embossing",
  "Die Cutting",
  "Sorting",
  "Pasting",
  "Delivery",
  "Inspection",
  "Storage",
];

// Root-cause category. Standard QMS set — keeping it consistent makes the
// exported data pivot cleanly.
export const CAPA_CATEGORIES = [
  "Material",
  "Machine",
  "Operator",
  "Process",
  "Method",
  "Environment",
];

export type CapaStatus = "open" | "in_progress" | "closed";

// A customer CAPA answers a customer's complaint; an internal CAPA is raised inside the factory
// (our own inspection, audit or a department's finding). Same form and numbering, tagged INTERNAL.
export type CapaType = "customer" | "internal";
export const CAPA_TYPES: CapaType[] = ["customer", "internal"];
export const CAPA_TYPE_META: Record<CapaType, { label: string; tag: string; fg: string; bg: string; border: string }> = {
  customer: { label: "Customer", tag: "CUSTOMER", fg: "#1e3a8a", bg: "#e0e7ff", border: "#c7d2fe" },
  internal: { label: "Internal", tag: "INTERNAL", fg: "#6b21a8", bg: "#f3e8ff", border: "#d8b4fe" },
};
export function capaTypeOf(v: unknown): CapaType {
  return v === "internal" ? "internal" : "customer";
}

export const CAPA_STATUS_META: Record<CapaStatus, { label: string; fg: string; bg: string }> = {
  open:        { label: "OPEN",        fg: "#991b1b", bg: "#fee2e2" },
  in_progress: { label: "IN PROGRESS", fg: "#92400e", bg: "#fef3c7" },
  closed:      { label: "CLOSED",      fg: "#065f46", bg: "#d1fae5" },
};

// Every free-form field on the report. Stored as JSON in capa_reports.data.
export interface CapaData {
  // 1. Company details
  company_name?: string;
  contact_person?: string;
  job_name?: string;
  ref_no?: string;
  // 2. Problem description
  problem_description?: string;
  detected_at_stage?: string;
  detected_by?: string;
  detection_date?: string;
  // 3. Root cause analysis
  root_cause?: string;
  category?: string;
  analysis_done_by?: string;
  analysis_date?: string;
  // 4. Actions
  corrective_action?: string;
  preventive_action?: string;
  action_date?: string;
  action_by?: string;
  // 5. Verification & closure
  verification?: string;
  verified_by?: string;
  verification_date?: string;
  prepared_by?: string;
  prepared_date?: string;
  reviewed_by?: string;
  reviewed_date?: string;
  approved_by?: string;
  approved_date?: string;
  ceo_note?: string;
}

export interface CapaRow {
  id: number;
  capaRef: string;
  seq: number;
  year: number;
  status: string;
  capaType: string;
  issueDate: string | null;
  data: string;
  createdByName: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  closedAt: string | Date | null;
}

export function parseCapaData(raw: string | null | undefined): CapaData {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// CAPA-2026-01 — zero-padded to two digits, rolls over per calendar year.
export function buildCapaRef(year: number, seq: number): string {
  return `CAPA-${year}-${String(seq).padStart(2, "0")}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return String(d);
  }
}

export const CAPA_FORM_REV = "Form Rev: 01";
export const CAPA_FOOTER_NOTE = "This document is confidential and for internal use only.";
// Document-control number printed on every CAPA report (screen + print).
export const CAPA_DOC_NO = "QMR/QR/004";

// Idempotent runtime migration — same approach as ensureProcurementTables(),
// so a fresh deployment doesn't need a manual migration step.
let ensured = false;
export async function ensureCapaTable() {
  if (ensured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS capa_reports (
      id serial PRIMARY KEY,
      capa_ref varchar(40) NOT NULL,
      seq integer NOT NULL,
      year integer NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'open',
      issue_date date,
      data text NOT NULL DEFAULT '{}',
      created_by_user_id integer,
      created_by_name varchar(120),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      closed_at timestamp
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS capa_reports_status_idx ON capa_reports(status)`);
  // Added later: customer / internal. Every CAPA before it was a customer one.
  await db.execute(sql`ALTER TABLE capa_reports ADD COLUMN IF NOT EXISTS capa_type varchar(20) NOT NULL DEFAULT 'customer'`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS capa_reports_year_seq_uidx ON capa_reports(year, seq)`);
  ensured = true;
}
