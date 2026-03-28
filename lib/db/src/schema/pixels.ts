import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const pixelsTable = pgTable("pixels", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  pixelId: text("pixel_id"),
  customScript: text("custom_script"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("pixels_workspace_id_idx").on(table.workspaceId),
]);

export const insertPixelSchema = createInsertSchema(pixelsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPixel = z.infer<typeof insertPixelSchema>;
export type Pixel = typeof pixelsTable.$inferSelect;
