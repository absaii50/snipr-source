import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tagsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/tags", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const tags = await db
    .select()
    .from(tagsTable)
    .where(eq(tagsTable.workspaceId, workspaceId))
    .orderBy(tagsTable.name);
  res.json(tags);
});

router.post("/tags", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { name, color } = req.body as { name?: string; color?: string };

  if (!name || typeof name !== "string") {
    res.status(422).json({ error: "Validation error", message: "name is required" });
    return;
  }

  const [created] = await db
    .insert(tagsTable)
    .values({ workspaceId, name: name.trim(), color: color ?? "#6366f1" })
    .returning();

  res.status(201).json(created);
});

router.put("/tags/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const { name, color } = req.body as { name?: string; color?: string };

  const [tag] = await db
    .select()
    .from(tagsTable)
    .where(and(eq(tagsTable.id, id), eq(tagsTable.workspaceId, workspaceId)));

  if (!tag) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(tagsTable)
    .set({
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(color !== undefined ? { color } : {}),
    })
    .where(eq(tagsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/tags/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [tag] = await db
    .select()
    .from(tagsTable)
    .where(and(eq(tagsTable.id, id), eq(tagsTable.workspaceId, workspaceId)));

  if (!tag) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(tagsTable).where(eq(tagsTable.id, id));
  res.json({ message: "Tag deleted" });
});

export default router;
