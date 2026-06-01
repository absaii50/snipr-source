import app from "./app";
import { logger } from "./lib/logger";
import { startDomainVerifierWatcher } from "./lib/domain-verifier-watcher";
import { startHealthMonitor } from "./lib/health-monitor";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Validate Stripe config at startup (non-fatal)
if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn("STRIPE_SECRET_KEY not set — billing features will not work");
}
if (!process.env.STRIPE_PUBLISHABLE_KEY) {
  logger.warn("STRIPE_PUBLISHABLE_KEY not set — billing features will not work");
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  logger.warn("STRIPE_WEBHOOK_SECRET not set — webhooks will not be verified");
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  // Background watcher: auto-verifies pending custom domains once DNS propagates
  startDomainVerifierWatcher();
  // 24/7 synthetic bug detector — see lib/health-monitor.ts
  startHealthMonitor();
});
