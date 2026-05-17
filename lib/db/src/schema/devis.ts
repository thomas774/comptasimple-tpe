import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devisTable = pgTable("devis", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  devisId: text("devis_id").notNull().unique(),
  clientName: text("client_name").notNull(),
  subject: text("subject").notNull(),
  date: text("date").notNull(),
  validUntil: text("valid_until").notNull(),
  lines: jsonb("lines").notNull().default([]),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  status: text("status").notNull().default("Brouillon"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDevisSchema = createInsertSchema(devisTable).omit({ id: true, createdAt: true });
export type InsertDevis = z.infer<typeof insertDevisSchema>;
export type Devis = typeof devisTable.$inferSelect;
