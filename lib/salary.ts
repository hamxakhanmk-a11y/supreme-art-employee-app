// Pure salary-slip computations. Keeps server and client in lockstep.

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WORKING_DAYS_DENOMINATOR = 26;

// Default Pakistan minimum monthly wage and ESSI used when an employee's
// per-employee value is missing. Both are editable on the employee profile.
export const DEFAULT_MIN_WAGE_PKR = 37000;
export const DEFAULT_ESSI_CONTRIBUTION = 2400;

export interface SlipInputs {
  basicSalary: number;
  conveyance: number;
  // Per-employee minimum wage. EOBI Employee % is computed against this.
  minimumWage: number;
  // For Income Tax and EOBI Employee: if *Amount is > 0, it overrides the
  // percent calculation. Otherwise the percent is used (income tax of basic,
  // EOBI of minimum wage).
  incomeTaxPercent: number;
  incomeTaxAmount: number;
  eobiEmployeePercent: number;
  eobiEmployeeAmount: number;
  // EOBI Employer is configured per-employee (PKR).
  eobiEmployerAmount: number;
  // ESSI / Social Security per-employee employer contribution (PKR).
  essiContribution: number;
  accommodation: number;
  food: number;
  overtime: number;
  otherDeduction: number;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
}

export interface SlipComputed {
  grossEarnings: number;
  // Not-deducted (informational benefits, do not affect net pay)
  essiContribution: number;
  eobiEmployerContribution: number;
  accommodation: number;
  food: number;
  totalNotDeducted: number;
  // Deductions
  incomeTax: number;
  eobiEmployee: number;
  absentDeduction: number;
  totalDeductions: number;
  // Net
  netPay: number;
}

export function computeSlip(i: SlipInputs): SlipComputed {
  const basic = Number(i.basicSalary) || 0;
  const conv = Number(i.conveyance) || 0;
  const overtime = Number(i.overtime) || 0;
  const otherDed = Number(i.otherDeduction) || 0;
  const daysAbsent = Number(i.daysAbsent) || 0;
  const accommodation = Number(i.accommodation) || 0;
  const food = Number(i.food) || 0;
  const minWage = Number(i.minimumWage) || DEFAULT_MIN_WAGE_PKR;

  const incomeTaxAmt = Number(i.incomeTaxAmount) || 0;
  const eobiEmpAmt = Number(i.eobiEmployeeAmount) || 0;
  const incomeTax = incomeTaxAmt > 0
    ? incomeTaxAmt
    : Math.round(basic * (Number(i.incomeTaxPercent) || 0) / 100);
  // EOBI Employee percent is taken against the employee's minimum wage,
  // not the basic salary (PK convention: 1% of minimum wage). A fixed
  // PKR amount on the employee overrides the percent if provided.
  const eobiEmployee = eobiEmpAmt > 0
    ? eobiEmpAmt
    : Math.round(minWage * (Number(i.eobiEmployeePercent) || 0) / 100);

  const grossEarnings = basic + conv + overtime;
  const absentDeduction = Math.round((basic / WORKING_DAYS_DENOMINATOR) * daysAbsent);
  const totalDeductions = incomeTax + eobiEmployee + absentDeduction + otherDed;
  const netPay = grossEarnings - totalDeductions;

  const essiContribution = Number(i.essiContribution) || 0;
  const eobiEmployerContribution = Number(i.eobiEmployerAmount) || 0;
  const totalNotDeducted = essiContribution + eobiEmployerContribution + accommodation + food;

  return {
    grossEarnings,
    essiContribution, eobiEmployerContribution, accommodation, food, totalNotDeducted,
    incomeTax, eobiEmployee, absentDeduction, totalDeductions,
    netPay,
  };
}
