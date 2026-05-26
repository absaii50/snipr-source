import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { db, usersTable, workspacesTable, linksTable, clickEventsTable } from "@workspace/db";
import { logger } from "./logger";

export const PLAN_CLICK_CAPS: Record<string, number | null> = {
  free: 10_000,
  starter: 1_000_000,
  growth: 5_000_000,
  pro: 25_000_000,
  business: 100_000_000,
  enterprise: null,
};

/**
 * Immediately unflag a user's links if their current 30-day click count is
 * under their (possibly new) plan's cap. Called from:
 *   1. Stripe webhooks (subscription created/updated, invoice paid)
 *   2. Admin manual plan upgrade
 *
 * Returns the number of links unflagged.
 */
export async function unflagLinksIfUnderCap(userId: string, plan: string): Promise<number> {
  const cap = PLAN_CLICK_CAPS[plan];
  if (cap === undefined) return 0;
  const isUnlimited = cap === null;

  if (!isUnlimited) {
    const [row] = await db
      .select({
        clicks: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${clickEventsTable} ce
          JOIN ${linksTable} l ON l.id = ce.link_id
          JOIN ${workspacesTable} w ON w.id = l.workspace_id
          WHERE w.user_id = ${userId}
            AND ce.timestamp > NOW() - INTERVAL '30 days'
        )`,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (Number(row?.clicks ?? 0) >= (cap as number)) return 0;
  }

  const workspaceRows = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.userId, userId));
  const workspaceIds = workspaceRows.map((w) => w.id);
  if (workspaceIds.length === 0) return 0;

  const updated = await db
    .update(linksTable)
    .set({ flaggedAt: null, flaggedReason: null })
    .where(and(
      inArray(linksTable.workspaceId, workspaceIds),
      isNotNull(linksTable.flaggedAt),
    ))
    .returning({ slug: linksTable.slug, domainId: linksTable.domainId });

  // Invalidate the redirect cache so the new state is visible immediately.
  if (updated.length > 0) {
    try {
      const { invalidateLinkCache } = await import("./link-cache");
      for (const l of updated) {
        invalidateLinkCache(l.slug, l.domainId);
        invalidateLinkCache(l.slug, null); // also invalidate the default-domain key used for /r/:slug
      }
    } catch (err) {
      logger.warn({ err }, "Failed to invalidate link cache after unflag");
    }
  }
  return updated.length;
}
