import Stripe from 'stripe';

let cachedStripe: Stripe | null = null;

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  return key;
}

export function getStripeClient(): Stripe {
  if (!cachedStripe) {
    cachedStripe = new Stripe(getSecretKey(), {
      apiVersion: '2025-04-30.basil' as any,
    });
  }
  return cachedStripe;
}


export async function getStripePublishableKey(): Promise<string> {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error('STRIPE_PUBLISHABLE_KEY environment variable is not set');
  return key;
}

export async function getStripeSecretKey(): Promise<string> {
  return getSecretKey();
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
  return secret;
}
