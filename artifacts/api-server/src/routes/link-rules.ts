import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, linksTable, linkRulesTable, linkTagsTable, tagsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const VALID_RULE_TYPES = ["geo", "device", "ab", "rotator"] as const;

const router: IRouter = Router();

router.get("/links/:id/rules", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const rules = await db
    .select()
    .from(linkRulesTable)
    .where(eq(linkRulesTable.linkId, id))
    .orderBy(linkRulesTable.priority);

  res.json(rules);
});

router.put("/links/:id/rules", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const { rules } = req.body as {
    rules?: Array<{
      type: string;
      priority?: number;
      conditions?: Record<string, unknown>;
      destinationUrl: string;
      label?: string;
    }>;
  };

  if (!Array.isArray(rules)) {
    res.status(422).json({ error: "Validation error", message: "rules must be an array" });
    return;
  }

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  for (const rule of rules) {
    if (!VALID_RULE_TYPES.includes(rule.type as any)) {
      res.status(422).json({ error: "Validation error", message: `Invalid rule type: ${rule.type}` });
      return;
    }
    if (!rule.destinationUrl) {
      res.status(422).json({ error: "Validation error", message: "Each rule must have a destinationUrl" });
      return;
    }
  }

  await db.delete(linkRulesTable).where(eq(linkRulesTable.linkId, id));

  if (rules.length === 0) {
    res.json([]);
    return;
  }

  const inserted = await db
    .insert(linkRulesTable)
    .values(
      rules.map((r, i) => ({
        linkId: id,
        type: r.type,
        priority: r.priority ?? i,
        conditions: (r.conditions ?? {}) as any,
        destinationUrl: r.destinationUrl,
        label: r.label ?? null,
      }))
    )
    .returning();

  res.json(inserted);
});

router.get("/links/:id/tags", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const rows = await db
    .select({ tag: tagsTable })
    .from(linkTagsTable)
    .innerJoin(tagsTable, eq(linkTagsTable.tagId, tagsTable.id))
    .where(eq(linkTagsTable.linkId, id));

  res.json(rows.map((r) => r.tag));
});

router.put("/links/:id/tags", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const { tagIds } = req.body as { tagIds?: string[] };

  if (!Array.isArray(tagIds)) {
    res.status(422).json({ error: "Validation error", message: "tagIds must be an array" });
    return;
  }

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(linkTagsTable).where(eq(linkTagsTable.linkId, id));

  if (tagIds.length > 0) {
    await db.insert(linkTagsTable).values(tagIds.map((tagId) => ({ linkId: id, tagId })));
  }

  res.json({ message: "Tags updated" });
});

export default router;
