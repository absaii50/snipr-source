import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";

/**
 * support_tickets
 * One row per customer support conversation.
 * Lifecycle: open → pending (waiting on user) → resolved → closed.
 */
export const supportTicketsTable = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  category: text("category").notNull().default("other"),     // bug | billing | feature | technical | other
  priority: text("priority").notNull().default("normal"),    // low | normal | high | urgent
  status: text("status").notNull().default("open"),          // open | pending | resolved | closed
  assignedAdmin: text("assigned_admin"),                     // free-text admin identifier
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  lastUserReplyAt: timestamp("last_user_reply_at", { withTimezone: true }),
  lastAdminReplyAt: timestamp("last_admin_reply_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (t) => [
  index("support_tickets_user_idx").on(t.userId),
  index("support_tickets_status_idx").on(t.status),
  index("support_tickets_created_idx").on(t.createdAt),
]);

/**
 * support_messages
 * Threaded messages inside a ticket (user + admin).
 */
export const supportMessagesTable = pgTable("support_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => supportTicketsTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(),                 // user | admin
  senderUserId: uuid("sender_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  senderLabel: text("sender_label"),                         // admin display name when senderType=admin
  body: text("body").notNull(),
  isInternalNote: text("is_internal_note").notNull().default("false"), // "true" = admin-only note
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("support_messages_ticket_idx").on(t.ticketId, t.createdAt),
]);

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSupportMessageSchema = createInsertSchema(supportMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
