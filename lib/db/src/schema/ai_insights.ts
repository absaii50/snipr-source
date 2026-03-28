import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const aiInsightsTable = pgTable(
  "ai_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_insights_workspace_id_idx").on(table.workspaceId),
    index("ai_insights_type_idx").on(table.type),
    index("ai_insights_created_at_idx").on(table.createdAt),
  ]
);

export type AiInsight = typeof aiInsightsTable.$inferSelect;
export type InsertAiInsight = typeof aiInsightsTable.$inferInsert;
