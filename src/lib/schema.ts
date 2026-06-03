import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});