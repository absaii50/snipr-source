import { pgTable, text, uuid, timestamp, boolean, integer, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { domainsTable } from "./domains";

export const linksTable = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  domainId: uuid("domain_id")
    .references(() => domainsTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  destinationUrl: text("destination_url").notNull(),
  title: text("title"),
  enabled: boolean("enabled").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  folderId: uuid("folder_id"),
  passwordHash: text("password_hash"),
  clickLimit: integer("click_limit"),
  fallbackUrl: text("fallback_url"),
  isCloaked: boolean("is_cloaked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("links_workspace_id_idx").on(table.workspaceId),
  index("links_workspace_created_idx").on(table.workspaceId, table.createdAt),
  index("links_workspace_domain_slug_idx").on(table.workspaceId, table.domainId, table.slug),
  index("links_folder_id_idx").on(table.folderId),
  unique("links_workspace_slug_domain_unique").on(table.workspaceId, table.slug, table.domainId),
]);

export const insertLinkSchema = createInsertSchema(linksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLink = z.infer<typeof insertLinkSchema>;
export type Link = typeof linksTable.$inferSelect;
