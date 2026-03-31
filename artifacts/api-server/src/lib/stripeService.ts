import { getStripeClient } from './stripeClient';
import { stripeStorage } from './stripeStorage';

export class StripeService {
  async createCustomer(email: string, userId: string, name: string) {
    const stripe = getStripeClient();
    return await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
  }

  async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = getStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async createEmbeddedCheckoutSession(customerId: string, priceId: string, returnUrl: string) {
    const stripe = getStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      ui_mode: 'embedded',
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    });
  }

  async getCheckoutSessionStatus(sessionId: string) {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      status: session.status,
      customerEmail: session.customer_details?.email ?? null,
    };
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = getStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    return await stripeStorage.getProduct(productId);
  }

  async getSubscription(subscriptionId: string) {
    return await stripeStorage.getSubscription(subscriptionId);
  }
}

export const stripeService = new StripeService();
