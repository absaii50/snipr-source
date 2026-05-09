import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import { db, usersTable, linksTable, workspacesTable, clickEventsTable } from "@workspace/db";
import { getStripeClient, getWebhookSecret } from "./stripeClient";
import { logger } from "./logger";

const PLAN_CLICK_CAPS: Record<string, number | null> = {
  free: 10_000,
  starter: 1_000_000,
  growth: 5_000_000,
  pro: 25_000_000,
  business: 100_000_000,
  enterprise: null,
};

/**
 * Immediately unflag a user's links if their current 30-day click count is now
 * under their (possibly new) plan's cap. Called right after a Stripe plan update.
 * Returns the number of links unflagged.
 */
async function unflagLinksIfUnderCap(userId: string, plan: string): Promise<number> {
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

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = getStripeClient();
    const webhookSecret = getWebhookSecret();

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    await WebhookHandlers.handleUserPlanUpdates(event);
  }

  static async handleUserPlanUpdates(event: any): Promise<void> {
    const type = event.type;

    const handledTypes = [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "customer.subscription.trial_will_end",
      "checkout.session.completed",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
    ];

    if (!handledTypes.includes(type)) {
      return;
    }

    if (type === "checkout.session.completed") {
      const session = event.data?.object;
      if (!session?.customer || session.mode !== "subscription") return;

      const customerId = session.customer;
      const subscriptionId = session.subscription;

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.stripeCustomerId, customerId));

      if (!user || !subscriptionId) return;

      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(subscriptionId as string);
      const priceId = sub.items?.data[0]?.price?.id;

      if (!priceId) return;

      const plan = await WebhookHandlers.planFromPriceId(priceId);

      await db
        .update(usersTable)
        .set({
          plan,
          stripeSubscriptionId: subscriptionId as string,
          stripeSubscriptionStatus: sub.status,
        })
        .where(eq(usersTable.id, user.id));

      logger.info({ userId: user.id, plan, subscriptionId }, "User plan updated from checkout");
      return;
    }

    // invoice.payment_succeeded — backup plan activation for custom Elements checkout
    if (type === "invoice.payment_succeeded") {
      const invoice = event.data?.object;
      if (!invoice?.customer || !invoice?.subscription) return;

      // Only act on subscription invoices (not one-off)
      const reason = invoice.billing_reason;
      if (reason !== "subscription_create" && reason !== "subscription_cycle" && reason !== "subscription_update") return;

      const [invUser] = await db.select().from(usersTable).where(eq(usersTable.stripeCustomerId, invoice.customer));
      if (!invUser) return;

      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      if (sub.status !== "active" && sub.status !== "trialing") return;

      const priceId = sub.items?.data[0]?.price?.id;
      const plan = priceId ? await WebhookHandlers.planFromPriceId(priceId) : null;
      if (!plan || plan === "free") return;

      await db.update(usersTable).set({
        plan,
        stripeSubscriptionId: sub.id,
        stripeSubscriptionStatus: sub.status,
        planRenewsAt: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      }).where(eq(usersTable.id, invUser.id));

      // Immediately unflag links now that they've paid — no need to wait for the 6h scanner.
      try {
        const unflagged = await unflagLinksIfUnderCap(invUser.id, plan);
        if (unflagged > 0) logger.info({ userId: invUser.id, plan, unflagged }, "Auto-unflagged links after payment");
      } catch (err) {
        logger.error({ err, userId: invUser.id }, "Failed to auto-unflag after payment — scanner will catch up");
      }

      logger.info({ userId: invUser.id, plan, reason }, "Plan activated via invoice.payment_succeeded");
      return;
    }

    // invoice.payment_failed — get real status from Stripe and update DB
    if (type === "invoice.payment_failed") {
      const invoice = event.data?.object;
      if (!invoice?.customer || !invoice?.subscription) return;

      const [failUser] = await db.select().from(usersTable).where(eq(usersTable.stripeCustomerId, invoice.customer));
      if (!failUser) return;

      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      // status will be "incomplete" (first payment) or "past_due" (renewal failure)
      const realStatus = sub.status;

      await db.update(usersTable).set({
        stripeSubscriptionStatus: realStatus,
        // If subscription is now past_due, keep the plan but flag it
        // If subscription is incomplete (first payment failed), revert plan to free
        ...(realStatus === "incomplete" ? { plan: "free" } : {}),
      }).where(eq(usersTable.id, failUser.id));

      logger.warn({ userId: failUser.id, status: realStatus, invoiceId: invoice.id }, "Payment failed");
      return;
    }

    const subscription = event.data?.object;
    if (!subscription?.customer) return;

    const customerId = subscription.customer;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, customerId));

    if (!user) return;

    switch (type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = priceId ? await WebhookHandlers.planFromPriceId(priceId) : user.plan;
        const status = subscription.status;

        const updates: any = {
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionStatus: status,
        };

        if (status === "active" || status === "trialing") {
          updates.plan = plan;
        }

        if (subscription.cancel_at) {
          updates.planExpiresAt = new Date(subscription.cancel_at * 1000);
        }
        if (subscription.current_period_end) {
          updates.planRenewsAt = new Date(subscription.current_period_end * 1000);
        }

        // Sync trial fields from Stripe so the dashboard's TrialBanner has
        // something to render. Without this, a Stripe-trialing user has
        // trialEndsAt=NULL in our DB and the banner stays invisible.
        if (status === "trialing" && subscription.trial_end) {
          updates.trialEndsAt = new Date(subscription.trial_end * 1000);
          updates.trialPlan = plan;
        } else if (user.trialEndsAt) {
          // Trial converted to active, was canceled, etc. — clear stale fields
          // so trialStatus() doesn't keep showing a countdown.
          updates.trialEndsAt = null;
          updates.trialPlan = null;
        }

        await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, user.id));

        // When subscription becomes active/trialing, try to unflag links immediately.
        if ((status === "active" || status === "trialing") && plan) {
          try {
            const unflagged = await unflagLinksIfUnderCap(user.id, plan);
            if (unflagged > 0) logger.info({ userId: user.id, plan, unflagged }, "Auto-unflagged links on subscription update");
          } catch (err) {
            logger.error({ err, userId: user.id }, "Failed to auto-unflag after subscription update");
          }
        }

        logger.info({ userId: user.id, plan, status }, "Subscription updated");
        break;
      }

      case "customer.subscription.deleted": {
        await db
          .update(usersTable)
          .set({
            plan: "free",
            stripeSubscriptionStatus: "canceled",
            stripeSubscriptionId: null,
            planRenewsAt: null,
            // Also wipe trial fields — if Stripe deleted the sub mid-trial
            // (no payment method on file at trial end), the user should not
            // keep a stale trial countdown after revert to free.
            trialEndsAt: null,
            trialPlan: null,
          })
          .where(eq(usersTable.id, user.id));

        logger.info({ userId: user.id }, "Subscription deleted — reverted to free");
        break;
      }

      case "customer.subscription.trial_will_end": {
        // Stripe fires this 3 days before the trial ends. Email the user.
        const trialEndIso = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;
        try {
          const { sendTrialEndingEmail } = await import("./email");
          await sendTrialEndingEmail({
            id: user.id,
            name: user.name,
            email: user.email,
            trialEndsAt: trialEndIso,
            planLabel: (user.plan ?? "starter").charAt(0).toUpperCase() + (user.plan ?? "starter").slice(1),
          });
          logger.info({ userId: user.id, trialEnd: trialEndIso }, "Trial-ending email sent");
        } catch (err) {
          logger.error({ err, userId: user.id }, "Failed to send trial-ending email");
        }
        break;
      }
    }
  }

  static async planFromPriceId(priceId: string): Promise<string> {
    try {
      const stripe = getStripeClient();
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = price.product as any;
      const plan = product?.metadata?.plan;
      if (plan && ["starter", "growth", "pro", "business", "enterprise"].includes(plan)) {
        return plan;
      }
    } catch (err) {
      logger.error({ err, priceId }, "Error looking up plan from price");
    }
    return "free";
  }
}
