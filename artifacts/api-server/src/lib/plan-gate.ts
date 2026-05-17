import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable } from "@workspace/db";

/** Plan ladder — lower index = lower tier. Used for plan>=required comparisons. */
const PLAN_LADDER = ["free", "starter", "growth", "pro", "business", "enterprise"] as const;
export type Plan = (typeof PLAN_LADDER)[number];

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

/** Tiny in-process cache so every API call doesn't re-query users for plan. */
const planCache = new Map<string, { plan: Plan; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidatePlanCache(userId: string, workspaceId?: string): void {
  planCache.delete(userId);
  if (workspaceId) planCache.delete(`ws:${workspaceId}`);
}

async function getUserPlan(userId: string): Promise<Plan> {
  const cached = planCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.plan;

  const [row] = await db
    .select({ plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const plan = ((row?.plan ?? "free") as Plan);
  planCache.set(userId, { plan, expiresAt: Date.now() + CACHE_TTL_MS });
  return plan;
}

/** Resolve plan from a workspaceId by joining to the workspace owner. Used by
 *  requireAuthOrApiKey callers (e.g. POST /conversions) which only have
 *  workspaceId on the request. */
async function getPlanByWorkspace(workspaceId: string): Promise<Plan> {
  const key = `ws:${workspaceId}`;
  const cached = planCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.plan;

  const [row] = await db
    .select({ plan: usersTable.plan })
    .from(workspacesTable)
    .innerJoin(usersTable, eq(usersTable.id, workspacesTable.userId))
    .where(eq(workspacesTable.id, workspaceId));

  const plan = ((row?.plan ?? "free") as Plan);
  planCache.set(key, { plan, expiresAt: Date.now() + CACHE_TTL_MS });
  return plan;
}

function planAtLeast(actual: Plan, required: Plan): boolean {
  return PLAN_LADDER.indexOf(actual) >= PLAN_LADDER.indexOf(required);
}

/**
 * Express middleware factory — blocks the request unless the authenticated
 * user's plan is at least the required tier. Must be used AFTER requireAuth.
 *
 * Returns HTTP 402 (Payment Required) so the frontend can show an upgrade CTA.
 */
export function requirePlan(minPlan: Plan, featureName: string) {
  return async function planGate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = req.session?.userId;
    const workspaceId = req.session?.workspaceId;
    if (!userId && !workspaceId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const userPlan = userId
        ? await getUserPlan(userId)
        : await getPlanByWorkspace(workspaceId!);
      if (!planAtLeast(userPlan, minPlan)) {
        res.status(402).json({
          error: "Plan upgrade required",
          message: `${featureName} requires the ${PLAN_LABEL[minPlan]} plan or above. Upgrade to unlock this feature.`,
          field: "plan",
          requiredPlan: minPlan,
          currentPlan: userPlan,
        });
        return;
      }
      next();
    } catch (err) {
      // Fail closed — if we can't read the plan, don't grant access.
      res.status(500).json({ error: "Could not verify plan", message: "Please try again." });
    }
  };
}
