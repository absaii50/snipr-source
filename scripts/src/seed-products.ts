import Stripe from "stripe";

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (
    !connectionSettings ||
    !connectionSettings.settings.publishable ||
    !connectionSettings.settings.secret
  ) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

const PLANS = [
  {
    name: "Pro",
    description: "For marketers and creators — branded links, advanced analytics, AI insights, and priority support.",
    metadata: { plan: "pro" },
    priceAmountCents: 1900,
    interval: "month" as const,
  },
  {
    name: "Business",
    description: "For growing teams — custom domains, team management, conversion tracking, API access, and dedicated support.",
    metadata: { plan: "business" },
    priceAmountCents: 4900,
    interval: "month" as const,
  },
];

async function main() {
  console.log("🔑 Getting Stripe credentials...");
  const { secretKey } = await getCredentials();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });

  for (const plan of PLANS) {
    console.log(`\n📦 Creating product: ${plan.name}`);

    const existingProducts = await stripe.products.list({ limit: 100, active: true });
    const existing = existingProducts.data.find(
      (p) => p.metadata?.plan === plan.metadata.plan
    );

    if (existing) {
      console.log(`  ✅ Product already exists: ${existing.id} (${existing.name})`);

      const prices = await stripe.prices.list({ product: existing.id, active: true });
      if (prices.data.length > 0) {
        console.log(`  ✅ Price already exists: ${prices.data[0].id} ($${(prices.data[0].unit_amount || 0) / 100}/${prices.data[0].recurring?.interval})`);
        continue;
      }
    }

    let productId: string;
    if (existing) {
      productId = existing.id;
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata,
      });
      productId = product.id;
      console.log(`  ✅ Created product: ${productId}`);
    }

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.priceAmountCents,
      currency: "usd",
      recurring: { interval: plan.interval },
      metadata: plan.metadata,
    });
    console.log(`  ✅ Created price: ${price.id} ($${plan.priceAmountCents / 100}/${plan.interval})`);
  }

  console.log("\n🎉 Done! Products and prices seeded in Stripe.");
  console.log("   Restart the API server to sync these into the local stripe schema.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
