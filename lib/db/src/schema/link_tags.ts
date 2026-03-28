import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { linksTable } from "./links";
import { tagsTable } from "./tags";

export const linkTagsTable = pgTable(
  "link_tags",
  {
    linkId: uuid("link_id")
      .notNull()
      .references(() => linksTable.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tagsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.linkId, t.tagId] })]
);

export type LinkTag = typeof linkTagsTable.$inferSelect;
