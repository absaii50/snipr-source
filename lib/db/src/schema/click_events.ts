import { pgTable, text, uuid, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { linksTable } from "./links";

export const clickEventsTable = pgTable(
  "click_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => linksTable.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    browser: text("browser"),
    os: text("os"),
    device: text("device"),
    country: text("country"),
    city: text("city"),
    ipHash: text("ip_hash"),
    isQr: boolean("is_qr").notNull().default(false),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
  },
  (table) => [
    index("click_events_link_id_idx").on(table.linkId),
    index("click_events_timestamp_idx").on(table.timestamp),
    index("click_events_link_id_timestamp_idx").on(table.linkId, table.timestamp),
  ]
);

export const insertClickEventSchema = createInsertSchema(clickEventsTable).omit({
  id: true,
});

export type InsertClickEvent = z.infer<typeof insertClickEventSchema>;
export type ClickEvent = typeof clickEventsTable.$inferSelect;
