import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";

/**
 * Saved UTM combinations a user reuses across links (e.g. "Q4 Facebook Ads"
 * → utm_source=fb, utm_medium=cpc, utm_campaign=q4_sale). The LinkModal can
 * apply a template in one click instead of typing the same five fields again.
 *
 * Fields stored individually (not jsonb) so SQL filtering / sorting on a single
 * UTM dimension stays cheap.
 */
export const utmTemplatesTable = pgTable(
  "utm_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .references(() => usersTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("utm_templates_workspace_id_idx").on(table.workspaceId),
  ]
);

export type UtmTemplate = typeof utmTemplatesTable.$inferSelect;
export type InsertUtmTemplate = typeof utmTemplatesTable.$inferInsert;
