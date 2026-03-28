import { pgTable, text, uuid, timestamp, numeric, jsonb, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { linksTable } from "./links";
import { clickEventsTable } from "./click_events";

export const conversionsTable = pgTable(
  "conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .references(() => linksTable.id, { onDelete: "set null" }),
    clickEventId: uuid("click_event_id")
      .references(() => clickEventsTable.id, { onDelete: "set null" }),
    eventName: text("event_name").notNull().default("conversion"),
    revenue: numeric("revenue", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    utmCampaign: text("utm_campaign"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("conversions_workspace_id_idx").on(table.workspaceId),
    index("conversions_link_id_idx").on(table.linkId),
    index("conversions_created_at_idx").on(table.createdAt),
  ]
);

export type Conversion = typeof conversionsTable.$inferSelect;
export type InsertConversion = typeof conversionsTable.$inferInsert;
