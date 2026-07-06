import type { ComputeType, KpiDef, KpiTarget } from "./catalog";

// A month's operand values for one KPI, keyed by input key. Missing/blank
// entries are undefined so we can tell "not entered" from a real 0.
export type Operands = Record<string, number | undefined>;

// Compute one month's KPI value from its operands. Returns null when the
// required inputs weren't entered (so the month is treated as "no data").
export function monthlyValue(compute: ComputeType, inputs: { key: string }[], ops: Operands): number | null {
  const v = inputs.map(i => ops[i.key]);
  const has = (n: number) => v.slice(0, n).every(x => typeof x === "number" && !isNaN(x));
  const num = (x: number | undefined) => x as number;

  switch (compute) {
    case "ratio_pct":
      if (!has(2) || num(v[1]) === 0) return null;
      return (num(v[0]) / num(v[1])) * 100;
    case "growth_pct":
      if (!has(2) || num(v[1]) === 0) return null;
      return ((num(v[0]) - num(v[1])) / num(v[1])) * 100;
    case "net_self_pct":
      if (!has(2) || num(v[0]) === 0) return null;
      return ((num(v[0]) - num(v[1])) / num(v[0])) * 100;
    case "net_pct":
      if (!has(3) || num(v[2]) === 0) return null;
      return ((num(v[0]) - num(v[1])) / num(v[2])) * 100;
    case "abs_dev_pct":
      if (!has(2) || num(v[1]) === 0) return null;
      return (Math.abs(num(v[0]) - num(v[1])) / num(v[1])) * 100;
    case "ratio_x10":
      if (!has(2) || num(v[1]) === 0) return null;
      return (num(v[0]) / num(v[1])) * 10;
    case "ratio":
      if (!has(2) || num(v[1]) === 0) return null;
      return num(v[0]) / num(v[1]);
    case "avg_diff":
      if (!has(3) || num(v[2]) === 0) return null;
      return (num(v[0]) - num(v[1])) / num(v[2]);
    case "diff":
      if (!has(2)) return null;
      return num(v[0]) - num(v[1]);
    case "sum_terms": {
      const present = v.filter(x => typeof x === "number" && !isNaN(x)) as number[];
      if (present.length === 0) return null;
      return present.reduce((a, b) => a + b, 0);
    }
    case "product":
      if (!has(2)) return null;
      return num(v[0]) * num(v[1]);
    case "product_pct": {
      // Each operand is a percentage (e.g. 90 = 90%); product of n percentages
      // stays a percentage: 90 × 90 × 90 / 100^(n-1).
      if (!has(inputs.length)) return null;
      const prod = v.reduce((a, b) => (a as number) * (b as number), 1) as number;
      return prod / Math.pow(100, inputs.length - 1);
    }
    case "count":
    case "single":
      return typeof v[0] === "number" && !isNaN(v[0]) ? num(v[0]) : null;
  }
}

export type Rag = "green" | "amber" | "red" | "na";

// Effective numeric target: the parsed value, or a manual override for
// qualitative targets ("≥ Budget"). Higher-is-better when op is >=/>.
function higherIsBetter(op: KpiTarget["op"]): boolean {
  return op === ">=" || op === ">" || op === null;
}

export function effectiveTarget(target: KpiTarget, override?: number | null): number | null {
  if (typeof override === "number" && !isNaN(override)) return override;
  return target.qualitative ? null : target.value;
}

// 🟢 on target · 🟡 within 10% · 🔴 off target (per the workbook's Instructions).
export function ragFor(actual: number | null, target: KpiTarget, override?: number | null): Rag {
  const t = effectiveTarget(target, override);
  if (actual === null || t === null) return "na";
  if (higherIsBetter(target.op)) {
    if (actual >= t) return "green";
    if (actual >= t * 0.9) return "amber";
    return "red";
  } else {
    if (t === 0) return actual <= 0 ? "green" : "red";
    if (actual <= t) return "green";
    if (actual <= t * 1.1) return "amber";
    return "red";
  }
}

// Continuous 0–10 score: 10 at (or better than) target, scaling down as it
// misses. Higher-better = actual/target; lower-better = target/actual.
export function scoreFor(actual: number | null, target: KpiTarget, override?: number | null): number | null {
  const t = effectiveTarget(target, override);
  if (actual === null || t === null) return null;
  const clamp = (x: number) => Math.max(0, Math.min(10, x));
  if (higherIsBetter(target.op)) {
    if (t === 0) return actual >= 0 ? 10 : 0;
    return clamp((actual / t) * 10);
  } else {
    if (t === 0) return actual <= 0 ? 10 : 0;
    if (actual <= 0) return 10;
    return clamp((t / actual) * 10);
  }
}

// Annual figure = AVERAGE or SUM of the entered months (blank months ignored).
export function annual(monthly: (number | null)[], agg: KpiDef["agg"]): number | null {
  const vals = monthly.filter((x): x is number => x !== null);
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return agg === "SUM" ? sum : sum / vals.length;
}

export const RAG_EMOJI: Record<Rag, string> = { green: "🟢", amber: "🟡", red: "🔴", na: "—" };
export const RAG_COLOR: Record<Rag, string> = { green: "#15803D", amber: "#D97706", red: "#DC2626", na: "#94a3b8" };
