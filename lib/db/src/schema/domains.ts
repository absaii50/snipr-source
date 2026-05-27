import { pgTable, text, uuid, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const domainsTable = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  verified: boolean("verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  isParentDomain: boolean("is_parent_domain").notNull().default(false),
  supportsSubdomains: boolean("supports_subdomains").notNull().default(false),
  purpose: text("purpose").default("links_only"),
  isPlatformDomain: boolean("is_platform_domain").notNull().default(false),

  // SSL certificate state — populated by the SSL manager running on Server 2
  // after certbot succeeds / fails. Used by the dashboard to surface cert
  // status, expiry, and the most recent error to the user.
  //   null     = no cert attempt yet (newly verified, waiting for ssl-manager)
  //   pending  = certbot in progress
  //   active   = cert issued + nginx reloaded; ssl_expires_at populated
  //   failed   = certbot failed; ssl_error contains the last error message
  sslStatus: text("ssl_status"),
  sslIssuedAt: timestamp("ssl_issued_at", { withTimezone: true }),
  sslExpiresAt: timestamp("ssl_expires_at", { withTimezone: true }),
  sslLastCheckAt: timestamp("ssl_last_check_at", { withTimezone: true }),
  sslError: text("ssl_error"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("domains_workspace_id_idx").on(table.workspaceId),
  index("domains_verified_idx").on(table.verified),
  index("domains_subdomain_idx").on(table.supportsSubdomains),
]);

export const insertDomainSchema = createInsertSchema(domainsTable).omit({
  id: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domainsTable.$inferSelect;
