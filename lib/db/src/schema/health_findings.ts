import { pgTable, text, uuid, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Findings emitted by the synthetic bug-detector that runs inside snipr-api.
 * Each check produces zero or one finding per run. Multiple runs of the same
 * check that produce the SAME message are deduped into one row whose
 * `occurrence_count` is bumped — this keeps the table from blowing up on a
 * persistent breakage.
 *
 * Status flow:
 *   open  → set by the monitor when a check fails
 *   resolved → set by admin (clicking "Mark resolved") OR auto-resolved when
 *              the same check next runs successfully
 */
export const healthFindingsTable = pgTable("health_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkName: text("check_name").notNull(),
  severity: text("severity").notNull(),        // 'critical' | 'warning' | 'info'
  status: text("status").notNull().default("open"), // 'open' | 'resolved'
  message: text("message").notNull(),
  details: jsonb("details"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
}, (table) => [
  // Dedup key — same check + same message while still open = one row
  uniqueIndex("health_findings_open_dedup_idx")
    .on(table.checkName, table.message)
    .where(text("status = 'open'")),
  index("health_findings_status_idx").on(table.status),
  index("health_findings_last_seen_idx").on(table.lastSeenAt),
]);

export const insertHealthFindingSchema = createInsertSchema(healthFindingsTable).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
});

export type InsertHealthFinding = z.infer<typeof insertHealthFindingSchema>;
export type HealthFinding = typeof healthFindingsTable.$inferSelect;
