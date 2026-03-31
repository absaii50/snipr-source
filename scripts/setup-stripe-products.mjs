/**
 * Stripe Products Setup Script
 * Run once to create all plans in Stripe automatically.
 *
 * Usage:
 *   node scripts/setup-stripe-products.mjs
 *
 * Requires STRIPE_SECRET_KEY in environment (or .env file).
 */

import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
try {
  const envPath = resolve(__dirname, "../.env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — rely on environment variables already set
}

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("❌  STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2025-04-30.basil" });

const PLANS = [
  {
    plan: "starter",
    name: "Starter",
    description: "For personal projects — 1M clicks/month, 1 custom domain",
    monthlyAmount: 400,    // $4.00
    annualAmount:  3800,   // $38.00/yr
  },
  {
    plan: "growth",
    name: "Growth",
    description: "For creators & marketers — 5M clicks/month, 3 custom domains",
    monthlyAmount: 1200,   // $12.00
    annualAmount:  11500,  // $115.00/yr
  },
  {
    plan: "pro",
    name: "Pro",
    description: "For growing businesses — 25M clicks/month, 10 custom domains",
    monthlyAmount: 2900,   // $29.00
    annualAmount:  27800,  // $278.00/yr
  },
  {
    plan: "business",
    name: "Business",
    description: "For scaling teams — 100M clicks/month, unlimited domains",
    monthlyAmount: 7900,   // $79.00
    annualAmount:  75800,  // $758.00/yr
  },
  {
    plan: "enterprise",
    name: "Enterprise",
    description: "For large organisations — unlimited clicks & domains",
    monthlyAmount: 14900,  // $149.00
    annualAmount:  143000, // $1,430.00/yr
  },
];

async function getExistingProducts() {
  const products = await stripe.products.list({ active: true, limit: 100 });
  return products.data;
}

async function setupPlan(planConfig, existingProducts) {
  const { plan, name, description, monthlyAmount, annualAmount } = planConfig;

  // Check if product already exists (by metadata)
  const existing = existingProducts.find((p) => p.metadata?.plan === plan);

  let product;
  if (existing) {
    console.log(`  ⟳  Product already exists: ${name} (${existing.id})`);
    product = existing;
  } else {
    product = await stripe.products.create({
      name,
      description,
      metadata: { plan },
    });
    console.log(`  ✓  Created product: ${name} (${product.id})`);
  }

  // Check existing prices for this product
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const hasMonthly = prices.data.some((p) => p.recurring?.interval === "month");
  const hasAnnual  = prices.data.some((p) => p.recurring?.interval === "year");

  if (hasMonthly) {
    console.log(`       Monthly price already exists — skipping`);
  } else {
    await stripe.prices.create({
      product: product.id,
      unit_amount: monthlyAmount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { plan, billing: "monthly" },
    });
    console.log(`       Created monthly price: $${(monthlyAmount / 100).toFixed(2)}/mo`);
  }

  if (hasAnnual) {
    console.log(`       Annual price already exists — skipping`);
  } else {
    await stripe.prices.create({
      product: product.id,
      unit_amount: annualAmount,
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { plan, billing: "annual" },
    });
    console.log(`       Created annual price: $${(annualAmount / 100).toFixed(2)}/yr`);
  }
}

async function main() {
  console.log("\n🚀  Snipr — Stripe Products Setup\n");

  const mode = secretKey.startsWith("sk_live") || secretKey.startsWith("rk_live") ? "LIVE" : "TEST";
  console.log(`   Mode: ${mode}`);
  console.log(`   Key:  ${secretKey.slice(0, 12)}...\n`);

  if (mode === "LIVE") {
    console.log("⚠️   You are using a LIVE key — real products will be created.\n");
  }

  let existingProducts;
  try {
    existingProducts = await getExistingProducts();
  } catch (err) {
    console.error("❌  Failed to connect to Stripe:", err.message);
    if (err.message?.includes("restricted")) {
      console.error("\n   Your restricted key may be missing permissions.");
      console.error("   Required: Products (read), Prices (write), Customers (write), Checkout Sessions (write)");
    }
    process.exit(1);
  }

  console.log(`   Found ${existingProducts.length} existing product(s) in Stripe.\n`);

  for (const planConfig of PLANS) {
    console.log(`📦  ${planConfig.name}`);
    try {
      await setupPlan(planConfig, existingProducts);
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
    console.log();
  }

  console.log("✅  Done! All Stripe products and prices are set up.\n");
  console.log("   Next steps:");
  console.log("   1. Make sure STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are set on your production server");
  console.log("   2. Restart snipr-api: systemctl restart snipr-api");
  console.log("   3. Go to /checkout?plan=starter to test\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
