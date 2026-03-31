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

    if (!type?.startsWith("customer.subscription.") && type !== "checkout.session.completed") {
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
