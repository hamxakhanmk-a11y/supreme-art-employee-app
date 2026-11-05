// An employee's salary and bank details are their own grants in the Access Register
// (Employees · Salary, Employees · Banking). Server code masks them out of whatever it sends a
// role without them, and leaves them untouched when such a role saves the employee.
import { grantsOf } from "./pageGuard";

export const SALARY_FIELDS = [
  "basicSalary", "conveyance", "houseRentPercent", "medicalPercent", "incomeTaxPercent", "incomeTaxAmount",
  "eobiEmployeePercent", "eobiEmployeeAmount", "eobiEmployerPercent", "eobiEmployerAmount",
  "minimumWage", "essiContribution", "accommodation", "food",
] as const;
export const BANK_FIELDS = ["bankName", "accountTitle", "accountNumber", "iban"] as const;

export interface EmployeeFieldAccess { salary: boolean; banking: boolean; editSalary: boolean; editBanking: boolean }

// `salaryModule`: the Salary section works from every employee's pay and bank details, so a role
// that has it sees them wherever it reads employees from (the slips page loads them from the API).
export async function employeeFieldAccess(opts: { salaryModule?: boolean } = {}): Promise<EmployeeFieldAccess> {
  const g = await grantsOf();
  const viaSalary = !!opts.salaryModule && g.see("salary");
  return {
    salary: viaSalary || g.see("employees.salary"),
    banking: viaSalary || g.see("employees.banking"),
    editSalary: g.edit("employees.salary"),
    editBanking: g.edit("employees.banking"),
  };
}

// A copy of the employee row with what the role may not see blanked.
export function maskEmployee<T extends Record<string, unknown>>(row: T, a: { salary: boolean; banking: boolean }): T {
  if (a.salary && a.banking) return row;
  const out: Record<string, unknown> = { ...row };
  if (!a.salary) for (const k of SALARY_FIELDS) out[k] = null;
  if (!a.banking) for (const k of BANK_FIELDS) out[k] = null;
  return out as T;
}

// What a save may write: salary / bank fields only for a role that may edit them, so a role
// without them neither sets nor wipes them.
export function writableEmployeeFields<T extends Record<string, unknown>>(values: T, a: { editSalary: boolean; editBanking: boolean }): T {
  const out: Record<string, unknown> = { ...values };
  if (!a.editSalary) for (const k of SALARY_FIELDS) delete out[k];
  if (!a.editBanking) for (const k of BANK_FIELDS) delete out[k];
  return out as T;
}
