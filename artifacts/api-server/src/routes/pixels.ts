import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, pixelsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const VALID_TYPES = ["meta", "google_ads", "linkedin", "tiktok", "custom"] as const;

const router: IRouter = Router();

router.get("/pixels", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const pixels = await db
    .select()
    .from(pixelsTable)
    .where(eq(pixelsTable.workspaceId, workspaceId))
    .orderBy(pixelsTable.createdAt);
  res.json(pixels);
});

router.post("/pixels", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { name, type, pixelId, customScript } = req.body as {
    name?: string;
    type?: string;
    pixelId?: string;
    customScript?: string;
  };

  if (!name || !type || !VALID_TYPES.includes(type as any)) {
    res.status(422).json({ error: "Validation error", message: "name and valid type are required" });
    return;
  }

  if (type !== "custom" && !pixelId) {
    res.status(422).json({ error: "Validation error", message: "pixelId is required for this pixel type" });
    return;
  }

  if (type === "custom" && !customScript) {
    res.status(422).json({ error: "Validation error", message: "customScript is required for custom pixels" });
    return;
  }

  // SECURITY: Validate custom scripts don't contain dangerous patterns
  if (type === "custom" && customScript) {
    const dangerousPatterns = [
      /document\.cookie/i,
      /window\.location\s*=/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
      /fetch\s*\(\s*['"`](?!https:\/\/(www\.)?(google|facebook|linkedin|tiktok|analytics))/i,
      /<\/script\s*>[\s\S]*<script/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(customScript)) {
        res.status(422).json({ error: "Validation error", message: "Custom script contains potentially dangerous code. Only tracking scripts are allowed." });
        return;
      }
    }
    // Max length check
    if (customScript.length > 5000) {
      res.status(422).json({ error: "Validation error", message: "Custom script must be under 5000 characters" });
      return;
    }
  }

  const [created] = await db
    .insert(pixelsTable)
    .values({
      workspaceId,
      name,
      type,
      pixelId: pixelId ?? null,
      customScript: customScript ?? null,
    })
    .returning();

  res.status(201).json(created);
});

router.put("/pixels/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const { name, pixelId, customScript } = req.body as {
    name?: string;
    pixelId?: string;
    customScript?: string;
  };

  const [pixel] = await db
    .select()
    .from(pixelsTable)
    .where(and(eq(pixelsTable.id, id), eq(pixelsTable.workspaceId, workspaceId)));

  if (!pixel) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(pixelsTable)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(pixelId !== undefined ? { pixelId } : {}),
      ...(customScript !== undefined ? { customScript } : {}),
    })
    .where(eq(pixelsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/pixels/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [pixel] = await db
    .select()
    .from(pixelsTable)
    .where(and(eq(pixelsTable.id, id), eq(pixelsTable.workspaceId, workspaceId)));

  if (!pixel) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(pixelsTable).where(eq(pixelsTable.id, id));
  res.json({ message: "Pixel removed" });
});

export default router;
