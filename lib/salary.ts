// Pure salary-slip computations. Keeps server and client in lockstep.

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WORKING_DAYS_DENOMINATOR = 26;

export interface SlipInputs {
  basicSalary: number;
  conveyance: number;
  houseRentPercent: number;
  medicalPercent: number;
  incomeTaxPercent: number;
  eobiEmployeePercent: number;
  eobiEmployerPercent: number;
  overtime: number;
  otherDeduction: number;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
}

export interface SlipComputed {
  houseRent: number;
  medical: number;
  grossEarnings: number;
  incomeTax: number;
  eobiEmployee: number;
  eobiEmployer: number;
  absentDeduction: number;
  totalDeductions: number;
  netPay: number;
}

export function computeSlip(i: SlipInputs): SlipComputed {
  const basic = Number(i.basicSalary) || 0;
  const conv = Number(i.conveyance) || 0;
  const overtime = Number(i.overtime) || 0;
  const otherDed = Number(i.otherDeduction) || 0;
  const daysAbsent = Number(i.daysAbsent) || 0;

  const houseRent = Math.round(basic * (Number(i.houseRentPercent) || 0) / 100);
  const medical = Math.round(basic * (Number(i.medicalPercent) || 0) / 100);
  const incomeTax = Math.round(basic * (Number(i.incomeTaxPercent) || 0) / 100);
  const eobiEmployee = Math.round(basic * (Number(i.eobiEmployeePercent) || 0) / 100);
  const eobiEmployer = Math.round(basic * (Number(i.eobiEmployerPercent) || 0) / 100);

  const grossEarnings = basic + houseRent + medical + conv + overtime;
  const absentDeduction = Math.round((basic / WORKING_DAYS_DENOMINATOR) * daysAbsent);
  const totalDeductions = incomeTax + eobiEmployee + eobiEmployer + absentDeduction + otherDed;
  const netPay = grossEarnings - totalDeductions;

  return { houseRent, medical, grossEarnings, incomeTax, eobiEmployee, eobiEmployer, absentDeduction, totalDeductions, netPay };
}
