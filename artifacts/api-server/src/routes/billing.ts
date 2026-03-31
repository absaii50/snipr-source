import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { stripeService } from "../lib/stripeService";
import { stripeStorage } from "../lib/stripeStorage";
import { getStripePublishableKey, getUncachableStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getFrontendBaseUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:3000";
}

router.post("/billing/checkout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { plan } = req.body as { plan?: string };

  if (!plan || !["pro", "business"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan. Must be 'pro' or 'business'." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(401).json({ error: "User not found." });
    return;
  }

  try {
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id, user.name);
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, user.id));
    }

    let priceId: string | null = null;

    const localProducts = await stripeStorage.listProductsWithPrices(true);
    const localMatch = localProducts.find((p: any) => p.product_metadata?.plan === plan);
    if (localMatch?.price_id) {
      priceId = localMatch.price_id;
    }

    if (!priceId) {
      const stripe = await getUncachableStripeClient();
      const apiProducts = await stripe.products.list({ active: true, limit: 100 });
      const match = apiProducts.data.find((p) => p.metadata?.plan === plan);
      if (match) {
        const prices = await stripe.prices.list({ product: match.id, active: true, limit: 1 });
        priceId = prices.data[0]?.id ?? null;
      }
    }

    if (!priceId) {
      res.status(503).json({ error: `No Stripe product found for plan: ${plan}. Run the seed script first.` });
      return;
    }

    const baseUrl = getFrontendBaseUrl();
    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/billing?upgraded=1`,
      `${baseUrl}/pricing`
    );

    res.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to create checkout session");
    res.status(502).json({ error: "Failed to create checkout session.", detail: message });
  }
});

router.get("/billing/portal", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user?.stripeCustomerId) {
    res.status(404).json({ error: "No billing account found." });
    return;
  }

  try {
    const baseUrl = getFrontendBaseUrl();
    const portalSession = await stripeService.createCustomerPortalSession(
      user.stripeCustomerId,
      `${baseUrl}/billing`
    );
    res.json({ url: portalSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to create portal session");
    res.status(502).json({ error: "Failed to retrieve billing portal.", detail: message });
  }
});

router.get("/billing/subscription", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  let renewsAt: string | null = null;
  let expiresAt: string | null = null;

  if (user.stripeSubscriptionId) {
    try {
      const sub = await stripeStorage.getSubscription(user.stripeSubscriptionId);
      if (sub) {
        renewsAt = sub.current_period_end ? new Date(Number(sub.current_period_end) * 1000).toISOString() : null;
        expiresAt = sub.cancel_at ? new Date(Number(sub.cancel_at) * 1000).toISOString() : null;
      }
    } catch {
      // Stripe schema may not have synced yet
    }
  }

  res.json({
    plan: user.plan,
    status: user.stripeSubscriptionStatus ?? null,
    subscriptionId: user.stripeSubscriptionId ?? null,
    renewsAt: renewsAt ?? user.planRenewsAt ?? null,
    expiresAt: expiresAt ?? user.planExpiresAt ?? null,
  });
});

router.get("/billing/publishable-key", async (_req: Request, res: Response): Promise<void> => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to get Stripe publishable key");
    res.status(500).json({ error: "Billing not configured." });
  }
});

router.get("/billing/plans", async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await stripeStorage.listProductsWithPrices(true);

    const plans = products.reduce((acc: any[], row: any) => {
      let existing = acc.find((p) => p.productId === row.product_id);
      if (!existing) {
        existing = {
          productId: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: [],
        };
        acc.push(existing);
      }
      if (row.price_id) {
        existing.prices.push({
          priceId: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
      return acc;
    }, []);

    res.json({ plans });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to list plans");
    res.status(500).json({ error: "Failed to load plans." });
  }
});

export default router;
