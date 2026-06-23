import {
  pgTable,
  serial,
  varchar,
  text,
  date,
  timestamp,
  integer,
  boolean,
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

  // Compensation
  basicSalary: integer("basic_salary"),
  conveyance: integer("conveyance").default(0),
  houseRentPercent: integer("house_rent_percent").default(0),
  medicalPercent: integer("medical_percent").default(0),
  incomeTaxPercent: integer("income_tax_percent").default(0),
  eobiEmployeePercent: integer("eobi_employee_percent").default(0),
  eobiEmployerPercent: integer("eobi_employer_percent").default(0),
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
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  eobiEmployeePercent: integer("eobi_employee_percent").notNull().default(0),
  eobiEmployerPercent: integer("eobi_employer_percent").notNull().default(0),
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
// SALARY SLIPS (snapshot per month per employee)
// =====================
export const salarySlips = pgTable("salary_slips", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  // Snapshot of employee info
  employeeCode: varchar("employee_code", { length: 20 }).notNull(),
  employeeName: varchar("employee_name", { length: 160 }).notNull(),
  designation: varchar("designation", { length: 80 }),
  department: varchar("department", { length: 60 }),
  // Snapshot of structure
  basicSalary: integer("basic_salary").notNull().default(0),
  conveyance: integer("conveyance").notNull().default(0),
  houseRentPercent: integer("house_rent_percent").notNull().default(0),
  medicalPercent: integer("medical_percent").notNull().default(0),
  incomeTaxPercent: integer("income_tax_percent").notNull().default(0),
  eobiEmployeePercent: integer("eobi_employee_percent").notNull().default(0),
  eobiEmployerPercent: integer("eobi_employer_percent").notNull().default(0),
  // Computed earnings
  houseRent: integer("house_rent").notNull().default(0),
  medical: integer("medical").notNull().default(0),
  overtime: integer("overtime").notNull().default(0),
  grossEarnings: integer("gross_earnings").notNull().default(0),
  // Attendance counts
  daysPresent: integer("days_present").notNull().default(0),
  daysAbsent: integer("days_absent").notNull().default(0),
  daysOnLeave: integer("days_on_leave").notNull().default(0),
  weekOffs: integer("week_offs").notNull().default(0),
  // Deductions
  incomeTax: integer("income_tax").notNull().default(0),
  eobiEmployee: integer("eobi_employee").notNull().default(0),
  eobiEmployer: integer("eobi_employer").notNull().default(0),
  absentDeduction: integer("absent_deduction").notNull().default(0),
  otherDeduction: integer("other_deduction").notNull().default(0),
  totalDeductions: integer("total_deductions").notNull().default(0),
  // Net
  netPay: integer("net_pay").notNull().default(0),
  notes: text("notes"),
  generatedBy: varchar("generated_by", { length: 120 }),
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
