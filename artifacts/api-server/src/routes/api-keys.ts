import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, apiKeysTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { hashApiKey } from "../lib/api-key-auth";
import { requirePlan } from "../lib/plan-gate";

/** API keys (used for server-to-server conversion tracking + future endpoints)
 *  are gated to Pro+, the same tier as Conversion tracking itself. */
const requireApiKeyPlan = requirePlan("pro", "API access");

const router: IRouter = Router();

/**
 * Generate a fresh API key with a stable prefix. Format: `sk_live_<28-char base32ish>`.
 * The prefix lets users identify keys in the dashboard without exposing the secret.
 */
function generateApiKey(): { raw: string; prefix: string } {
  const random = randomBytes(24).toString("base64url"); // 32 chars, URL-safe
  const raw = `sk_live_${random}`;
  // First 14 chars (sk_live_a1b2c3) is enough to be visually unique without
  // leaking the whole secret. Show "sk_live_a1b2…rest" in the UI.
  const prefix = raw.slice(0, 14);
  return { raw, prefix };
}

/** GET /api-keys — list keys for the workspace. Never returns the raw key. */
router.get("/api-keys", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const rows = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      lastUsedAt: apiKeysTable.lastUsedAt,
      revokedAt: apiKeysTable.revokedAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.workspaceId, workspaceId))
    .orderBy(desc(apiKeysTable.createdAt));

  res.json(rows);
});

/** POST /api-keys — create a new key. Returns the raw key once. */
router.post("/api-keys", requireAuth, requireApiKeyPlan, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const userId = req.session.userId!;
  const body = (req.body ?? {}) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  if (!name) {
    res.status(400).json({ error: "Validation error", message: "Name is required (max 80 chars)." });
    return;
  }

  const { raw, prefix } = generateApiKey();
  const keyHash = hashApiKey(raw);

  const [row] = await db
    .insert(apiKeysTable)
    .values({
      workspaceId,
      createdByUserId: userId,
      name,
      keyHash,
      keyPrefix: prefix,
    })
    .returning({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      createdAt: apiKeysTable.createdAt,
    });

  // The raw key is returned once and never again.
  res.status(201).json({ ...row, key: raw });
});

/** DELETE /api-keys/:id — revoke a key (soft-delete via revoked_at). */
router.delete("/api-keys/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const id = req.params.id;

  const result = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.workspaceId, workspaceId)))
    .returning({ id: apiKeysTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
