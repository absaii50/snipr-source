import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, integrationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { testIntegration } from "../lib/integrations-fire";

const router: IRouter = Router();

const VALID_TYPES = ["slack", "zapier", "ga4", "webhook", "segment"] as const;

router.get("/integrations", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const rows = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.workspaceId, workspaceId))
    .orderBy(integrationsTable.createdAt);
  res.json(rows);
});

router.post("/integrations", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { type, name, config = {} } = req.body as { type?: string; name?: string; config?: Record<string, string> };

  if (!type || !VALID_TYPES.includes(type as any)) {
    res.status(422).json({ error: "Invalid integration type" });
    return;
  }
  if (!name?.trim()) {
    res.status(422).json({ error: "name is required" });
    return;
  }

  const [row] = await db
    .insert(integrationsTable)
    .values({ workspaceId, type, name: name.trim(), config, enabled: true })
    .returning();
  res.status(201).json(row);
});

router.put("/integrations/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const { name, config, enabled } = req.body as { name?: string; config?: Record<string, string>; enabled?: boolean };

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.workspaceId, workspaceId)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const update: Partial<typeof integrationsTable.$inferInsert> = {};
  if (name !== undefined) update.name = name.trim();
  if (config !== undefined) update.config = config;
  if (enabled !== undefined) update.enabled = enabled;

  const [row] = await db
    .update(integrationsTable)
    .set(update)
    .where(eq(integrationsTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/integrations/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.workspaceId, workspaceId)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(integrationsTable).where(eq(integrationsTable.id, id));
  res.json({ message: "Integration deleted" });
});

router.post("/integrations/:id/test", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [integration] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.id, id), eq(integrationsTable.workspaceId, workspaceId)));
  if (!integration) { res.status(404).json({ error: "Not found" }); return; }

  const result = await testIntegration(
    { type: integration.type, config: integration.config as Record<string, string> },
    workspaceId,
  );
  if (result.ok) {
    res.json({ message: "Test event sent successfully" });
  } else {
    res.status(422).json({ error: result.error ?? "Test failed" });
  }
});

export default router;
