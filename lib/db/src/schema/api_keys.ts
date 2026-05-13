import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";

/**
 * Workspace-scoped API keys for server-to-server access (conversions tracking,
 * future API). The raw key is only shown once at creation; the DB stores a
 * sha-256 hash. `keyPrefix` is a short non-secret slice (e.g. "sk_live_a1b2c3")
 * shown in the UI so users can identify which key is which.
 */
export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .references(() => usersTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("api_keys_workspace_id_idx").on(table.workspaceId),
    index("api_keys_key_hash_idx").on(table.keyHash),
  ]
);

export type ApiKey = typeof apiKeysTable.$inferSelect;
export type InsertApiKey = typeof apiKeysTable.$inferInsert;
