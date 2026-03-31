import { getStripeClient } from './stripeClient';
import { logger } from './logger';

export class StripeStorage {
  async getProduct(productId: string) {
    try {
      const stripe = getStripeClient();
      return await stripe.products.retrieve(productId);
    } catch {
      return null;
    }
  }

  async listProducts(active = true) {
    const stripe = getStripeClient();
    const result = await stripe.products.list({ active, limit: 100 });
    return result.data;
  }

  async listProductsWithPrices(active = true) {
    const stripe = getStripeClient();
    const products = await stripe.products.list({ active, limit: 100 });
    const rows: any[] = [];

    for (const product of products.data) {
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
      if (prices.data.length === 0) {
        rows.push({
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          product_active: product.active,
          product_metadata: product.metadata,
          price_id: null,
          unit_amount: null,
          currency: null,
          recurring: null,
          price_active: null,
          price_metadata: null,
        });
      } else {
        for (const price of prices.data) {
          rows.push({
            product_id: product.id,
            product_name: product.name,
            product_description: product.description,
            product_active: product.active,
            product_metadata: product.metadata,
            price_id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring,
            price_active: price.active,
            price_metadata: price.metadata,
          });
        }
      }
    }

    return rows;
  }

  async getPrice(priceId: string) {
    try {
      const stripe = getStripeClient();
      return await stripe.prices.retrieve(priceId);
    } catch {
      return null;
    }
  }

  async getPricesForProduct(productId: string) {
    const stripe = getStripeClient();
    const result = await stripe.prices.list({ product: productId, active: true, limit: 10 });
    return result.data;
  }

  async getSubscription(subscriptionId: string) {
    try {
      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        ...sub,
        current_period_end: sub.current_period_end,
        cancel_at: sub.cancel_at,
      };
    } catch {
      return null;
    }
  }

  async getCustomerSubscriptions(customerId: string) {
    try {
      const stripe = getStripeClient();
      const result = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
      return result.data[0] || null;
    } catch {
      return null;
    }
  }
}

export const stripeStorage = new StripeStorage();
