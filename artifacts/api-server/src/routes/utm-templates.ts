import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, utmTemplatesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

/** Lightweight string trim with a 255 char ceiling — same shape the click
 *  tracker applies when reading UTMs off a redirect. Keeps stored values
 *  predictable across the writer and the template manager. */
function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, 255);
}

router.get("/utm-templates", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const rows = await db
    .select()
    .from(utmTemplatesTable)
    .where(eq(utmTemplatesTable.workspaceId, workspaceId))
    .orderBy(desc(utmTemplatesTable.createdAt));
  res.json(rows);
});

router.post("/utm-templates", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const userId = req.session.userId!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = clean(body.name);
  if (!name) {
    res.status(400).json({ error: "Validation error", message: "Template name is required." });
    return;
  }

  const [row] = await db
    .insert(utmTemplatesTable)
    .values({
      workspaceId,
      createdByUserId: userId,
      name,
      utmSource: clean(body.utmSource),
      utmMedium: clean(body.utmMedium),
      utmCampaign: clean(body.utmCampaign),
      utmTerm: clean(body.utmTerm),
      utmContent: clean(body.utmContent),
    })
    .returning();

  res.status(201).json(row);
});

router.delete("/utm-templates/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const result = await db
    .delete(utmTemplatesTable)
    .where(and(
      eq(utmTemplatesTable.id, req.params.id),
      eq(utmTemplatesTable.workspaceId, workspaceId),
    ))
    .returning({ id: utmTemplatesTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
