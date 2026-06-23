// Pure salary-slip computations. Keeps server and client in lockstep.

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WORKING_DAYS_DENOMINATOR = 26;

// Pakistan minimum monthly wage (PKR). Used to compute the employer-side
// EOBI contribution (5% of minimum wage = 1850 PKR).
export const MIN_WAGE_PKR = 37000;

// Fixed not-deducted benefits the company pays for every employee.
export const ESSI_CONTRIBUTION = 2400;
export const EOBI_EMPLOYER_CONTRIBUTION = Math.round(MIN_WAGE_PKR * 0.05); // 1850

export interface SlipInputs {
  basicSalary: number;
  conveyance: number;
  // For Income Tax and EOBI Employee: if *Amount is > 0, it overrides the
  // percent calculation. Otherwise the percent of basic salary is used.
  incomeTaxPercent: number;
  incomeTaxAmount: number;
  eobiEmployeePercent: number;
  eobiEmployeeAmount: number;
  // EOBI Employer is configured per-employee (PKR). If 0, falls back to
  // the default 5% × min wage = PKR 1,850.
  eobiEmployerAmount: number;
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

  const incomeTaxAmt = Number(i.incomeTaxAmount) || 0;
  const eobiEmpAmt = Number(i.eobiEmployeeAmount) || 0;
  const incomeTax = incomeTaxAmt > 0
    ? incomeTaxAmt
    : Math.round(basic * (Number(i.incomeTaxPercent) || 0) / 100);
  // EOBI Employee percent is taken against the statutory minimum wage,
  // not the basic salary (PK convention: 1% of minimum wage). A fixed
  // PKR amount on the employee overrides the percent if provided.
  const eobiEmployee = eobiEmpAmt > 0
    ? eobiEmpAmt
    : Math.round(MIN_WAGE_PKR * (Number(i.eobiEmployeePercent) || 0) / 100);

  const grossEarnings = basic + conv + overtime;
  const absentDeduction = Math.round((basic / WORKING_DAYS_DENOMINATOR) * daysAbsent);
  const totalDeductions = incomeTax + eobiEmployee + absentDeduction + otherDed;
  const netPay = grossEarnings - totalDeductions;

  const essiContribution = ESSI_CONTRIBUTION;
  const eobiEmployerInput = Number(i.eobiEmployerAmount) || 0;
  const eobiEmployerContribution = eobiEmployerInput > 0 ? eobiEmployerInput : EOBI_EMPLOYER_CONTRIBUTION;
  const totalNotDeducted = essiContribution + eobiEmployerContribution + accommodation + food;

  return {
    grossEarnings,
    essiContribution, eobiEmployerContribution, accommodation, food, totalNotDeducted,
    incomeTax, eobiEmployee, absentDeduction, totalDeductions,
    netPay,
  };
}
