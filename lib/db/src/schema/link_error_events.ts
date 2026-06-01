import { pgTable, text, uuid, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-request error log for link-mutation endpoints. Populated by the
 * captureLinkErrors middleware in lib/link-error-capture.ts. Read by the
 * "user_stuck_on_links" health check + the admin per-user timeline view.
 *
 * Kept narrow on purpose — we only persist the fields we need to spot a
 * stuck user, not the full request body (privacy + bloat). 7-day rolling
 * retention is enforced by the same scanner that emits findings.
 */
export const linkErrorEventsTable = pgTable("link_error_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),                // null for unauthenticated 4xx (shouldn't happen on /links but keep nullable)
  workspaceId: uuid("workspace_id"),
  method: text("method").notNull(),       // POST | PUT | DELETE | PATCH
  path: text("path").notNull(),           // /api/links, /api/links/:id, etc.
  status: integer("status").notNull(),    // HTTP status (400, 402, 409, 422, 500, ...)
  errorCode: text("error_code"),          // app-level error from the JSON body (e.g. "Plan limit reached")
  errorMessage: text("error_message"),    // human-readable msg
  errorField: text("error_field"),        // which field tripped (e.g. "slug", "password", "expiresAt")
  requestSummary: jsonb("request_summary"), // {slug?, destinationUrl?, plan?, ...} — small subset
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Fast lookup: "show me errors for user X in the last N minutes"
  index("link_error_events_user_idx").on(table.userId, table.createdAt),
  index("link_error_events_created_idx").on(table.createdAt),
  index("link_error_events_status_idx").on(table.status),
]);

export const insertLinkErrorEventSchema = createInsertSchema(linkErrorEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLinkErrorEvent = z.infer<typeof insertLinkErrorEventSchema>;
export type LinkErrorEvent = typeof linkErrorEventsTable.$inferSelect;
