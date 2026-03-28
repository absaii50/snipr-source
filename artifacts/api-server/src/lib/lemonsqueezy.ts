import crypto from "crypto";
import { getConfig } from "./config";

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

async function lsRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const key = await getConfig("LEMONSQUEEZY_API_KEY");
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY is not configured. Add it via Replit Secrets or the Admin Settings panel.");

  const res = await fetch(`${LS_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface CheckoutOptions {
  variantId: string;
  userId: string;
  userEmail: string;
  userName: string;
  redirectUrl: string;
}

export async function createCheckout(opts: CheckoutOptions): Promise<string> {
  const storeId = await getConfig("LEMONSQUEEZY_STORE_ID");
  if (!storeId) throw new Error("LEMONSQUEEZY_STORE_ID is not configured.");

  const data = await lsRequest<{ data: { attributes: { url: string } } }>(
    "POST",
    "/checkouts",
    {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: opts.userEmail,
            name: opts.userName,
            custom: { user_id: opts.userId },
          },
          product_options: {
            redirect_url: opts.redirectUrl,
          },
          checkout_options: {
            button_color: "#728DA7",
            embed: false,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: opts.variantId } },
        },
      },
    },
  );

  return data.data.attributes.url;
}

export async function getCustomerPortalUrl(subscriptionId: string): Promise<string> {
  const data = await lsRequest<{
    data: { attributes: { urls: { customer_portal: string } } };
  }>("GET", `/subscriptions/${subscriptionId}`);
  return data.data.attributes.urls.customer_portal;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await lsRequest("DELETE", `/subscriptions/${subscriptionId}`);
}

export async function verifyWebhookSignature(rawBody: Buffer | string, signature: string): Promise<boolean> {
  const secret = await getConfig("LEMONSQUEEZY_WEBHOOK_SECRET");
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured.");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export async function planFromVariantId(variantId: string): Promise<"pro" | "business" | "free"> {
  const proId = await getConfig("LEMONSQUEEZY_PRO_VARIANT_ID");
  const bizId = await getConfig("LEMONSQUEEZY_BUSINESS_VARIANT_ID");
  if (variantId === proId) return "pro";
  if (variantId === bizId) return "business";
  return "free";
}
