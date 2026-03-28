import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

// Session table for express-session with connect-pg-simple store
export const sessionTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { withTimezone: false }).notNull(),
  },
  (table) => ({
    expireIndex: index("IDX_session_expire").on(table.expire),
  })
);

export type Session = typeof sessionTable.$inferSelect;
