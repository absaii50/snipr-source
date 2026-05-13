import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { eq, isNull, and } from "drizzle-orm";
import { db, apiKeysTable } from "@workspace/db";
import { logger } from "./logger";

declare module "express-serve-static-core" {
  interface Request {
    apiKey?: { id: string; workspaceId: string };
  }
}

/** sha-256 of the raw key, hex-encoded. We never store the raw key. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Pull X-API-Key (or Authorization: Bearer) from request headers. */
function extractKey(req: Request): string | null {
  const headerKey = req.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey.trim().length > 0) return headerKey.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim() || null;
  }
  return null;
}

/**
 * Middleware that accepts EITHER a logged-in browser session OR an X-API-Key
 * header. On success it sets req.session.workspaceId (so downstream code can
 * keep using it unchanged) plus req.apiKey for audit/logging.
 *
 * Use for endpoints that need to be callable from both the dashboard AND
 * server-to-server (e.g. POST /conversions).
 */
export async function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Session path — same shape as requireAuth, lets dashboard calls continue to work.
  if (req.session?.userId && req.session?.workspaceId) {
    return next();
  }

  const raw = extractKey(req);
  if (!raw) {
    res.status(401).json({ error: "Unauthorized", message: "Provide an X-API-Key header or sign in." });
    return;
  }

  const keyHash = hashApiKey(raw);
  const [row] = await db
    .select({ id: apiKeysTable.id, workspaceId: apiKeysTable.workspaceId })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, keyHash), isNull(apiKeysTable.revokedAt)))
    .limit(1);

  if (!row) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or revoked API key." });
    return;
  }

  // Async-fire-and-forget the last_used_at bump so it doesn't add latency.
  db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, row.id))
    .catch((err) => logger.error({ err, apiKeyId: row.id }, "Failed to update api key last_used_at"));

  // Synthesize a session-shaped object so downstream code unchanged. We do NOT
  // persist this — it lives only on this request.
  (req.session as any).workspaceId = row.workspaceId;
  req.apiKey = { id: row.id, workspaceId: row.workspaceId };
  next();
}
