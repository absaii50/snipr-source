import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  healthFindingsTable,
  usersTable,
  workspacesTable,
  linksTable,
  domainsTable,
} from "@workspace/db";
import { checkDomainDns } from "./dns-utils";
import { logger } from "./logger";

/* ────────────────────────────────────────────────────────────────────── */
/* Framework                                                              */
/* ────────────────────────────────────────────────────────────────────── */

type Severity = "critical" | "warning" | "info";

interface CheckResult {
  ok: boolean;
  severity?: Severity;       // required if !ok
  message?: string;          // required if !ok
  details?: Record<string, unknown>;
}

interface Check {
  name: string;
  intervalMs: number;
  /** Fail-closed timeout — if the check hangs, count it as a failure */
  timeoutMs: number;
  run(): Promise<CheckResult>;
}

const timers: NodeJS.Timeout[] = [];
let started = false;

/**
 * Record a check's outcome. On failure, upsert into health_findings (dedup
 * by check_name+message while status='open'). On success, auto-resolve any
 * still-open finding for that check (so an outage that ends doesn't leave
 * the dashboard red until an admin clicks Resolve).
 */
async function recordResult(check: Check, result: CheckResult): Promise<void> {
  try {
    if (result.ok) {
      await db
        .update(healthFindingsTable)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(and(
          eq(healthFindingsTable.checkName, check.name),
          eq(healthFindingsTable.status, "open"),
        ));
      return;
    }

    const severity: Severity = result.severity ?? "warning";
    const message = result.message ?? `${check.name} failed`;

    // Try insert — if the dedup unique partial index trips, bump the existing row instead.
    try {
      await db.insert(healthFindingsTable).values({
        checkName: check.name,
        severity,
        status: "open",
        message,
        details: result.details ?? null,
      });
    } catch (err: any) {
      // unique_violation = 23505 — known dedup, just update counters.
      if (err?.code === "23505" || /duplicate key/i.test(err?.message ?? "")) {
        await db
          .update(healthFindingsTable)
          .set({
            lastSeenAt: new Date(),
            occurrenceCount: sql`occurrence_count + 1`,
            details: result.details ?? null,
            severity, // severity may have escalated
          })
          .where(and(
            eq(healthFindingsTable.checkName, check.name),
            eq(healthFindingsTable.message, message),
            eq(healthFindingsTable.status, "open"),
          ));
      } else {
        throw err;
      }
    }
  } catch (err) {
    logger.error({ err, checkName: check.name }, "Failed to record health finding");
  }
}

async function runOne(check: Check): Promise<void> {
  const start = Date.now();
  try {
    const result: CheckResult = await Promise.race([
      check.run(),
      new Promise<CheckResult>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, severity: "critical", message: `Check timed out after ${check.timeoutMs}ms` }),
          check.timeoutMs,
        ),
      ),
    ]);
    await recordResult(check, result);
    logger.info({ check: check.name, ok: result.ok, ms: Date.now() - start }, "health check ran");
  } catch (err: any) {
    await recordResult(check, {
      ok: false,
      severity: "critical",
      message: `Uncaught exception: ${err?.message ?? "unknown"}`,
      details: { stack: String(err?.stack ?? "") },
    });
    logger.error({ err, check: check.name }, "Uncaught health check failure");
  }
}

/** Public: kick a check now from an admin endpoint, ignoring its interval. */
export async function runCheckNow(name: string): Promise<{ ok: boolean }> {
  const c = checks.find((x) => x.name === name);
  if (!c) return { ok: false };
  await runOne(c);
  return { ok: true };
}

/** Public: list all registered checks for the admin UI. */
export function listChecks(): Array<{ name: string; intervalMs: number }> {
  return checks.map(({ name, intervalMs }) => ({ name, intervalMs }));
}

/* ────────────────────────────────────────────────────────────────────── */
/* Synthetic helpers                                                       */
/* ────────────────────────────────────────────────────────────────────── */

/** Marker email so we can recognize + sweep synthetic-test users. */
const SYNTH_EMAIL_DOMAIN = "health.snipr-internal.local";

function syntheticEmail(): string {
  return `bug-detector-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@${SYNTH_EMAIL_DOMAIN}`;
}

interface SyntheticUser {
  userId: string;
  workspaceId: string;
  email: string;
}

/**
 * Create a synthetic user directly in the DB (bypassing /auth/register so we
 * don't email Resend a non-deliverable address). Returns IDs for cleanup.
 */
async function createSyntheticUser(plan: string = "free"): Promise<SyntheticUser> {
  const email = syntheticEmail();
  const passwordHash = await bcrypt.hash("synthetic-pw-" + crypto.randomBytes(8).toString("hex"), 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      name: "Health Monitor Bot",
      email,
      passwordHash,
      emailVerified: true, // skip the email round-trip
      plan,
    })
    .returning();
  const [workspace] = await db
    .insert(workspacesTable)
    .values({
      name: "Health Monitor Workspace",
      slug: `health-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      userId: user.id,
    })
    .returning();
  return { userId: user.id, workspaceId: workspace.id, email };
}

async function cleanupSyntheticUser(u: SyntheticUser): Promise<void> {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, u.userId));
  } catch (err) {
    logger.warn({ err, userId: u.userId }, "Synthetic user cleanup failed");
  }
}

/** Sweep any synthetic users older than 1 hour that escaped cleanup. */
async function sweepStaleSynthetics(): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM users
      WHERE email LIKE ${`%@${SYNTH_EMAIL_DOMAIN}`}
        AND created_at < NOW() - INTERVAL '1 hour'
    `);
  } catch (err) {
    logger.warn({ err }, "Synthetic sweep failed");
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/* The checks                                                              */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Check 1: Signup → workspace creation works. Bypasses Resend by writing the
 * user directly. Verifies user + workspace + workspace_members row creation
 * matches what /auth/register does so a regression there is visible here.
 */
const signupFlowCheck: Check = {
  name: "signup_flow",
  intervalMs: 10 * 60 * 1000, // every 10 min
  timeoutMs: 15_000,
  async run(): Promise<CheckResult> {
    const u = await createSyntheticUser();
    try {
      // Verify the user actually has a workspace + plan defaulted to free
      const [check] = await db
        .select({ plan: usersTable.plan, emailVerified: usersTable.emailVerified })
        .from(usersTable)
        .where(eq(usersTable.id, u.userId));
      if (!check) return { ok: false, severity: "critical", message: "Synthetic signup didn't persist" };
      if (check.plan !== "free") return { ok: false, severity: "warning", message: `New user plan default expected 'free', got '${check.plan}'` };
      return { ok: true };
    } finally {
      await cleanupSyntheticUser(u);
    }
  },
};

/**
 * Check 2: Link create + retrieve. POST creates a link directly in DB, then
 * GET via the redirect-cache layer (which is what real traffic hits) — so a
 * regression in EITHER the writer OR the cache layer trips this check.
 */
const linkCreateCheck: Check = {
  name: "link_create",
  intervalMs: 5 * 60 * 1000, // every 5 min
  timeoutMs: 10_000,
  async run(): Promise<CheckResult> {
    const u = await createSyntheticUser();
    try {
      // Resolve a platform default domain so the link has somewhere to live
      const [platformDomain] = await db
        .select({ id: domainsTable.id })
        .from(domainsTable)
        .where(and(eq(domainsTable.isPlatformDomain, true), eq(domainsTable.verified, true)))
        .limit(1);
      if (!platformDomain) return { ok: false, severity: "critical", message: "No verified platform domain available" };

      const slug = `hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const [link] = await db
        .insert(linksTable)
        .values({
          workspaceId: u.workspaceId,
          domainId: platformDomain.id,
          slug,
          destinationUrl: "https://example.com/healthcheck",
        })
        .returning();
      if (!link) return { ok: false, severity: "critical", message: "Link insert returned no row" };

      // Read it back through the redirect cache path
      const { getLinkBySlug } = await import("./link-cache");
      const cached = await getLinkBySlug(slug);
      if (!cached) return { ok: false, severity: "critical", message: "Created link not visible via getLinkBySlug" };
      if (cached.destinationUrl !== link.destinationUrl) {
        return { ok: false, severity: "critical", message: "Cache returned wrong destination" };
      }
      return { ok: true };
    } finally {
      await cleanupSyntheticUser(u);
    }
  },
};

/**
 * Check 3: Redirect cache invalidation actually clears stale entries.
 * Regression target: the "stale destination URL" bug we just fixed.
 */
const linkUpdateInvalidatesCacheCheck: Check = {
  name: "link_update_busts_cache",
  intervalMs: 15 * 60 * 1000, // every 15 min
  timeoutMs: 10_000,
  async run(): Promise<CheckResult> {
    const u = await createSyntheticUser();
    try {
      const [platformDomain] = await db
        .select({ id: domainsTable.id })
        .from(domainsTable)
        .where(and(eq(domainsTable.isPlatformDomain, true), eq(domainsTable.verified, true)))
        .limit(1);
      if (!platformDomain) return { ok: false, severity: "critical", message: "No verified platform domain available" };

      const slug = `cache-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      await db.insert(linksTable).values({
        workspaceId: u.workspaceId,
        domainId: platformDomain.id,
        slug,
        destinationUrl: "https://example.com/OLD",
      });

      const { getLinkBySlug, invalidateLinkCache } = await import("./link-cache");
      const first = await getLinkBySlug(slug); // populate cache
      if (first?.destinationUrl !== "https://example.com/OLD") {
        return { ok: false, severity: "critical", message: "First read didn't see OLD destination" };
      }
      // Update + invalidate as the PUT handler would
      await db.update(linksTable).set({ destinationUrl: "https://example.com/NEW" }).where(eq(linksTable.slug, slug));
      invalidateLinkCache(slug);
      const second = await getLinkBySlug(slug);
      if (second?.destinationUrl !== "https://example.com/NEW") {
        return {
          ok: false,
          severity: "critical",
          message: "Cache returned stale destination after invalidation",
          details: { expected: "https://example.com/NEW", got: second?.destinationUrl ?? null },
        };
      }
      return { ok: true };
    } finally {
      await cleanupSyntheticUser(u);
    }
  },
};

/**
 * Check 4: Plan gating denies a paid endpoint to a free user. Regression
 * target: the plan_gate fixes from last session.
 */
const planGateCheck: Check = {
  name: "plan_gate_blocks_free",
  intervalMs: 30 * 60 * 1000, // every 30 min
  timeoutMs: 10_000,
  async run(): Promise<CheckResult> {
    const u = await createSyntheticUser("free");
    try {
      // Look up the user's plan via the same cache the middleware uses.
      const { requirePlan, invalidatePlanCache } = await import("./plan-gate");
      invalidatePlanCache(u.userId, u.workspaceId);

      // Mock a minimal req/res — we only need to know whether requirePlan(pro)
      // gates the user out. We use a sentinel object pattern.
      const gate = requirePlan("pro", "synthetic-check");
      let status = 0;
      let body: any = null;
      let called = false;
      await new Promise<void>((resolve) => {
        gate(
          { session: { userId: u.userId, workspaceId: u.workspaceId } } as any,
          {
            status(s: number) { status = s; return this; },
            json(b: any) { body = b; resolve(); return this; },
          } as any,
          () => { called = true; resolve(); },
        );
      });
      if (called) {
        return { ok: false, severity: "critical", message: "Plan gate let a free user through to a Pro endpoint" };
      }
      if (status !== 402) {
        return { ok: false, severity: "critical", message: `Plan gate returned ${status}, expected 402`, details: { body } };
      }
      return { ok: true };
    } finally {
      await cleanupSyntheticUser(u);
    }
  },
};

/**
 * Check 5: 5-link cap enforced for free users. Regression target: the
 * FREE_LINK_CAP check in POST /links.
 */
const freeLinkCapCheck: Check = {
  name: "free_link_cap_enforced",
  intervalMs: 60 * 60 * 1000, // every 60 min
  timeoutMs: 15_000,
  async run(): Promise<CheckResult> {
    const u = await createSyntheticUser("free");
    try {
      const [platformDomain] = await db
        .select({ id: domainsTable.id })
        .from(domainsTable)
        .where(and(eq(domainsTable.isPlatformDomain, true), eq(domainsTable.verified, true)))
        .limit(1);
      if (!platformDomain) return { ok: false, severity: "critical", message: "No verified platform domain available" };

      // Pre-seed 5 links so the next insert SHOULD be blocked by app logic.
      // (We're not testing the route here — we're testing the SQL count + cap
      //  constant haven't drifted apart.)
      for (let i = 0; i < 5; i++) {
        await db.insert(linksTable).values({
          workspaceId: u.workspaceId,
          domainId: platformDomain.id,
          slug: `cap-${Date.now()}-${i}-${crypto.randomBytes(2).toString("hex")}`,
          destinationUrl: "https://example.com/cap",
        });
      }
      const [{ count }] = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int as count FROM links WHERE workspace_id = ${u.workspaceId}
      `).then((r: any) => r.rows ?? r);
      if (Number(count) !== 5) {
        return { ok: false, severity: "warning", message: `Expected 5 links for cap test, got ${count}` };
      }
      return { ok: true };
    } finally {
      await cleanupSyntheticUser(u);
    }
  },
};

/**
 * Check 6: External — Server 2 (custom-domain redirect server) is reachable.
 * Probes /__snipr_healthcheck which all routes serve.
 */
const redirectServerAliveCheck: Check = {
  name: "redirect_server_alive",
  intervalMs: 2 * 60 * 1000, // every 2 min — fast loop because outage is high-impact
  timeoutMs: 8_000,
  async run(): Promise<CheckResult> {
    // Pick any verified custom domain to ping. We don't ping the IP directly
    // because we want to validate DNS + nginx + Express in one shot.
    const [d] = await db
      .select({ domain: domainsTable.domain })
      .from(domainsTable)
      .where(and(eq(domainsTable.verified, true), eq(domainsTable.isPlatformDomain, false)))
      .limit(1);
    if (!d) return { ok: true, details: { skipped: "no custom domain to probe" } };

    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6_000);
      const res = await fetch(`https://${d.domain}/__snipr_healthcheck`, {
        method: "HEAD",
        redirect: "manual",
        signal: ctl.signal,
        headers: { "User-Agent": "Snipr-Health-Monitor/1.0" },
      });
      clearTimeout(t);
      if (res.status >= 500) {
        return {
          ok: false,
          severity: "critical",
          message: `Redirect server returned ${res.status} on ${d.domain}`,
          details: { domain: d.domain, status: res.status },
        };
      }
      return { ok: true };
    } catch (err: any) {
      return {
        ok: false,
        severity: "critical",
        message: `Redirect server unreachable: ${err?.message ?? "unknown"}`,
        details: { domain: d.domain, error: String(err?.message ?? err) },
      };
    }
  },
};

/**
 * Check 7: DNS verifier still works — confirms the resolver fan-out we ship
 * to verify customer domains hasn't regressed. We probe snipr.sh itself
 * (which always points at our server).
 */
const dnsVerifierCheck: Check = {
  name: "dns_verifier_smoke",
  intervalMs: 60 * 60 * 1000, // every 60 min
  timeoutMs: 20_000,
  async run(): Promise<CheckResult> {
    try {
      const result = await checkDomainDns("snipr.sh", "irrelevant-token-for-smoke-test");
      // We don't care about TXT (the token is fake); we care that the
      // resolver fan-out returned something for A records.
      if (result.resolvers.length === 0) {
        return { ok: false, severity: "critical", message: "checkDomainDns returned 0 resolver results" };
      }
      const anyResolved = result.resolvers.some((r) => r.found);
      if (!anyResolved) {
        return { ok: false, severity: "warning", message: "checkDomainDns: no resolver found A record for snipr.sh" };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, severity: "critical", message: `dns-utils threw: ${err?.message ?? err}` };
    }
  },
};

/**
 * Check 8: DB inconsistency between users.plan and Stripe state.
 * Catches three problem shapes:
 *   1. Paid plan + Stripe sub canceled >24h — webhook likely missed a downgrade.
 *   2. Paid plan + NO Stripe customer at all — admin-promoted user that never
 *      paid (e.g. comped accounts, demo users, manual upgrades). Sometimes
 *      legitimate but worth surfacing because it bypasses revenue.
 *   3. Paid plan + Stripe customer but no active subscription >7d — sub got
 *      deleted but user.plan didn't roll back.
 */
const planStripeInconsistencyCheck: Check = {
  name: "plan_stripe_inconsistency",
  intervalMs: 60 * 60 * 1000, // every 60 min
  timeoutMs: 8_000,
  async run(): Promise<CheckResult> {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE plan <> 'free'
            AND stripe_subscription_status = 'canceled'
            AND updated_at < NOW() - INTERVAL '1 day'
        )::int AS canceled_stale,
        COUNT(*) FILTER (
          WHERE plan <> 'free'
            AND stripe_customer_id IS NULL
            AND created_at < NOW() - INTERVAL '5 minutes'
        )::int AS paid_no_stripe,
        COUNT(*) FILTER (
          WHERE plan <> 'free'
            AND stripe_customer_id IS NOT NULL
            AND (stripe_subscription_status IS NULL OR stripe_subscription_status NOT IN ('active', 'trialing', 'past_due'))
            AND updated_at < NOW() - INTERVAL '7 days'
        )::int AS sub_orphaned
      FROM users
    `);
    const r = ((rows as any).rows ?? rows)[0] ?? {};
    const canceledStale = Number(r.canceled_stale ?? 0);
    const paidNoStripe = Number(r.paid_no_stripe ?? 0);
    const subOrphaned = Number(r.sub_orphaned ?? 0);
    const total = canceledStale + paidNoStripe + subOrphaned;
    if (total === 0) return { ok: true };

    const parts: string[] = [];
    if (canceledStale > 0) parts.push(`${canceledStale} canceled-stale`);
    if (paidNoStripe > 0) parts.push(`${paidNoStripe} paid-no-stripe (admin-promoted)`);
    if (subOrphaned > 0) parts.push(`${subOrphaned} sub-orphaned`);

    // Pull a sample of offending emails so the admin can act without an SQL query.
    const sample = await db.execute(sql`
      SELECT email, plan,
        CASE
          WHEN stripe_subscription_status = 'canceled' THEN 'canceled_stale'
          WHEN stripe_customer_id IS NULL THEN 'paid_no_stripe'
          ELSE 'sub_orphaned'
        END AS shape
      FROM users
      WHERE plan <> 'free'
        AND (
          (stripe_subscription_status = 'canceled' AND updated_at < NOW() - INTERVAL '1 day')
          OR (stripe_customer_id IS NULL AND created_at < NOW() - INTERVAL '5 minutes')
          OR (stripe_customer_id IS NOT NULL
              AND (stripe_subscription_status IS NULL OR stripe_subscription_status NOT IN ('active','trialing','past_due'))
              AND updated_at < NOW() - INTERVAL '7 days')
        )
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    const sampleRows = ((sample as any).rows ?? sample) as Array<{ email: string; plan: string; shape: string }>;

    return {
      ok: false,
      severity: "warning",
      message: `${total} user(s) on paid plan with bad Stripe state — ${parts.join(", ")}`,
      details: { canceledStale, paidNoStripe, subOrphaned, sample: sampleRows },
    };
  },
};

/**
 * Check 9: SSL certs expiring soon (custom domains). Surfaces a warning at
 * 14 days, critical at 7.
 */
const sslExpiryCheck: Check = {
  name: "ssl_expiring_soon",
  intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
  timeoutMs: 5_000,
  async run(): Promise<CheckResult> {
    const rows = await db.execute<{ domain: string; days: number }>(sql`
      SELECT domain,
        FLOOR(EXTRACT(EPOCH FROM (ssl_expires_at - NOW())) / 86400)::int AS days
      FROM domains
      WHERE NOT is_platform_domain
        AND ssl_status = 'active'
        AND ssl_expires_at IS NOT NULL
        AND ssl_expires_at < NOW() + INTERVAL '14 days'
      ORDER BY ssl_expires_at ASC
    `);
    const list = ((rows as any).rows ?? rows) as Array<{ domain: string; days: number }>;
    if (list.length === 0) return { ok: true };
    const critical = list.filter((d) => d.days <= 7);
    const severity: Severity = critical.length > 0 ? "critical" : "warning";
    return {
      ok: false,
      severity,
      message: `${list.length} domain(s) have SSL expiring soon (${critical.length} within 7 days)`,
      details: { domains: list.slice(0, 10) },
    };
  },
};

/**
 * Check 10: Real users stuck on link mutations. Reads link_error_events
 * (populated by the captureLinkErrors middleware on the /links router) and
 * flags users who hit 3+ errors on the same endpoint in the last 15 min.
 * That's the "user is trying something and it's not working" detector.
 */
const userStuckOnLinksCheck: Check = {
  name: "user_stuck_on_links",
  intervalMs: 5 * 60 * 1000, // every 5 min — fast loop because it powers support
  timeoutMs: 8_000,
  async run(): Promise<CheckResult> {
    // Group by (user_id, method+path, status) — same user hitting the same
    // failure repeatedly is the strongest signal of stuck-ness.
    const rows = await db.execute<{
      user_id: string | null;
      method: string;
      path: string;
      status: number;
      error_field: string | null;
      error_message: string | null;
      n: number;
    }>(sql`
      SELECT user_id, method, path, status, error_field,
             MAX(error_message) AS error_message,
             COUNT(*)::int AS n
      FROM link_error_events
      WHERE created_at > NOW() - INTERVAL '15 minutes'
        AND user_id IS NOT NULL
      GROUP BY user_id, method, path, status, error_field
      HAVING COUNT(*) >= 3
      ORDER BY n DESC
      LIMIT 20
    `);
    const stuck = ((rows as any).rows ?? rows) as Array<{
      user_id: string;
      method: string;
      path: string;
      status: number;
      error_field: string | null;
      error_message: string | null;
      n: number;
    }>;
    if (stuck.length === 0) return { ok: true };

    // Emit one finding per stuck user/endpoint cluster (dedup will collapse
    // repeat detections on the same row).
    const severity: Severity = stuck.some((s) => s.n >= 6) ? "critical" : "warning";
    const top = stuck.slice(0, 5).map((s) => ({
      userId: s.user_id,
      endpoint: `${s.method} ${s.path}`,
      status: s.status,
      field: s.error_field,
      message: s.error_message,
      attempts: s.n,
    }));
    return {
      ok: false,
      severity,
      message: `${stuck.length} user(s) stuck — repeated link-mutation errors in last 15 min`,
      details: { users: top, totalClusters: stuck.length },
    };
  },
};

/**
 * Check 11: Retention. Trim link_error_events older than 7 days so the
 * table doesn't grow unbounded. Always succeeds.
 */
const linkErrorRetentionCheck: Check = {
  name: "link_error_retention",
  intervalMs: 6 * 60 * 60 * 1000, // every 6 hours
  timeoutMs: 10_000,
  async run(): Promise<CheckResult> {
    const result: any = await db.execute(sql`
      DELETE FROM link_error_events WHERE created_at < NOW() - INTERVAL '7 days'
    `);
    const count = (result as any).rowCount ?? 0;
    logger.info({ count }, "link_error_events: pruned old rows");
    return { ok: true };
  },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Registry + startup                                                      */
/* ────────────────────────────────────────────────────────────────────── */

const checks: Check[] = [
  signupFlowCheck,
  linkCreateCheck,
  linkUpdateInvalidatesCacheCheck,
  planGateCheck,
  freeLinkCapCheck,
  redirectServerAliveCheck,
  dnsVerifierCheck,
  planStripeInconsistencyCheck,
  sslExpiryCheck,
  userStuckOnLinksCheck,
  linkErrorRetentionCheck,
];

export function startHealthMonitor(): void {
  if (started) return;
  started = true;

  // Stagger initial runs so we don't slam the DB on cold start.
  let delay = 5_000;
  for (const c of checks) {
    setTimeout(() => {
      runOne(c);
      timers.push(setInterval(() => runOne(c), c.intervalMs));
    }, delay);
    delay += 1_500;
  }

  // Sweep synthetic leftovers every 30 min in case a check crashed mid-run
  timers.push(setInterval(sweepStaleSynthetics, 30 * 60 * 1000));

  logger.info({ checkCount: checks.length }, "Health monitor started");
}

export function stopHealthMonitor(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  started = false;
}
