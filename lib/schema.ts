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

  // Compensation
  basicSalary: integer("basic_salary"),

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
