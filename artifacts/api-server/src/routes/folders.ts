import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, foldersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/folders", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const folders = await db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.workspaceId, workspaceId))
    .orderBy(foldersTable.name);
  res.json(folders);
});

router.post("/folders", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { name, color } = req.body as { name?: string; color?: string };

  if (!name || typeof name !== "string") {
    res.status(422).json({ error: "Validation error", message: "name is required" });
    return;
  }

  const [created] = await db
    .insert(foldersTable)
    .values({ workspaceId, name: name.trim(), color: color ?? "#6366f1" })
    .returning();

  res.status(201).json(created);
});

router.put("/folders/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const { name, color } = req.body as { name?: string; color?: string };

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(and(eq(foldersTable.id, id), eq(foldersTable.workspaceId, workspaceId)));

  if (!folder) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(foldersTable)
    .set({
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(color !== undefined ? { color } : {}),
    })
    .where(eq(foldersTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/folders/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(and(eq(foldersTable.id, id), eq(foldersTable.workspaceId, workspaceId)));

  if (!folder) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(foldersTable).where(eq(foldersTable.id, id));
  res.json({ message: "Folder deleted" });
});

export default router;
