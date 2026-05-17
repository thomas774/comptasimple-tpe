import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bankAccountTable = pgTable("bank_account", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("").unique(),
  name: text("name").notNull().default(""),
  iban: text("iban").notNull().default(""),
  connected: boolean("connected").notNull().default(false),
  gcRequisitionId: text("gc_requisition_id"),
  gcAccountId: text("gc_account_id"),
  gcLogoUrl: text("gc_logo_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBankAccountSchema = createInsertSchema(bankAccountTable).omit({ id: true, updatedAt: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccountTable.$inferSelect;
