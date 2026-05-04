import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";

type UserRow = typeof usersTable.$inferSelect;

/**
 * If the user is on a trial that has expired AND has no active Stripe subscription,
 * revert them to Free and clear the trial fields. Returns the (possibly mutated) user.
 *
 * Safe to call on every authenticated request — it's a no-op for users not on trial.
 */
export async function expireTrialIfDue(user: UserRow): Promise<UserRow> {
  if (!user.trialEndsAt) return user;
  if (user.trialEndsAt > new Date()) return user; // still in trial

  // If the user upgraded to a real Stripe subscription mid-trial, leave them alone.
  // Their plan should already be set by the Stripe webhook.
  if (user.stripeSubscriptionId && user.stripeSubscriptionStatus === "active") {
    // Just clear trial fields — no need to keep them on the trial state.
    await db.update(usersTable).set({ trialEndsAt: null, trialPlan: null }).where(eq(usersTable.id, user.id));
    return { ...user, trialEndsAt: null, trialPlan: null };
  }

  // Trial expired without subscription — revert to Free.
  await db.update(usersTable)
    .set({ plan: "free", trialEndsAt: null, trialPlan: null })
    .where(eq(usersTable.id, user.id));

  logger.info({ userId: user.id, expiredFrom: user.trialPlan }, "Auto-reverted user to Free after trial expiry");
  return { ...user, plan: "free", trialEndsAt: null, trialPlan: null };
}

/**
 * Compute trial countdown info for the frontend.
 * Returns null if user isn't on trial; otherwise returns { plan, daysLeft, hoursLeft, endsAt }.
 */
export function trialStatus(user: UserRow): { plan: string; daysLeft: number; hoursLeft: number; endsAt: string } | null {
  if (!user.trialEndsAt) return null;
  const ms = new Date(user.trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    plan: user.trialPlan ?? user.plan,
    daysLeft: Math.floor(ms / (24 * 60 * 60 * 1000)),
    hoursLeft: Math.round(ms / (60 * 60 * 1000)),
    endsAt: new Date(user.trialEndsAt).toISOString(),
  };
}
