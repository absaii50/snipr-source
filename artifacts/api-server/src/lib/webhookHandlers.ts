import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getStripeClient, getWebhookSecret } from "./stripeClient";
import { logger } from "./logger";
import { unflagLinksIfUnderCap } from "./plan-enforcement";
import { invalidatePlanCache } from "./plan-gate";

/**
 * Read the current billing period end from a Stripe subscription. As of API
 * 2025-04-30.basil, `current_period_end` moved from the subscription level to
 * the subscription items array (since different items can have different
 * cycles). Older API versions still have it at the top level — we fall back
 * so both paths work.
 */
function getPeriodEndUnix(sub: any): number | null {
  const itemEnd = sub?.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number") return itemEnd;
  if (typeof sub?.current_period_end === "number") return sub.current_period_end;
  return null;
}

// PLAN_CLICK_CAPS + unflagLinksIfUnderCap live in lib/plan-enforcement.ts so
// admin manual plan changes can reuse the same logic.

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

      invalidatePlanCache(user.id);
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

      const periodEnd = getPeriodEndUnix(sub);
      await db.update(usersTable).set({
        plan,
        stripeSubscriptionId: sub.id,
        stripeSubscriptionStatus: sub.status,
        planRenewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
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

    // invoice.payment_failed — get real status from Stripe and update DB.
    // Also fires a single dunning email per billing cycle so the user can
    // actually fix the card before Stripe gives up.
    if (type === "invoice.payment_failed") {
      const invoice = event.data?.object;
      if (!invoice?.customer || !invoice?.subscription) return;

      const [failUser] = await db.select().from(usersTable).where(eq(usersTable.stripeCustomerId, invoice.customer));
      if (!failUser) return;

      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const realStatus = sub.status; // "incomplete" or "past_due"

      await db.update(usersTable).set({
        stripeSubscriptionStatus: realStatus,
        ...(realStatus === "incomplete" ? { plan: "free" } : {}),
      }).where(eq(usersTable.id, failUser.id));

      logger.warn({ userId: failUser.id, status: realStatus, invoiceId: invoice.id }, "Payment failed");

      // Only email on renewal failures (past_due) — first-payment failures
      // (incomplete) are handled by the checkout UI, no need to email those.
      if (realStatus === "past_due") {
        try {
          // Anti-spam: only send one payment_failed email per 25 days so we
          // don't blast the user every retry. Stripe retries 3-4 times over
          // ~1 week, so one email at the first failure is enough.
          const recent = await db.execute(sql`
            SELECT 1 FROM email_logs
            WHERE user_id = ${failUser.id}
              AND type = 'payment_failed'
              AND status = 'sent'
              AND created_at > NOW() - INTERVAL '25 days'
            LIMIT 1
          `);
          if (((recent.rows ?? recent) as any[]).length === 0) {
            const planLabel = (failUser.plan ?? "starter").charAt(0).toUpperCase() + (failUser.plan ?? "starter").slice(1);
            const amount = invoice.amount_due
              ? `$${(invoice.amount_due / 100).toFixed(2)} ${(invoice.currency ?? "USD").toUpperCase()}`
              : "your subscription fee";
            const nextRetryDate = invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000).toLocaleString("en-US", {
                  weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
                  timeZoneName: "short",
                })
              : null;
            const { sendPaymentFailedEmail } = await import("./email");
            await sendPaymentFailedEmail({
              id: failUser.id,
              name: failUser.name,
              email: failUser.email,
              planLabel,
              amount,
              nextRetryDate,
            });
            logger.info({ userId: failUser.id, invoiceId: invoice.id }, "Sent payment_failed dunning email");
          } else {
            logger.info({ userId: failUser.id }, "Skipped payment_failed email (sent within last 25 days)");
          }
        } catch (err) {
          logger.error({ err, userId: failUser.id }, "Failed to send payment_failed email");
        }
      }
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

        if (status === "active") {
          updates.plan = plan;
        }

        if (subscription.cancel_at) {
          updates.planExpiresAt = new Date(subscription.cancel_at * 1000);
        }
        const periodEndSec = getPeriodEndUnix(subscription);
        if (periodEndSec) {
          updates.planRenewsAt = new Date(periodEndSec * 1000);
        }

        await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, user.id));

        invalidatePlanCache(user.id);

        // When subscription becomes active, try to unflag links immediately.
        if (status === "active" && plan) {
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
        const priorPlan = user.plan;
        await db
          .update(usersTable)
          .set({
            plan: "free",
            stripeSubscriptionStatus: "canceled",
            stripeSubscriptionId: null,
            planRenewsAt: null,
          })
          .where(eq(usersTable.id, user.id));

        logger.info({ userId: user.id }, "Subscription deleted — reverted to free");

        // Tell the user their subscription is gone so they're not surprised
        // when they hit plan limits next time. Skip when they were already on
        // free (no real loss of access) or never had a paid plan in the first
        // place (e.g. trial-only signup that never paid).
        if (priorPlan && priorPlan !== "free") {
          try {
            const { sendSubscriptionCanceledEmail } = await import("./email");
            const planLabel = priorPlan.charAt(0).toUpperCase() + priorPlan.slice(1);
            await sendSubscriptionCanceledEmail({
              id: user.id,
              name: user.name,
              email: user.email,
              planLabel,
            });
            logger.info({ userId: user.id, priorPlan }, "Sent subscription_canceled email");
          } catch (err) {
            logger.error({ err, userId: user.id }, "Failed to send subscription_canceled email");
          }
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
