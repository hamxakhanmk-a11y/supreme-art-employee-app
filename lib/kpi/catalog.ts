import catalogJson from "./catalog.json";

// One measurable input (operand) HR types each month, e.g. "Invoices On Time".
// type "date" operands are entered as a calendar date and stored as an epoch-day
// number, so a subtraction of two of them yields a count of days.
export type KpiInput = { key: string; label: string; type?: "number" | "date" };

// How the monthly value is computed from its operand inputs.
export type ComputeType =
  | "ratio_pct"    // a / b × 100
  | "growth_pct"   // (a − b) / b × 100   (current, prior)
  | "net_self_pct" // (a − b) / a × 100   (e.g. (Invoices − Errors) / Invoices)
  | "net_pct"      // (a − b) / c × 100   (separate total denominator)
  | "abs_dev_pct"  // |a − b| / b × 100   (e.g. Forecast Accuracy)
  | "ratio_x10"    // a / b × 10
  | "ratio"        // a / b               (e.g. total ÷ count)
  | "avg_diff"     // (a − b) / c         (Sum(a−b) ÷ N)
  | "diff"         // a − b
  | "sum_terms"    // a + b + c …
  | "product"      // a × b
  | "product_pct"  // a × b × c … (each %) → %
  | "count"        // a single count entered directly
  | "single";      // a single value entered directly

// Parsed target, e.g. "≥ 15%" → { op: ">=", value: 15 }.
// Qualitative targets ("≥ Budget", "Increases QoQ") carry no number until HR
// sets one, so RAG/score are shown as n/a for them unless overridden.
export type KpiTarget = {
  op: ">=" | "<=" | ">" | "<" | null;
  value: number | null;
  qualitative: boolean;
  raw: string;
};

export type KpiDef = {
  idx: number;
  name: string;
  formulaText: string;
  unit: string;
  agg: "AVERAGE" | "SUM";
  compute: ComputeType;
  inputs: KpiInput[];
  target: KpiTarget;
};

export type Designation = {
  code: string;       // e.g. "FIN"
  sheet: string;      // original Excel sheet name
  title: string;      // e.g. "Finance Manager"
  department: string; // e.g. "Finance"
  kpis: KpiDef[];
};

const CATALOG = (catalogJson as { designations: Designation[] }).designations;

export function allDesignations(): Designation[] {
  return CATALOG;
}

export function getDesignation(code: string): Designation | undefined {
  return CATALOG.find(d => d.code === code);
}

// Designations grouped by department, in catalog order.
export function byDepartment(): { department: string; designations: Designation[] }[] {
  const order: string[] = [];
  const map = new Map<string, Designation[]>();
  for (const d of CATALOG) {
    if (!map.has(d.department)) { map.set(d.department, []); order.push(d.department); }
    map.get(d.department)!.push(d);
  }
  return order.map(department => ({ department, designations: map.get(department)! }));
}

export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
