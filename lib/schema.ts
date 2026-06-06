import { pgTable, serial, text, timestamp, integer, decimal, boolean, date } from 'drizzle-orm/pg-core';

// Departments
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Employees
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  cnic: text('cnic'),
  cnicExpiry: date('cnic_expiry'),
  address: text('address'),
  dateOfBirth: date('date_of_birth'),
  dateOfJoining: date('date_of_joining'),
  departmentId: integer('department_id'),
  designation: text('designation'),
  employmentType: text('employment_type'),
  status: text('status').default('active'),
  profilePhoto: text('profile_photo'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Employee Documents
export const employeeDocuments = pgTable('employee_documents', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  documentType: text('document_type').notNull(),
  fileUrl: text('file_url').notNull(),
  expiryDate: date('expiry_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Shifts
export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  workingHours: decimal('working_hours'),
});

// Attendance
export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  date: date('date').notNull(),
  checkIn: text('check_in'),
  checkOut: text('check_out'),
  status: text('status').default('present'),
  shiftId: integer('shift_id'),
  overtimeHours: decimal('overtime_hours').default('0'),
  lateMinutes: integer('late_minutes').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Leave Types
export const leaveTypes = pgTable('leave_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  daysAllowed: integer('days_allowed').notNull(),
  carryForward: boolean('carry_forward').default(false),
  isPaid: boolean('is_paid').default(true),
});

// Leave Requests
export const leaveRequests = pgTable('leave_requests', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  leaveTypeId: integer('leave_type_id').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  days: integer('days').notNull(),
  reason: text('reason'),
  status: text('status').default('pending'),
  approvedBy: integer('approved_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Leave Balances
export const leaveBalances = pgTable('leave_balances', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  leaveTypeId: integer('leave_type_id').notNull(),
  year: integer('year').notNull(),
  totalDays: integer('total_days').notNull(),
  usedDays: integer('used_days').default(0),
  remainingDays: integer('remaining_days').notNull(),
});

// Holidays
export const holidays = pgTable('holidays', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  date: date('date').notNull(),
  description: text('description'),
});

// Salary Structure
export const salaryStructures = pgTable('salary_structures', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  basicSalary: decimal('basic_salary').notNull(),
  housingAllowance: decimal('housing_allowance').default('0'),
  transportAllowance: decimal('transport_allowance').default('0'),
  medicalAllowance: decimal('medical_allowance').default('0'),
  otherAllowances: decimal('other_allowances').default('0'),
  effectiveFrom: date('effective_from').notNull(),
});

// Loans
export const loans = pgTable('loans', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  amount: decimal('amount').notNull(),
  reason: text('reason'),
  monthlyDeduction: decimal('monthly_deduction').notNull(),
  remainingAmount: decimal('remaining_amount').notNull(),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Payroll
export const payroll = pgTable('payroll', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  basicSalary: decimal('basic_salary').notNull(),
  totalAllowances: decimal('total_allowances').default('0'),
  overtimePay: decimal('overtime_pay').default('0'),
  grossSalary: decimal('gross_salary').notNull(),
  taxDeduction: decimal('tax_deduction').default('0'),
  loanDeduction: decimal('loan_deduction').default('0'),
  otherDeductions: decimal('other_deductions').default('0'),
  netSalary: decimal('net_salary').notNull(),
  status: text('status').default('draft'),
  generatedAt: timestamp('generated_at').defaultNow(),
});

// Contracts
export const contracts = pgTable('contracts', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull(),
  contractType: text('contract_type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: text('action').notNull(),
  tableName: text('table_name').notNull(),
  recordId: integer('record_id'),
  oldValues: text('old_values'),
  newValues: text('new_values'),
  createdAt: timestamp('created_at').defaultNow(),
});
