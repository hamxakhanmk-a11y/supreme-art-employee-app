import { getDesignation } from "./catalog";
import { monthlyValue, annual, ragFor, scoreFor, effectiveTarget, type Operands, type Rag } from "./compute";

export type ValueRow = { month: number; kpiIdx: number; inputKey: string; value: number | null };
export type TargetRow = { kpiIdx: number; target: number | null };

export type KpiResult = {
  idx: number;
  name: string;
  unit: string;
  formulaText: string;
  targetRaw: string;
  effTarget: number | null;
  monthly: (number | null)[]; // 12 entries, Jan..Dec
  annual: number | null;
  rag: Rag;
  score: number | null;
};

export type EmployeeYear = {
  templateCode: string;
  kpis: KpiResult[];
  overall: number | null;   // avg of per-KPI scores that have data (0–10)
  ragCounts: { green: number; amber: number; red: number; na: number };
};

// Compute a full year for one employee from their stored raw operands.
export function computeEmployeeYear(templateCode: string, values: ValueRow[], targets: TargetRow[]): EmployeeYear | null {
  const tpl = getDesignation(templateCode);
  if (!tpl) return null;

  // month -> kpiIdx -> inputKey -> value
  const byMonth = new Map<string, number>();
  for (const v of values) if (v.value !== null) byMonth.set(`${v.month}:${v.kpiIdx}:${v.inputKey}`, v.value);
  const overrides = new Map<number, number | null>();
  for (const t of targets) overrides.set(t.kpiIdx, t.target);

  const opsFor = (m: number, kpiIdx: number, inputs: { key: string }[]): Operands => {
    const o: Operands = {};
    for (const inp of inputs) {
      const k = `${m}:${kpiIdx}:${inp.key}`;
      o[inp.key] = byMonth.has(k) ? byMonth.get(k) : undefined;
    }
    return o;
  };

  const ragCounts = { green: 0, amber: 0, red: 0, na: 0 };
  const scores: number[] = [];
  const kpis: KpiResult[] = tpl.kpis.map(kpi => {
    const override = overrides.get(kpi.idx);
    const monthly = Array.from({ length: 12 }, (_, i) => monthlyValue(kpi.compute, kpi.inputs, opsFor(i + 1, kpi.idx, kpi.inputs)));
    const annualVal = annual(monthly, kpi.agg);
    const rag = ragFor(annualVal, kpi.target, override);
    const score = scoreFor(annualVal, kpi.target, override);
    ragCounts[rag]++;
    if (score !== null) scores.push(score);
    return {
      idx: kpi.idx, name: kpi.name, unit: kpi.unit, formulaText: kpi.formulaText,
      targetRaw: kpi.target.raw, effTarget: effectiveTarget(kpi.target, override),
      monthly, annual: annualVal, rag, score,
    };
  });

  return {
    templateCode,
    kpis,
    overall: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    ragCounts,
  };
}

export function mean(nums: (number | null)[]): number | null {
  const v = nums.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
