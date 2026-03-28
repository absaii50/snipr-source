import { pgTable, text, uuid, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const integrationsTable = pgTable("workspace_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Integration = typeof integrationsTable.$inferSelect;
export type IntegrationConfig = Record<string, string | boolean | number | null>;
