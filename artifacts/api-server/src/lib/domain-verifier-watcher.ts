import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, domainsTable, workspacesTable, usersTable, emailLogsTable } from "@workspace/db";
import { checkDomainDns } from "./dns-utils";
import { sendDomainVerifiedEmail } from "./email";
import { logger } from "./logger";

/**
 * Background watcher that auto-verifies a domain when DNS finally propagates.
 *
 * Why this exists: the previous flow forced the user to click "Verify" each
 * time. Real-world DNS propagation can take 30+ minutes — users would walk
 * away and never come back. This watcher polls every WATCHER_INTERVAL_MS for
 * unverified domains added in the last WATCH_WINDOW_HOURS, runs the same
 * DNS check the manual endpoint runs, and on success marks `verified=true`
 * + emails the owner.
 *
 * Designed to be cheap:
 *   - SQL pre-filter: only domains in the window, not verified, not platform
 *   - Drops itself if the row is gone (deleted while polling)
 *   - Per-poll concurrency cap so we don't fan out 100 dns lookups at once
 */
const WATCHER_INTERVAL_MS = 30 * 1000;       // every 30 s
const WATCH_WINDOW_HOURS = 24;               // give up after 24 h of trying
const MAX_PARALLEL_PER_TICK = 5;             // don't blast resolvers
const EMAIL_TYPE = "domain_verified";

let timer: NodeJS.Timeout | null = null;
let runningTick = false;

async function pollOnce(): Promise<void> {
  if (runningTick) return; // skip if previous tick still in flight
  runningTick = true;
  try {
    // Pull recently-added unverified custom domains
    const candidates = await db
      .select({
        id: domainsTable.id,
        domain: domainsTable.domain,
        workspaceId: domainsTable.workspaceId,
      })
      .from(domainsTable)
      .where(and(
        eq(domainsTable.verified, false),
        eq(domainsTable.isPlatformDomain, false),
        gt(domainsTable.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(WATCH_WINDOW_HOURS))} hours'`),
      ))
      .limit(50);

    if (candidates.length === 0) return;

    // Process in batches of MAX_PARALLEL_PER_TICK
    for (let i = 0; i < candidates.length; i += MAX_PARALLEL_PER_TICK) {
      const batch = candidates.slice(i, i + MAX_PARALLEL_PER_TICK);
      await Promise.all(batch.map((c) => tryVerifyOne(c)));
    }
  } catch (err) {
    logger.error({ err }, "Domain watcher tick failed");
  } finally {
    runningTick = false;
  }
}

async function tryVerifyOne(d: { id: string; domain: string; workspaceId: string }): Promise<void> {
  try {
    // Lazy import to avoid a top-level cycle with dns-utils
    const { getDomainVerifyToken } = await import("./dns-utils");
    const token = getDomainVerifyToken(d.id);
    const dnsResult = await checkDomainDns(d.domain, token);

    if (!dnsResult.ready) {
      return; // not yet — try again next tick
    }

    // Mark verified. A concurrent manual verify is fine — both end up with
    // verified=true. SSL provisioning is picked up by the ssl-manager.
    const updated = await db
      .update(domainsTable)
      .set({ verified: true, verifiedAt: new Date(), sslStatus: "pending" })
      .where(and(eq(domainsTable.id, d.id), eq(domainsTable.verified, false)))
      .returning({ id: domainsTable.id });

    if (updated.length === 0) {
      // Lost the race to a manual verify or the row was deleted — nothing to do
      return;
    }

    logger.info({ domain: d.domain, domainId: d.id }, "Domain auto-verified by background watcher");

    // Look up the workspace owner so we can email them. Skip the email if
    // we've already sent one for this domain (idempotency in case the row
    // gets re-flipped to unverified for some reason).
    const [owner] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(workspacesTable)
      .innerJoin(usersTable, eq(usersTable.id, workspacesTable.userId))
      .where(eq(workspacesTable.id, d.workspaceId));

    if (!owner) return;

    // Idempotency: only send if we haven't already
    const [prevEmail] = await db
      .select({ id: emailLogsTable.id })
      .from(emailLogsTable)
      .where(and(
        eq(emailLogsTable.userId, owner.id),
        eq(emailLogsTable.type, EMAIL_TYPE),
        // crude but effective — match on the domain inside the subject
        sql`${emailLogsTable.subject} LIKE ${`%${d.domain}%`}`,
      ))
      .limit(1);

    if (prevEmail) return;

    await sendDomainVerifiedEmail({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      domain: d.domain,
    });
  } catch (err) {
    // One bad domain shouldn't stop the loop; log + move on
    logger.warn({ err, domain: d.domain }, "Background verify check failed for one domain");
  }
}

/** Start the watcher. Idempotent — calling twice is a no-op. */
export function startDomainVerifierWatcher(): void {
  if (timer) return;
  // First tick after a short warmup so server startup isn't slowed
  setTimeout(() => {
    pollOnce();
    timer = setInterval(pollOnce, WATCHER_INTERVAL_MS);
  }, 5_000);
  logger.info({ intervalMs: WATCHER_INTERVAL_MS, windowHours: WATCH_WINDOW_HOURS }, "Domain verifier watcher scheduled");
}

/** Stop the watcher (useful for tests / clean shutdown). */
export function stopDomainVerifierWatcher(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
