import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getStripeClient, getWebhookSecret } from "./stripeClient";
import { logger } from "./logger";

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

        await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, user.id));

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
          })
          .where(eq(usersTable.id, user.id));

        logger.info({ userId: user.id }, "Subscription deleted — reverted to free");
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
