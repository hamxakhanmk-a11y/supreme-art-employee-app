import {
  pgTable,
  serial,
  varchar,
  text,
  date,
  timestamp,
  integer,
  boolean,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// =====================
// EMPLOYEES (master)
// =====================
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id", { length: 20 }).notNull().unique(),

  // Personal
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  fatherName: varchar("father_name", { length: 120 }),
  dob: date("dob"),
  gender: varchar("gender", { length: 12 }),
  maritalStatus: varchar("marital_status", { length: 12 }),
  nationality: varchar("nationality", { length: 60 }),
  religion: varchar("religion", { length: 40 }),
  bloodGroup: varchar("blood_group", { length: 6 }),

  // Identification
  cnic: varchar("cnic", { length: 20 }),
  cnicExpiry: date("cnic_expiry"),
  passportNumber: varchar("passport_number", { length: 30 }),
  passportExpiry: date("passport_expiry"),
  ssiNumber: varchar("ssi_number", { length: 40 }),
  ssiExpiry: date("ssi_expiry"),
  ubiNumber: varchar("ubi_number", { length: 40 }),
  ubiExpiry: date("ubi_expiry"),

  // Contact
  phone: varchar("phone", { length: 25 }),
  altPhone: varchar("alt_phone", { length: 25 }),
  email: varchar("email", { length: 120 }),
  currentAddress: text("current_address"),
  permanentAddress: text("permanent_address"),
  city: varchar("city", { length: 60 }),

  // Emergency
  emergencyName: varchar("emergency_name", { length: 120 }),
  emergencyRelation: varchar("emergency_relation", { length: 40 }),
  emergencyPhone: varchar("emergency_phone", { length: 25 }),

  // Job
  designation: varchar("designation", { length: 80 }),
  department: varchar("department", { length: 60 }),
  joiningDate: date("joining_date"),
  employmentType: varchar("employment_type", { length: 20 }),
  reportingManager: varchar("reporting_manager", { length: 120 }),
  workLocation: varchar("work_location", { length: 80 }),
  shift: varchar("shift", { length: 30 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  contractExpiry: date("contract_expiry"),
  resignationDate: date("resignation_date"),
  // Short numeric PIN the employee types at the Station terminal to punch
  // hourly (mid-day) leaves in/out. Unique among employees.
  stationPin: varchar("station_pin", { length: 6 }),
  // Manually-assigned KPI template code (a designation code from lib/kpi/catalog,
  // e.g. "FIN"). Null = employee is not KPI-tracked.
  kpiTemplate: varchar("kpi_template", { length: 10 }),

  // Compensation
  basicSalary: integer("basic_salary"),
  conveyance: integer("conveyance").default(0),
  houseRentPercent: integer("house_rent_percent").default(0),
  medicalPercent: integer("medical_percent").default(0),
  incomeTaxPercent: integer("income_tax_percent").default(0),
  incomeTaxAmount: integer("income_tax_amount").default(0),
  eobiEmployeePercent: integer("eobi_employee_percent").default(0),
  eobiEmployeeAmount: integer("eobi_employee_amount").default(0),
  eobiEmployerPercent: integer("eobi_employer_percent").default(0),
  eobiEmployerAmount: integer("eobi_employer_amount").default(1850),
  // Per-employee minimum wage (PKR). EOBI % is computed against this, not basic.
  minimumWage: integer("minimum_wage").default(37000),
  // Per-employee ESSI / Social Security employer contribution (PKR).
  essiContribution: integer("essi_contribution").default(2400),
  accommodation: integer("accommodation").default(0),
  food: integer("food").default(0),

  // Banking
  bankName: varchar("bank_name", { length: 80 }),
  accountTitle: varchar("account_title", { length: 120 }),
  accountNumber: varchar("account_number", { length: 40 }),
  iban: varchar("iban", { length: 40 }),

  // Document URLs
  photoUrl: text("photo_url"),
  cnicFrontUrl: text("cnic_front_url"),
  cnicBackUrl: text("cnic_back_url"),
  passportUrl: text("passport_url"),
  ssiUrl: text("ssi_url"),
  ubiUrl: text("ubi_url"),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =====================
// EDUCATION (one-to-many)
// =====================
export const educationRecords = pgTable("education_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  degree: varchar("degree", { length: 100 }).notNull(),
  institution: varchar("institution", { length: 160 }),
  yearCompleted: varchar("year_completed", { length: 10 }),
  grade: varchar("grade", { length: 30 }),
  certificateUrl: text("certificate_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// ATTENDANCE
// =====================
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("present"), // present | absent | leave | half-day | late
  checkIn: varchar("check_in", { length: 8 }),    // HH:MM
  checkOut: varchar("check_out", { length: 8 }),  // HH:MM
  // Hourly (mid-day) leave taken during the shift, in minutes.
  // Official leave is excused (no deduction); personal leave is deducted
  // from worked time exactly like lateness.
  officialLeaveMin: integer("official_leave_min").notNull().default(0),
  personalLeaveMin: integer("personal_leave_min").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =====================
// ACTIVITY LOG (audit trail)
// =====================
// One row per meaningful write: who did what, optionally to which employee.
// employeeId is a plain integer (no FK) so history survives employee deletion;
// userName is snapshotted for the same reason.
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: varchar("user_name", { length: 120 }).notNull(),
  action: varchar("action", { length: 40 }).notNull(), // e.g. "attendance.mark"
  employeeId: integer("employee_id"),
  summary: text("summary").notNull(), // human-readable sentence
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// STATION LEAVES (hourly in/out punches at the Station terminal)
// =====================
// One row per "trip" outside the factory. outAt is set when the employee
// punches out; inAt is filled when they punch back in (null = still out).
// minutes is the closed duration (round((inAt-outAt)/60s)); only "personal"
// minutes are deducted from worked hours — "official" is excused.
export const stationLeaves = pgTable("station_leaves", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),                 // local day of the punch-out
  outAt: timestamp("out_at", { withTimezone: true }).notNull(),
  inAt: timestamp("in_at", { withTimezone: true }),
  type: varchar("type", { length: 12 }).notNull().default("personal"), // personal | official
  minutes: integer("minutes"),                  // filled on punch-in
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// PURCHASE REQUISITIONS (PR Register)
// =====================
// Mirrors the columns of the company's Excel "PR REGISTER" sheet.
export const purchaseRequisitions = pgTable("purchase_requisitions", {
  id: serial("id").primaryKey(),
  // Sequential requisition number. NOT unique: one PR can span several item
  // rows (e.g. PR 121 has 10 items in the legacy register), and a few legacy
  // rows have no number at all.
  prNo: integer("pr_no"),
  date: date("date"),                              // requisition date (missing on some legacy rows)
  department: varchar("department", { length: 60 }),
  concernedPerson: varchar("concerned_person", { length: 120 }),
  category: varchar("category", { length: 60 }),
  itemName: text("item_name"),
  quantity: doublePrecision("quantity"),
  uom: varchar("uom", { length: 20 }),             // unit of measure
  receivedByAdmin: boolean("received_by_admin").notNull().default(false), // requisition received by HR & Admin
  value: integer("value"),                         // PKR
  requiredDate: date("required_date"),
  hodApproval: varchar("hod_approval", { length: 20 }), // Approved | Not Approved | null (pending)
  hrApproval: varchar("hr_approval", { length: 20 }),   // HR's own decision: Approved | Rejected | null (pending)
  status: varchar("status", { length: 30 }).notNull().default("PR Raised"), // PR Raised | Approved | Material Received | Closed
  poNo: varchar("po_no", { length: 40 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =====================
// KPI VALUES (per employee, per month, raw operand inputs)
// =====================
// One row per operand HR types: (employee, year, month, kpiIdx, inputKey) -> value.
// kpiIdx/inputKey are relative to the employee's assigned template in
// lib/kpi/catalog. templateCode is stored so historical values stay aligned
// even if the employee's template assignment later changes.
export const kpiValues = pgTable("kpi_values", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  templateCode: varchar("template_code", { length: 10 }).notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),   // 1-12
  kpiIdx: integer("kpi_idx").notNull(),
  inputKey: varchar("input_key", { length: 40 }).notNull(),
  value: doublePrecision("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uq: uniqueIndex("kpi_values_uq").on(t.employeeId, t.year, t.month, t.kpiIdx, t.inputKey),
}));

// Per-employee numeric target override for qualitative targets ("≥ Budget").
export const kpiTargets = pgTable("kpi_targets", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  kpiIdx: integer("kpi_idx").notNull(),
  target: doublePrecision("target"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uq: uniqueIndex("kpi_targets_uq").on(t.employeeId, t.year, t.kpiIdx),
}));

// Tracks which dates have been "closed" by admin
export const attendanceDays = pgTable("attendance_days", {
  date: date("date").primaryKey(),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
  closedBy: varchar("closed_by", { length: 80 }),
});

// =====================
// LEAVE TYPES
// =====================
export const leaveTypes = pgTable("leave_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull().unique(),
  daysAllowed: integer("days_allowed").notNull().default(0),
  isPaid: boolean("is_paid").notNull().default(true),
  color: varchar("color", { length: 16 }).default("#185FA5"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// SALARY RECORDS (generated slip snapshot)
// =====================
export const salaryRecords = pgTable("salary_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 20 }).notNull(),
  monthNum: integer("month_num"),
  year: integer("year").notNull(),
  // Employee snapshot
  employeeCode: varchar("employee_code", { length: 20 }),
  employeeName: varchar("employee_name", { length: 160 }),
  designation: varchar("designation", { length: 80 }),
  department: varchar("department", { length: 60 }),
  // Structure snapshot
  basicSalary: integer("basic_salary").notNull().default(0),
  conveyance: integer("conveyance").notNull().default(0),
  houseRentPercent: integer("house_rent_percent").notNull().default(0),
  medicalPercent: integer("medical_percent").notNull().default(0),
  incomeTaxPercent: integer("income_tax_percent").notNull().default(0),
  incomeTaxAmount: integer("income_tax_amount").notNull().default(0),
  eobiEmployeePercent: integer("eobi_employee_percent").notNull().default(0),
  eobiEmployeeAmount: integer("eobi_employee_amount").notNull().default(0),
  eobiEmployerPercent: integer("eobi_employer_percent").notNull().default(0),
  eobiEmployerAmount: integer("eobi_employer_amount").notNull().default(0),
  // Snapshot of statutory minimum wage at the time of slip generation —
  // used to recompute EOBI when reading historical slips.
  minimumWage: integer("minimum_wage").notNull().default(37000),
  // Per-slip inputs
  overtime: integer("overtime").notNull().default(0),
  otherDeduction: integer("other_deduction").notNull().default(0),
  // Attendance
  daysPresent: integer("days_present").notNull().default(0),
  daysAbsent: integer("days_absent").notNull().default(0),
  daysLeave: integer("days_leave").notNull().default(0),
  weekOffs: integer("week_offs").notNull().default(0),
  // Computed amounts
  houseRent: integer("house_rent").notNull().default(0),
  medical: integer("medical").notNull().default(0),
  grossEarnings: integer("gross_earnings").notNull().default(0),
  incomeTax: integer("income_tax").notNull().default(0),
  eobiEmployee: integer("eobi_employee").notNull().default(0),
  eobiEmployer: integer("eobi_employer").notNull().default(0),
  absentDeduction: integer("absent_deduction").notNull().default(0),
  totalDeductions: integer("total_deductions").notNull().default(0),
  netPay: integer("net_pay").notNull().default(0),
  // Not-deducted benefits (informational on slip)
  accommodation: integer("accommodation").notNull().default(0),
  food: integer("food").notNull().default(0),
  essiContribution: integer("essi_contribution").notNull().default(0),
  eobiEmployerContribution: integer("eobi_employer_contribution").notNull().default(0),
  totalNotDeducted: integer("total_not_deducted").notNull().default(0),
  // Meta
  notes: text("notes"),
  generatedBy: varchar("generated_by", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// LEAVE REQUESTS
// =====================
export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  leaveTypeId: integer("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: integer("days").notNull(),
  halfSegment: varchar("half_segment", { length: 20 }), // 'first' | 'second' | null
  reason: text("reason"),
  dutiesAssignedTo: text("duties_assigned_to"),
  medicalCertAttached: varchar("medical_cert_attached", { length: 4 }), // yes | no | null
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | approved | rejected
  decidedAt: timestamp("decided_at"),
  decidedBy: varchar("decided_by", { length: 80 }),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =====================
// OTHER DOCUMENTS (one-to-many)
// =====================
export const otherDocuments = pgTable("other_documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 120 }).notNull(),
  url: text("url").notNull(),
  category: varchar("category", { length: 20 }), // 'leave-form' | 'half-day-form' | 'misc' | null
  formDate: date("form_date"),                    // when the form was filed (signed)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// EXPERIENCE (one-to-many)
// =====================
export const experienceRecords = pgTable("experience_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  company: varchar("company", { length: 160 }).notNull(),
  position: varchar("position", { length: 100 }),
  fromDate: date("from_date"),
  toDate: date("to_date"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// AUTH: USERS
// =====================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("hr"), // admin | hr | ceo
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =====================
// AUTH: SESSIONS
// =====================
export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 80 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// AUTH: SETUP / RESET TOKENS
// =====================
export const setupTokens = pgTable("setup_tokens", {
  token: varchar("token", { length: 80 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  purpose: varchar("purpose", { length: 20 }).notNull(), // invite | reset
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =====================
// AUTH: ROLE PERMISSIONS
// =====================
// One row per role. `modules` is a comma-separated list of module keys the
// role may open (see lib/permissions.ts). `canEdit=false` makes the role
// view-only across everything (like the CEO role). superadmin is always
// full-access and is never read from this table.
export const rolePermissions = pgTable("role_permissions", {
  role: varchar("role", { length: 20 }).primaryKey(),
  modules: text("modules").notNull().default(""),
  canEdit: boolean("can_edit").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
