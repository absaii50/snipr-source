import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { linksTable } from "./links";

export const linkRulesTable = pgTable("link_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  linkId: uuid("link_id")
    .notNull()
    .references(() => linksTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  priority: integer("priority").notNull().default(0),
  conditions: jsonb("conditions").notNull().default({}),
  destinationUrl: text("destination_url").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLinkRuleSchema = createInsertSchema(linkRulesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLinkRule = z.infer<typeof insertLinkRuleSchema>;
export type LinkRule = typeof linkRulesTable.$inferSelect;
