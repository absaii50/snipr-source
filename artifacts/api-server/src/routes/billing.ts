import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, linksTable, workspacesTable, clickEventsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { stripeService } from "../lib/stripeService";
import { stripeStorage } from "../lib/stripeStorage";
import { getStripePublishableKey, getStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_PLANS = ["starter", "growth", "pro", "business", "enterprise"] as const;
type PlanName = typeof VALID_PLANS[number];

/** Monthly click cap per plan. null = unlimited (enterprise). */
const PLAN_CLICK_CAPS: Record<string, number | null> = {
  free: 10_000,
  starter: 1_000_000,
  growth: 5_000_000,
  pro: 25_000_000,
  business: 100_000_000,
  enterprise: null,
};

function isValidPlan(plan: string): plan is PlanName {
  return VALID_PLANS.includes(plan as PlanName);
}

function getFrontendBaseUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  return "http://localhost:3000";
}

/** Find the monthly price for a plan by matching product metadata */
async function findMonthlyPriceForPlan(plan: string, billing?: string): Promise<string | null> {
  const interval = billing === "annual" ? "year" : "month";

  // Query Stripe API directly
  const stripe = getStripeClient();
  const products = await stripe.products.list({ active: true, limit: 100 });
  const match = products.data.find((p) => p.metadata?.plan === plan);
  if (!match) return null;

  const prices = await stripe.prices.list({ product: match.id, active: true, limit: 10 });
  // Find price matching the requested interval
  const price = prices.data.find((p) => p.recurring?.interval === interval)
    ?? prices.data[0]; // fallback to any price
  return price?.id ?? null;
}

router.post("/billing/checkout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { plan, billing } = req.body as { plan?: string; billing?: string };

  if (!plan || !isValidPlan(plan)) {
    res.status(400).json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}` });
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

    const priceId = await findMonthlyPriceForPlan(plan, billing);

    if (!priceId) {
      res.status(503).json({ error: `No Stripe product found for plan: ${plan}.` });
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
        // Stripe API returns timestamps as seconds (not ms)
        renewsAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        expiresAt = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null;
      }
    } catch {
      // Stripe API may be unavailable
    }
  }

  // Usage + flag state for the dashboard banner
  const cap = PLAN_CLICK_CAPS[user.plan] ?? null;
  const [{ clicks30d, flaggedCount }] = await db
    .select({
      clicks30d: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${clickEventsTable} ce
        JOIN ${linksTable} l ON l.id = ce.link_id
        JOIN ${workspacesTable} w ON w.id = l.workspace_id
        WHERE w.user_id = ${user.id}
          AND ce.timestamp > NOW() - INTERVAL '30 days'
      )`,
      flaggedCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${linksTable} l
        JOIN ${workspacesTable} w ON w.id = l.workspace_id
        WHERE w.user_id = ${user.id}
          AND l.flagged_at IS NOT NULL
      )`,
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  // When did we last send this user an upgrade email? Drives the banner countdown.
  const lastEmailResult = await db.execute(sql`
    SELECT created_at
    FROM email_logs
    WHERE user_id = ${user.id}
      AND (type = 'upgrade_monthly_cap' OR type LIKE 'abuse_warning%')
      AND status = 'sent'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const lastEmailRow = (lastEmailResult.rows?.[0] ?? lastEmailResult[0] ?? null) as { created_at: Date | string } | null;

  const used = Number(clicks30d ?? 0);
  const percent = cap ? Math.round((used / cap) * 100) : 0;
  const isFlagged = Number(flaggedCount ?? 0) > 0;
  const overCap = cap !== null && used >= cap;

  let bannerState: "ok" | "warning" | "over_cap" | "flagged" = "ok";
  if (isFlagged) bannerState = "flagged";
  else if (overCap) bannerState = "over_cap";
  else if (percent >= 80) bannerState = "warning";

  let hoursUntilEnforcement: number | null = null;
  if (bannerState === "over_cap" && lastEmailRow?.created_at) {
    const emailedAt = new Date(lastEmailRow.created_at).getTime();
    const enforceAt = emailedAt + 3 * 24 * 60 * 60 * 1000;
    const remaining = Math.max(0, Math.round((enforceAt - Date.now()) / (1000 * 60 * 60)));
    hoursUntilEnforcement = remaining;
  }

  res.json({
    plan: user.plan,
    status: user.stripeSubscriptionStatus ?? null,
    subscriptionId: user.stripeSubscriptionId ?? null,
    renewsAt: renewsAt ?? user.planRenewsAt ?? null,
    expiresAt: expiresAt ?? user.planExpiresAt ?? null,
    usage: {
      clicks30d: used,
      cap,
      percent,
      overCap,
      isFlagged,
      flaggedLinksCount: Number(flaggedCount ?? 0),
      bannerState,
      hoursUntilEnforcement,
      nextPlanHint:
        user.plan === "free" ? "starter" :
        user.plan === "starter" ? "growth" :
        user.plan === "growth" ? "pro" :
        user.plan === "pro" ? "business" :
        user.plan === "business" ? "enterprise" : null,
    },
  });
});

router.post("/billing/create-checkout-session", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { plan, billing } = req.body as { plan?: string; billing?: string };

  if (!plan || !isValidPlan(plan)) {
    res.status(400).json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}` });
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

    const priceId = await findMonthlyPriceForPlan(plan, billing);

    if (!priceId) {
      res.status(503).json({ error: `No Stripe product found for plan: ${plan}.` });
      return;
    }

    const baseUrl = getFrontendBaseUrl();
    const session = await stripeService.createEmbeddedCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/checkout/return`
    );

    res.json({ clientSecret: session.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to create embedded checkout session");
    res.status(502).json({ error: "Failed to create checkout session.", detail: message });
  }
});

router.get("/billing/session-status", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.query.session_id as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: "Missing session_id parameter." });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!));

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const sessionCustomer = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
    // SECURITY: Always verify session belongs to this user's Stripe customer
    if (!user.stripeCustomerId || !sessionCustomer || sessionCustomer !== user.stripeCustomerId) {
      res.status(403).json({ error: "Forbidden." });
      return;
    }

    res.json({ status: session.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to get session status");
    res.status(502).json({ error: "Failed to get session status.", detail: message });
  }
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

interface BillingDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** Custom checkout: create subscription with payment intent so we can use Stripe Elements */
router.post("/billing/create-subscription-intent", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { plan, billing, billingDetails } = req.body as {
    plan?: string;
    billing?: string;
    billingDetails?: BillingDetails;
  };

  if (!plan || !isValidPlan(plan)) {
    res.status(400).json({ error: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}` });
    return;
  }

  if (!billingDetails?.firstName || !billingDetails?.lastName || !billingDetails?.email || !billingDetails?.address) {
    res.status(400).json({ error: "Billing details are required." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(401).json({ error: "User not found." }); return; }

  try {
    const stripe = getStripeClient();

    // Create or update Stripe customer with full billing details
    let customerId = user.stripeCustomerId;
    const customerData = {
      email: billingDetails.email,
      name: `${billingDetails.firstName} ${billingDetails.lastName}`,
      phone: billingDetails.phone,
      address: {
        line1: billingDetails.address,
        city: billingDetails.city,
        state: billingDetails.state,
        postal_code: billingDetails.postalCode,
        country: billingDetails.country,
      },
      metadata: { userId: user.id },
    };

    if (customerId) {
      await stripe.customers.update(customerId, customerData);
    } else {
      const customer = await stripe.customers.create(customerData);
      customerId = customer.id;
    }

    const priceId = await findMonthlyPriceForPlan(plan, billing);
    if (!priceId) {
      res.status(503).json({ error: `No Stripe product found for plan: ${plan}.` });
      return;
    }

    // Reuse existing incomplete subscription for this customer+price (avoids duplicates on retry)
    let subscription: any = null;
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "incomplete",
      limit: 10,
      expand: ["data.latest_invoice.confirmation_secret"],
    });
    for (const sub of existingSubs.data) {
      if (sub.items.data.some((item: any) => item.price.id === priceId)) {
        subscription = sub;
        break;
      }
    }

    // No reusable subscription — create a new one
    if (!subscription) {
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.confirmation_secret"],
      });
    }

    // Resolve client_secret — Stripe v21 (API 2025-04-30.basil)
    // uses invoice.confirmation_secret.client_secret instead of invoice.payment_intent.client_secret
    let clientSecret: string | null = null;
    const latestInvoice = subscription.latest_invoice;

    const invoiceId = typeof latestInvoice === "string"
      ? latestInvoice
      : latestInvoice?.id;

    // 1. Try confirmation_secret from expanded invoice (Stripe v21+)
    if (latestInvoice && typeof latestInvoice === "object") {
      const cs = (latestInvoice as any).confirmation_secret;
      if (cs?.client_secret) {
        clientSecret = cs.client_secret;
      }
    }

    // 2. Fallback: retrieve invoice with explicit expand
    if (!clientSecret && invoiceId) {
      const inv = await stripe.invoices.retrieve(invoiceId, {
        expand: ["confirmation_secret"],
      }) as any;
      if (inv.confirmation_secret?.client_secret) {
        clientSecret = inv.confirmation_secret.client_secret;
      }
    }

    if (!clientSecret) {
      logger.error({ subscriptionId: subscription.id, invoiceId }, "Could not resolve client_secret");
      res.status(502).json({ error: "Could not initialize payment. Please try again." });
      return;
    }

    // Save billing details + stripe IDs to DB
    await db.update(usersTable).set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      billingDetails,
    } as any).where(eq(usersTable.id, user.id));

    res.json({
      clientSecret,
      subscriptionId: subscription.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to create subscription intent");
    res.status(502).json({ error: "Failed to start checkout.", detail: message });
  }
});

router.get("/billing/plans", async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await stripeStorage.listProductsWithPrices(true);

    // Sort order for plans
    const planOrder: Record<string, number> = { starter: 1, growth: 2, pro: 3, business: 4, enterprise: 5 };

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

    // Sort plans by tier order
    plans.sort((a: any, b: any) => {
      const orderA = planOrder[a.metadata?.plan] ?? 99;
      const orderB = planOrder[b.metadata?.plan] ?? 99;
      return orderA - orderB;
    });

    res.json({ plans });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to list plans");
    res.status(500).json({ error: "Failed to load plans." });
  }
});

export default router;
