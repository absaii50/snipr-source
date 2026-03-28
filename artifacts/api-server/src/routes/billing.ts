import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  createCheckout,
  getCustomerPortalUrl,
  verifyWebhookSignature,
  planFromVariantId,
} from "../lib/lemonsqueezy";

const router: IRouter = Router();

const PLAN_VARIANT_MAP: Record<string, string> = {
  pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? "",
  business: process.env.LEMONSQUEEZY_BUSINESS_VARIANT_ID ?? "",
};

router.post("/billing/checkout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { plan } = req.body as { plan?: string };

  if (!plan || !PLAN_VARIANT_MAP[plan]) {
    res.status(400).json({ error: "Invalid plan. Must be 'pro' or 'business'." });
    return;
  }

  const variantId = PLAN_VARIANT_MAP[plan];
  if (!variantId) {
    res.status(503).json({ error: "Billing not configured. Missing variant ID for this plan." });
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

  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  const redirectUrl = `${origin}/billing?upgraded=1`;

  try {
    const checkoutUrl = await createCheckout({
      variantId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      redirectUrl,
    });
    res.json({ url: checkoutUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Failed to create checkout session.", detail: message });
  }
});

router.get("/billing/portal", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user?.lsSubscriptionId) {
    res.status(404).json({ error: "No active subscription found." });
    return;
  }

  try {
    const portalUrl = await getCustomerPortalUrl(user.lsSubscriptionId);
    res.json({ url: portalUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
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

  res.json({
    plan: user.plan,
    status: user.lsSubscriptionStatus ?? null,
    subscriptionId: user.lsSubscriptionId ?? null,
    renewsAt: user.planRenewsAt ?? null,
    expiresAt: user.planExpiresAt ?? null,
  });
});

router.post("/billing/webhook", async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers["x-signature"] as string | undefined;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!signature || !rawBody) {
    res.status(400).json({ error: "Missing signature or body." });
    return;
  }

  let valid = false;
  try {
    valid = await verifyWebhookSignature(rawBody, signature);
  } catch {
    res.status(503).json({ error: "Webhook secret not configured." });
    return;
  }

  if (!valid) {
    res.status(401).json({ error: "Invalid signature." });
    return;
  }

  const event = req.body as {
    meta: {
      event_name: string;
      custom_data?: { user_id?: string };
    };
    data: {
      id: string;
      attributes: {
        customer_id: number;
        variant_id: number;
        status: string;
        renews_at: string | null;
        ends_at: string | null;
      };
    };
  };

  const eventName = event.meta?.event_name;
  const userId = event.meta?.custom_data?.user_id;
  const sub = event.data?.attributes;
  const subscriptionId = event.data?.id;

  if (!userId) {
    res.status(200).json({ received: true, note: "No user_id in custom_data — skipped." });
    return;
  }

  const variantId = String(sub.variant_id);
  const plan = await planFromVariantId(variantId);

  switch (eventName) {
    case "subscription_created":
    case "subscription_updated":
    case "subscription_resumed": {
      await db
        .update(usersTable)
        .set({
          plan,
          lsCustomerId: String(sub.customer_id),
          lsSubscriptionId: subscriptionId,
          lsVariantId: variantId,
          lsSubscriptionStatus: sub.status,
          planRenewsAt: sub.renews_at ? new Date(sub.renews_at) : null,
          planExpiresAt: sub.ends_at ? new Date(sub.ends_at) : null,
        })
        .where(eq(usersTable.id, userId));
      break;
    }

    case "subscription_cancelled": {
      await db
        .update(usersTable)
        .set({
          lsSubscriptionStatus: "cancelled",
          planExpiresAt: sub.ends_at ? new Date(sub.ends_at) : null,
        })
        .where(eq(usersTable.id, userId));
      break;
    }

    case "subscription_expired": {
      await db
        .update(usersTable)
        .set({
          plan: "free",
          lsSubscriptionStatus: "expired",
          planRenewsAt: null,
        })
        .where(eq(usersTable.id, userId));
      break;
    }

    case "subscription_paused": {
      await db
        .update(usersTable)
        .set({ lsSubscriptionStatus: "paused" })
        .where(eq(usersTable.id, userId));
      break;
    }
  }

  res.status(200).json({ received: true });
});

export default router;
