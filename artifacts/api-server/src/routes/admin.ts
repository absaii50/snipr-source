import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { getDomainVerifyToken, checkDomainDns } from "../lib/dns-utils";
import { invalidateConfigCache } from "../lib/config";
import {
  db,
  usersTable,
  workspacesTable,
  linksTable,
  clickEventsTable,
  domainsTable,
  conversionsTable,
  platformSettingsTable,
} from "@workspace/db";
import { count, desc, eq, sql, ilike, isNull, isNotNull, and, inArray } from "drizzle-orm";

const router: IRouter = Router();

// SECURITY: Admin credentials must be set via environment variables
// Format: ADMIN_USERNAME=admin, ADMIN_PASSWORD_HASH=bcrypt_hash_here
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Validate that admin credentials are configured
if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
  console.error("ERROR: Admin credentials not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH environment variables.");
  // Don't exit - allow app to start but admin will be inaccessible
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!(req.session as any).isAdmin) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

/* ── Auth ──────────────────────────────────────────────────────────── */
router.post("/admin/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};

  // Validate inputs exist
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  // Check if admin credentials are configured
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
    res.status(503).json({ error: "Admin authentication is not configured" });
    return;
  }

  // Verify username matches
  if (username !== ADMIN_USERNAME) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Verify password using bcrypt
  try {
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    (req.session as any).isAdmin = true;
    res.json({ ok: true });
  } catch (error) {
    console.error("Admin login bcrypt error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/admin/logout", (req, res): void => {
  (req.session as any).isAdmin = false;
  res.json({ ok: true });
});

router.get("/admin/me", (req, res): void => {
  res.json({ isAdmin: !!(req.session as any).isAdmin });
});

/* ── Stats ─────────────────────────────────────────────────────────── */
router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [[userCount], [wsCount], [linkCount], [clickCount], [convCount], [domainCount]] =
    await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(workspacesTable),
      db.select({ count: count() }).from(linksTable),
      db.select({ count: count() }).from(clickEventsTable),
      db.select({ count: count() }).from(conversionsTable),
      db.select({ count: count() }).from(domainsTable),
    ]);

  const [[newUsers7d], [newLinks7d], [clicks7d]] = await Promise.all([
    db.select({ count: count() }).from(usersTable)
      .where(sql`${usersTable.createdAt} >= ${last7}`),
    db.select({ count: count() }).from(linksTable)
      .where(sql`${linksTable.createdAt} >= ${last7}`),
    db.select({ count: count() }).from(clickEventsTable)
      .where(sql`${clickEventsTable.timestamp} >= ${last7}`),
  ]);

  const [[activeLinks], [suspendedUsers]] = await Promise.all([
    db.select({ count: count() }).from(linksTable).where(eq(linksTable.enabled, true)),
    db.select({ count: count() }).from(usersTable).where(isNotNull(usersTable.suspendedAt)),
  ]);

  res.json({
    totalUsers: userCount.count,
    totalWorkspaces: wsCount.count,
    totalLinks: linkCount.count,
    activeLinks: activeLinks.count,
    totalClicks: clickCount.count,
    totalConversions: convCount.count,
    totalDomains: domainCount.count,
    suspendedUsers: suspendedUsers.count,
    newUsersThisWeek: newUsers7d.count,
    newLinksThisWeek: newLinks7d.count,
    clicksThisWeek: clicks7d.count,
  });
});

/* ── Users ─────────────────────────────────────────────────────────── */
router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";

  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      suspendedAt: usersTable.suspendedAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(
      search
        ? sql`lower(${usersTable.name}) like ${"%" + search.toLowerCase() + "%"} or lower(${usersTable.email}) like ${"%" + search.toLowerCase() + "%"}`
        : undefined
    )
    .orderBy(desc(usersTable.createdAt))
    .limit(100);

  const workspaces = await db
    .select({ userId: workspacesTable.userId, name: workspacesTable.name, slug: workspacesTable.slug })
    .from(workspacesTable);

  const linkCounts = await db
    .select({ workspaceId: linksTable.workspaceId, count: count() })
    .from(linksTable)
    .groupBy(linksTable.workspaceId);

  const wsMap: Record<string, { name: string; slug: string; linkCount: number }> = {};
  for (const w of workspaces) {
    const lc = linkCounts.find((l) => l.workspaceId === w.id);
    wsMap[w.userId] = { name: w.name, slug: w.slug, linkCount: lc?.count ?? 0 };
  }

  const result = users.map((u) => ({
    ...u,
    suspended: !!u.suspendedAt,
    workspace: wsMap[u.id] ?? null,
  }));

  res.json(result);
});

router.patch("/admin/users/:id/plan", requireAdmin, async (req, res): Promise<void> => {
  const { plan } = req.body as { plan?: string };
  if (!plan || !["free", "pro", "business"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan. Must be free, pro, or business." });
    return;
  }

  const updates: Record<string, unknown> = { plan };
  if (plan === "free") {
    updates.lsSubscriptionId = null;
    updates.lsCustomerId = null;
    updates.lsSubscriptionStatus = null;
    updates.planRenewsAt = null;
    updates.planExpiresAt = null;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.params.id));
  res.json({ ok: true, plan });
});

router.patch("/admin/users/:id/suspend", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id;
  await db.update(usersTable).set({ suspendedAt: new Date() }).where(eq(usersTable.id, userId));
  await db.execute(sql`DELETE FROM session WHERE (sess::jsonb->>'userId')::text = ${userId}`);
  res.json({ ok: true });
});

router.patch("/admin/users/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  await db.update(usersTable).set({ suspendedAt: null }).where(eq(usersTable.id, req.params.id));
  res.json({ ok: true });
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id;
  await db.execute(sql`DELETE FROM session WHERE (sess::jsonb->>'userId')::text = ${userId}`);
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

/* ── Links ─────────────────────────────────────────────────────────── */
router.get("/admin/links", requireAdmin, async (req, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";

  const links = await db
    .select({
      id: linksTable.id,
      slug: linksTable.slug,
      destinationUrl: linksTable.destinationUrl,
      title: linksTable.title,
      enabled: linksTable.enabled,
      createdAt: linksTable.createdAt,
      workspaceId: linksTable.workspaceId,
    })
    .from(linksTable)
    .where(
      search
        ? sql`lower(${linksTable.slug}) like ${"%" + search.toLowerCase() + "%"} or lower(${linksTable.destinationUrl}) like ${"%" + search.toLowerCase() + "%"}`
        : undefined
    )
    .orderBy(desc(linksTable.createdAt))
    .limit(100);

  const wsIds = [...new Set(links.map((l) => l.workspaceId))];
  let wsMap: Record<string, { name: string; userId: string }> = {};
  if (wsIds.length > 0) {
    const wsList = await db
      .select({ id: workspacesTable.id, name: workspacesTable.name, userId: workspacesTable.userId })
      .from(workspacesTable)
      .where(inArray(workspacesTable.id, wsIds));
    for (const w of wsList) wsMap[w.id] = { name: w.name, userId: w.userId };
  }

  const userIds = [...new Set(Object.values(wsMap).map((w) => w.userId))];
  let userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const uList = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
    for (const u of uList) userMap[u.id] = u.email;
  }

  const clickCounts = await db
    .select({ linkId: clickEventsTable.linkId, count: count() })
    .from(clickEventsTable)
    .groupBy(clickEventsTable.linkId);
  const ccMap = Object.fromEntries(clickCounts.map((c) => [c.linkId, c.count]));

  const result = links.map((l) => {
    const ws = wsMap[l.workspaceId];
    return {
      ...l,
      workspaceName: ws?.name ?? "—",
      ownerEmail: ws ? (userMap[ws.userId] ?? "—") : "—",
      clickCount: ccMap[l.id] ?? 0,
    };
  });

  res.json(result);
});

router.patch("/admin/links/:id/toggle", requireAdmin, async (req, res): Promise<void> => {
  const [link] = await db.select({ enabled: linksTable.enabled }).from(linksTable).where(eq(linksTable.id, req.params.id));
  if (!link) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(linksTable).set({ enabled: !link.enabled }).where(eq(linksTable.id, req.params.id));
  res.json({ enabled: !link.enabled });
});

router.delete("/admin/links/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(linksTable).where(eq(linksTable.id, req.params.id));
  res.json({ ok: true });
});

/* ── Domains ───────────────────────────────────────────────────────── */
/* ── Domain DNS Verification ─────────────────────────────────────────── */

router.get("/admin/domains/:id/dns-check", requireAdmin, async (req, res): Promise<void> => {
  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.id, req.params.id));

  if (!domain) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  const token = getDomainVerifyToken(domain.id);
  const dnsResult = await checkDomainDns(domain.domain, token);

  res.json({
    domain: domain.domain,
    verified: domain.verified,
    token,
    ...dnsResult,
  });
});

router.patch("/admin/domains/:id/verify", requireAdmin, async (req, res): Promise<void> => {
  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.id, req.params.id));

  if (!domain) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  const force = (req.body as any)?.force === true;
  const token = getDomainVerifyToken(domain.id);

  if (!force) {
    const dnsResult = await checkDomainDns(domain.domain, token);
    if (!dnsResult.ready) {
      res.status(422).json({
        error: "dns_not_configured",
        message: "DNS records not found yet. Add the CNAME or TXT record and try again.",
        token,
      });
      return;
    }
  }

  await db
    .update(domainsTable)
    .set({ verified: true })
    .where(eq(domainsTable.id, domain.id));

  res.json({ ok: true, domain: domain.domain });
});

router.patch("/admin/domains/:id/unverify", requireAdmin, async (req, res): Promise<void> => {
  await db
    .update(domainsTable)
    .set({ verified: false })
    .where(eq(domainsTable.id, req.params.id));
  res.json({ ok: true });
});

router.get("/admin/domains", requireAdmin, async (req, res): Promise<void> => {
  // SUBDOMAIN SUPPORT: Include supportsSubdomains and isParentDomain in response
  const domains = await db
    .select({
      id: domainsTable.id,
      domain: domainsTable.domain,
      verified: domainsTable.verified,
      isParentDomain: domainsTable.isParentDomain,
      supportsSubdomains: domainsTable.supportsSubdomains,
      createdAt: domainsTable.createdAt,
      workspaceId: domainsTable.workspaceId,
    })
    .from(domainsTable)
    .orderBy(desc(domainsTable.createdAt))
    .limit(100);

  const wsIds = [...new Set(domains.map((d) => d.workspaceId))];
  let wsMap: Record<string, { name: string; userId: string }> = {};
  if (wsIds.length > 0) {
    const wsList = await db
      .select({ id: workspacesTable.id, name: workspacesTable.name, userId: workspacesTable.userId })
      .from(workspacesTable)
      .where(inArray(workspacesTable.id, wsIds));
    for (const w of wsList) wsMap[w.id] = { name: w.name, userId: w.userId };
  }

  const userIds = [...new Set(Object.values(wsMap).map((w) => w.userId))];
  let userMap: Record<string, { name: string; email: string }> = {};
  if (userIds.length > 0) {
    const uList = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
    for (const u of uList) userMap[u.id] = { name: u.name, email: u.email };
  }

  const result = domains.map((d) => {
    const ws = wsMap[d.workspaceId];
    const user = ws ? userMap[ws.userId] : null;
    return {
      ...d,
      workspaceName: ws?.name ?? "—",
      ownerName: user?.name ?? "—",
      ownerEmail: user?.email ?? "—",
      verificationToken: getDomainVerifyToken(d.id),
    };
  });

  res.json(result);
});

/* ── Admin: Create Domain for any workspace ───────────────────────── */
router.post("/admin/domains", requireAdmin, async (req, res): Promise<void> => {
  const { domain, workspaceId, supportsSubdomains, autoVerify } = req.body as {
    domain?: string;
    workspaceId?: string;
    supportsSubdomains?: boolean;
    autoVerify?: boolean;
  };

  if (!domain || typeof domain !== "string") {
    res.status(422).json({ error: "domain is required" });
    return;
  }
  if (!workspaceId || typeof workspaceId !== "string") {
    res.status(422).json({ error: "workspaceId is required" });
    return;
  }

  // Verify workspace exists
  const [ws] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  if (!ws) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  // Normalize domain
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  // Check duplicate
  const [existing] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.domain, normalized));
  if (existing) {
    res.status(409).json({ error: "This domain is already registered" });
    return;
  }

  const isParent = supportsSubdomains === true;

  const [created] = await db
    .insert(domainsTable)
    .values({
      workspaceId,
      domain: normalized,
      isParentDomain: isParent,
      supportsSubdomains: isParent,
      verified: autoVerify === true,
    })
    .returning();

  res.status(201).json(created);
});

/* ── Admin: Get all workspaces (for domain assignment) ────────────── */
router.get("/admin/workspaces-list", requireAdmin, async (req, res): Promise<void> => {
  const workspaces = await db
    .select({
      id: workspacesTable.id,
      name: workspacesTable.name,
      userId: workspacesTable.userId,
    })
    .from(workspacesTable)
    .orderBy(workspacesTable.name)
    .limit(200);

  const userIds = [...new Set(workspaces.map((w) => w.userId))];
  let userMap: Record<string, { name: string; email: string }> = {};
  if (userIds.length > 0) {
    const uList = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
    for (const u of uList) userMap[u.id] = { name: u.name, email: u.email };
  }

  const result = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    ownerName: userMap[w.userId]?.name ?? "—",
    ownerEmail: userMap[w.userId]?.email ?? "—",
  }));

  res.json(result);
});

router.delete("/admin/domains/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(domainsTable).where(eq(domainsTable.id, req.params.id));
  res.json({ ok: true });
});

/* ── Analytics ─────────────────────────────────────────────────────── */
router.get("/admin/analytics", requireAdmin, async (req, res): Promise<void> => {
  const days = parseInt((req.query.days as string) ?? "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [clicksByDay, topCountries, topDevices, topBrowsers, topReferrers] = await Promise.all([
    db.execute(sql`
      SELECT date_trunc('day', timestamp) as day, count(*) as clicks
      FROM click_events
      WHERE timestamp >= ${since}
      GROUP BY day ORDER BY day
    `),
    db.execute(sql`
      SELECT coalesce(country, 'Unknown') as country, count(*) as clicks
      FROM click_events WHERE timestamp >= ${since}
      GROUP BY country ORDER BY clicks DESC LIMIT 8
    `),
    db.execute(sql`
      SELECT coalesce(device, 'Unknown') as device, count(*) as clicks
      FROM click_events WHERE timestamp >= ${since}
      GROUP BY device ORDER BY clicks DESC LIMIT 6
    `),
    db.execute(sql`
      SELECT coalesce(browser, 'Unknown') as browser, count(*) as clicks
      FROM click_events WHERE timestamp >= ${since}
      GROUP BY browser ORDER BY clicks DESC LIMIT 6
    `),
    db.execute(sql`
      SELECT coalesce(referrer, 'Direct') as referrer, count(*) as clicks
      FROM click_events WHERE timestamp >= ${since}
      GROUP BY referrer ORDER BY clicks DESC LIMIT 8
    `),
  ]);

  res.json({
    clicksByDay: clicksByDay.rows,
    topCountries: topCountries.rows,
    topDevices: topDevices.rows,
    topBrowsers: topBrowsers.rows,
    topReferrers: topReferrers.rows,
  });
});

/* ── Activity / Reports ────────────────────────────────────────────── */
router.get("/admin/activity", requireAdmin, async (req, res): Promise<void> => {
  const events = await db
    .select({
      id: clickEventsTable.id,
      linkId: clickEventsTable.linkId,
      timestamp: clickEventsTable.timestamp,
      country: clickEventsTable.country,
      device: clickEventsTable.device,
      browser: clickEventsTable.browser,
      referrer: clickEventsTable.referrer,
    })
    .from(clickEventsTable)
    .orderBy(desc(clickEventsTable.timestamp))
    .limit(200);

  const linkIds = [...new Set(events.map((e) => e.linkId))];
  let linkMap: Record<string, string> = {};
  if (linkIds.length > 0) {
    const lList = await db
      .select({ id: linksTable.id, slug: linksTable.slug })
      .from(linksTable)
      .where(inArray(linksTable.id, linkIds));
    for (const l of lList) linkMap[l.id] = l.slug;
  }

  const result = events.map((e) => ({
    ...e,
    slug: linkMap[e.linkId] ?? e.linkId.slice(0, 8),
  }));

  res.json(result);
});

/* ── Recent signups (for overview) ────────────────────────────────── */
router.get("/admin/recent-signups", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, createdAt: usersTable.createdAt })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(5);
  res.json(users);
});

/* ── Top links (for overview) ──────────────────────────────────────── */
router.get("/admin/top-links", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT l.slug, l.destination_url, count(c.id) as clicks
    FROM links l
    LEFT JOIN click_events c ON c.link_id = l.id
    GROUP BY l.id, l.slug, l.destination_url
    ORDER BY clicks DESC
    LIMIT 5
  `);
  res.json(rows.rows);
});

/* ── AI Insights ───────────────────────────────────────────────────── */
router.post("/admin/ai-insights", requireAdmin, async (req, res): Promise<void> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured" });
    return;
  }

  const last7  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    [userCount], [linkCount], [clickCount], [convCount], [domainCount],
    [suspendedCount], [activeLinks],
    [newUsers7d], [newUsers14d], [newLinks7d], [clicks7d], [clicks14d],
    topCountries, topReferrers, topDevices,
  ] = await Promise.all([
    db.select({ c: count() }).from(usersTable),
    db.select({ c: count() }).from(linksTable),
    db.select({ c: count() }).from(clickEventsTable),
    db.select({ c: count() }).from(conversionsTable),
    db.select({ c: count() }).from(domainsTable),
    db.select({ c: count() }).from(usersTable).where(isNotNull(usersTable.suspendedAt)),
    db.select({ c: count() }).from(linksTable).where(eq(linksTable.enabled, true)),
    db.select({ c: count() }).from(usersTable).where(sql`${usersTable.createdAt} >= ${last7}`),
    db.select({ c: count() }).from(usersTable).where(sql`${usersTable.createdAt} >= ${last14} and ${usersTable.createdAt} < ${last7}`),
    db.select({ c: count() }).from(linksTable).where(sql`${linksTable.createdAt} >= ${last7}`),
    db.select({ c: count() }).from(clickEventsTable).where(sql`${clickEventsTable.timestamp} >= ${last7}`),
    db.select({ c: count() }).from(clickEventsTable).where(sql`${clickEventsTable.timestamp} >= ${last14} and ${clickEventsTable.timestamp} < ${last7}`),
    db.execute(sql`select coalesce(country,'Unknown') as country, count(*) as clicks from click_events where timestamp >= ${last30} group by country order by clicks desc limit 5`),
    db.execute(sql`select coalesce(referrer,'Direct') as referrer, count(*) as clicks from click_events where timestamp >= ${last30} group by referrer order by clicks desc limit 5`),
    db.execute(sql`select coalesce(device,'Unknown') as device, count(*) as clicks from click_events where timestamp >= ${last30} group by device order by clicks desc limit 4`),
  ]);

  const userGrowthPct = newUsers14d.c > 0
    ? Math.round(((newUsers7d.c - newUsers14d.c) / newUsers14d.c) * 100)
    : newUsers7d.c > 0 ? 100 : 0;

  const clickGrowthPct = clicks14d.c > 0
    ? Math.round(((clicks7d.c - clicks14d.c) / clicks14d.c) * 100)
    : clicks7d.c > 0 ? 100 : 0;

  const context = `
You are an AI analyst for Snipr, a URL shortener SaaS platform. Analyze the following real platform data and generate actionable insights for the platform admin.

PLATFORM SNAPSHOT (as of today):
- Total users: ${userCount.c} (${newUsers7d.c} new this week, ${userGrowthPct > 0 ? "+" : ""}${userGrowthPct}% WoW)
- Suspended users: ${suspendedCount.c}
- Total short links: ${linkCount.c} (${newLinks7d.c} created this week)
- Active links: ${activeLinks.c} / ${linkCount.c}
- Total all-time clicks: ${clickCount.c}
- Clicks this week: ${clicks7d.c} (${clickGrowthPct > 0 ? "+" : ""}${clickGrowthPct}% vs prior week)
- Total conversions tracked: ${convCount.c}
- Custom domains connected: ${domainCount.c}
- Top countries (last 30d): ${(topCountries.rows as any[]).map((r) => `${r.country} (${r.clicks})`).join(", ")}
- Top referrers (last 30d): ${(topReferrers.rows as any[]).map((r) => `${r.referrer} (${r.clicks})`).join(", ")}
- Top devices (last 30d): ${(topDevices.rows as any[]).map((r) => `${r.device} (${r.clicks})`).join(", ")}

Generate exactly 6 insights in JSON format. Each insight should be specific, data-driven, and actionable. Cover: growth trends, traffic quality, user health, geographic opportunities, device/referrer patterns, and one risk or anomaly if present.

Respond ONLY with valid JSON in this exact schema, no markdown:
{
  "overview": "2-3 sentence executive summary of platform health",
  "insights": [
    {
      "category": "Growth|Traffic|Users|Geographic|Devices|Risk",
      "title": "Short title (max 8 words)",
      "summary": "2-3 sentences with specific numbers from the data",
      "severity": "positive|info|warning|alert",
      "recommendation": "One clear actionable recommendation"
    }
  ]
}`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: context }],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    res.status(502).json({ error: "DeepSeek API error", detail: err });
    return;
  }

  const data = await response.json() as any;
  const raw = data.choices?.[0]?.message?.content ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      res.status(502).json({ error: "Could not parse AI response", raw });
      return;
    }
  }

  res.json({ ...parsed, generatedAt: new Date().toISOString() });
});

/* ── Billing / Subscriptions ───────────────────────────────────────── */
router.get("/admin/billing/stats", requireAdmin, async (req, res): Promise<void> => {
  const PLAN_PRICE: Record<string, number> = { pro: 19, business: 49 };

  const allSubUsers = await db
    .select({
      plan: usersTable.plan,
      lsSubscriptionStatus: usersTable.lsSubscriptionStatus,
    })
    .from(usersTable)
    .where(sql`${usersTable.plan} != 'free'`);

  let mrr = 0;
  let active = 0;
  let cancelled = 0;
  let paused = 0;
  let totalPaid = allSubUsers.length;

  const byPlan: Record<string, number> = { free: 0, pro: 0, business: 0 };

  const [freeCount] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.plan, "free"));
  byPlan.free = freeCount.count;

  for (const u of allSubUsers) {
    byPlan[u.plan] = (byPlan[u.plan] ?? 0) + 1;
    if (u.lsSubscriptionStatus === "active") {
      active++;
      mrr += PLAN_PRICE[u.plan] ?? 0;
    } else if (u.lsSubscriptionStatus === "cancelled") {
      cancelled++;
    } else if (u.lsSubscriptionStatus === "paused") {
      paused++;
    }
  }

  res.json({
    mrr,
    arr: mrr * 12,
    totalPaid,
    active,
    cancelled,
    paused,
    byPlan,
  });
});

router.get("/admin/billing/subscribers", requireAdmin, async (req, res): Promise<void> => {
  const plan = (req.query.plan as string) ?? "";
  const status = (req.query.status as string) ?? "";
  const search = (req.query.search as string) ?? "";

  const subscribers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      plan: usersTable.plan,
      lsSubscriptionId: usersTable.lsSubscriptionId,
      lsCustomerId: usersTable.lsCustomerId,
      lsSubscriptionStatus: usersTable.lsSubscriptionStatus,
      planRenewsAt: usersTable.planRenewsAt,
      planExpiresAt: usersTable.planExpiresAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(
      sql`
        ${usersTable.plan} != 'free'
        ${plan ? sql` AND ${usersTable.plan} = ${plan}` : sql``}
        ${status ? sql` AND ${usersTable.lsSubscriptionStatus} = ${status}` : sql``}
        ${search ? sql` AND (lower(${usersTable.name}) like ${"%" + search.toLowerCase() + "%"} OR lower(${usersTable.email}) like ${"%" + search.toLowerCase() + "%"})` : sql``}
      `
    )
    .orderBy(desc(usersTable.createdAt))
    .limit(200);

  res.json(subscribers);
});

router.patch("/admin/billing/subscribers/:id/reset", requireAdmin, async (req, res): Promise<void> => {
  await db
    .update(usersTable)
    .set({
      plan: "free",
      lsSubscriptionId: null,
      lsCustomerId: null,
      lsVariantId: null,
      lsSubscriptionStatus: null,
      planRenewsAt: null,
      planExpiresAt: null,
    })
    .where(eq(usersTable.id, req.params.id));
  res.json({ ok: true });
});

/* ── User Performance Analytics ─────────────────────────────────────── */

router.get("/admin/users/performance", requireAdmin, async (req, res): Promise<void> => {
  const search = ((req.query.search as string) ?? "").toLowerCase();
  const plan = (req.query.plan as string) ?? "";
  const sort = (req.query.sort as string) ?? "clicks";
  const days = Math.max(0, parseInt((req.query.days as string) ?? "0", 10)); // Validate non-negative

  // SECURITY: Whitelist allowed sort values to prevent SQL injection
  const validSortValues = ["links", "avg", "name", "clicks"];
  const allowSort = validSortValues.includes(sort) ? sort : "clicks";

  const orderBy = allowSort === "links" ? "total_links DESC" :
                  allowSort === "avg"   ? "avg_clicks DESC" :
                  allowSort === "name"  ? "u.name ASC" : "total_clicks DESC";

  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.plan,
      u.suspended_at,
      u.created_at,
      w.name   AS workspace_name,
      w.slug   AS workspace_slug,
      COUNT(DISTINCT l.id)::int                                       AS total_links,
      COUNT(ce.id)::int                                               AS total_clicks,
      CASE WHEN COUNT(DISTINCT l.id) > 0
           THEN ROUND(COUNT(ce.id)::numeric / NULLIF(COUNT(DISTINCT l.id), 0), 1)
           ELSE 0 END                                                 AS avg_clicks,
      COUNT(DISTINCT CASE WHEN l.enabled THEN l.id END)::int          AS active_links,
      COUNT(DISTINCT CASE WHEN NOT COALESCE(l.enabled,true) THEN l.id END)::int AS disabled_links,
      MAX(ce.timestamp)                                               AS last_click_at,
      COUNT(DISTINCT CASE WHEN ce.timestamp >= NOW() - INTERVAL '7 days' THEN ce.id END)::int AS clicks_7d
    FROM users u
    LEFT JOIN workspaces w ON w.user_id = u.id
    LEFT JOIN links l ON l.workspace_id = w.id
    LEFT JOIN click_events ce ON ce.link_id = l.id
      ${days > 0 ? sql`AND ce.timestamp >= NOW() - (${days}::int || ' days')::interval` : sql``}
    WHERE 1=1
      ${search ? sql`AND (lower(u.name) LIKE ${"%" + search + "%"} OR lower(u.email) LIKE ${"%" + search + "%"})` : sql``}
      ${plan ? sql`AND u.plan = ${plan}` : sql``}
    GROUP BY u.id, u.name, u.email, u.plan, u.suspended_at, u.created_at, w.name, w.slug
    ORDER BY ${sql.raw(orderBy)}
    LIMIT 200
  `);

  res.json(rows.rows);
});

/* ── Per-User Deep Analytics ─────────────────────────────────────────── */

router.get("/admin/users/:id/analytics", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id;

  const [userRows, linkRows] = await Promise.all([
    db.execute(sql`
      SELECT u.id, u.name, u.email, u.plan, u.suspended_at, u.created_at,
             w.name AS workspace_name, w.slug AS workspace_slug, w.id AS workspace_id
      FROM users u
      LEFT JOIN workspaces w ON w.user_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `),
    db.execute(sql`
      SELECT
        l.id, l.slug, l.destination_url AS destination_url, l.title,
        l.enabled, l.created_at, l.expires_at, l.click_limit,
        COUNT(ce.id)::int                                 AS total_clicks,
        COUNT(DISTINCT ce.ip_hash)::int                   AS unique_clicks,
        MAX(ce.timestamp)                                 AS last_click_at,
        (SELECT country FROM click_events
         WHERE link_id = l.id AND country IS NOT NULL AND country != ''
         GROUP BY country ORDER BY COUNT(*) DESC LIMIT 1) AS top_country,
        (SELECT device FROM click_events
         WHERE link_id = l.id AND device IS NOT NULL AND device != ''
         GROUP BY device ORDER BY COUNT(*) DESC LIMIT 1)  AS top_device,
        (SELECT referrer FROM click_events
         WHERE link_id = l.id AND referrer IS NOT NULL AND referrer != ''
         GROUP BY referrer ORDER BY COUNT(*) DESC LIMIT 1) AS top_referrer
      FROM links l
      LEFT JOIN click_events ce ON ce.link_id = l.id
      WHERE l.workspace_id = (SELECT id FROM workspaces WHERE user_id = ${userId} LIMIT 1)
      GROUP BY l.id
      ORDER BY total_clicks DESC
      LIMIT 500
    `),
  ]);

  if (userRows.rows.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = userRows.rows[0];
  const links = linkRows.rows as any[];

  const topLinks = [...links].sort((a, b) => Number(b.total_clicks) - Number(a.total_clicks)).slice(0, 10);
  const zeroClickLinks = links.filter((l) => Number(l.total_clicks) === 0);
  const disabledLinks = links.filter((l) => !l.enabled);
  const expiredLinks = links.filter((l) => l.expires_at && new Date(l.expires_at) < new Date());
  const recentLinks = [...links].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  const recentlyClicked = [...links]
    .filter((l) => l.last_click_at)
    .sort((a, b) => new Date(b.last_click_at).getTime() - new Date(a.last_click_at).getTime())
    .slice(0, 10);

  res.json({
    user,
    allLinks: links,
    topLinks,
    bottomLinks: [...links].filter((l) => Number(l.total_clicks) > 0)
      .sort((a, b) => Number(a.total_clicks) - Number(b.total_clicks)).slice(0, 10),
    zeroClickLinks,
    disabledLinks,
    expiredLinks,
    recentLinks,
    recentlyClicked,
    summary: {
      totalLinks: links.length,
      totalClicks: links.reduce((s, l) => s + Number(l.total_clicks), 0),
      activeLinks: links.filter((l) => l.enabled).length,
      zeroClickCount: zeroClickLinks.length,
    },
  });
});

/* ── Enhanced Links Performance ──────────────────────────────────────── */

router.get("/admin/links/performance", requireAdmin, async (req, res): Promise<void> => {
  const search = ((req.query.search as string) ?? "").toLowerCase();
  const status = (req.query.status as string) ?? "";
  const sort = (req.query.sort as string) ?? "clicks";
  const minClicks = parseInt((req.query.minClicks as string) ?? "0", 10);

  const orderBy = sort === "created" ? "l.created_at DESC" :
                  sort === "last_click" ? "last_click_at DESC NULLS LAST" :
                  sort === "asc" ? "total_clicks ASC" : "total_clicks DESC";

  const rows = await db.execute(sql`
    SELECT
      l.id, l.slug, l.destination_url, l.title,
      l.enabled, l.created_at, l.expires_at, l.click_limit,
      u.name  AS owner_name,
      u.email AS owner_email,
      u.plan  AS owner_plan,
      w.name  AS workspace_name,
      COUNT(ce.id)::int                AS total_clicks,
      COUNT(DISTINCT ce.ip_hash)::int  AS unique_clicks,
      MAX(ce.timestamp)                AS last_click_at,
      COUNT(DISTINCT CASE WHEN ce.timestamp >= NOW() - INTERVAL '7 days' THEN ce.id END)::int AS clicks_7d,
      (SELECT country FROM click_events
       WHERE link_id = l.id AND country IS NOT NULL AND country != ''
       GROUP BY country ORDER BY COUNT(*) DESC LIMIT 1) AS top_country,
      (SELECT device FROM click_events
       WHERE link_id = l.id AND device IS NOT NULL AND device != ''
       GROUP BY device ORDER BY COUNT(*) DESC LIMIT 1)  AS top_device
    FROM links l
    LEFT JOIN workspaces w ON w.id = l.workspace_id
    LEFT JOIN users u ON u.id = w.user_id
    LEFT JOIN click_events ce ON ce.link_id = l.id
    WHERE 1=1
      ${search ? sql`AND (lower(l.slug) LIKE ${"%" + search + "%"} OR lower(l.destination_url) LIKE ${"%" + search + "%"} OR lower(u.email) LIKE ${"%" + search + "%"})` : sql``}
      ${status === "active" ? sql`AND l.enabled = true` : status === "disabled" ? sql`AND l.enabled = false` : sql``}
    GROUP BY l.id, u.name, u.email, u.plan, w.name
    HAVING COUNT(ce.id) >= ${minClicks}
    ORDER BY ${sql.raw(orderBy)}
    LIMIT 500
  `);

  res.json(rows.rows);
});

/* ── Platform Timeseries & Growth ────────────────────────────────────── */

router.get("/admin/analytics/platform", requireAdmin, async (req, res): Promise<void> => {
  const days = Math.min(parseInt((req.query.days as string) ?? "30", 10), 365);

  const [clicksRows, usersRows, linksRows] = await Promise.all([
    db.execute(sql`
      SELECT
        to_char(DATE_TRUNC('day', timestamp), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS clicks
      FROM click_events
      WHERE timestamp >= NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY DATE_TRUNC('day', timestamp)
    `),
    db.execute(sql`
      SELECT
        to_char(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at)
    `),
    db.execute(sql`
      SELECT
        to_char(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS links
      FROM links
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(String(days))} days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at)
    `),
  ]);

  res.json({
    clicksByDay: clicksRows.rows,
    userGrowth: usersRows.rows,
    linkGrowth: linksRows.rows,
  });
});

/* ── Top User Rankings ────────────────────────────────────────────────── */

router.get("/admin/users/top", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "10", 10), 50);

  const rows = await db.execute(sql`
    SELECT
      u.id, u.name, u.email, u.plan, u.created_at,
      COUNT(DISTINCT l.id)::int AS total_links,
      COUNT(ce.id)::int         AS total_clicks,
      COUNT(DISTINCT CASE WHEN ce.timestamp >= NOW() - INTERVAL '7 days' THEN ce.id END)::int AS clicks_7d
    FROM users u
    LEFT JOIN workspaces w ON w.user_id = u.id
    LEFT JOIN links l ON l.workspace_id = w.id
    LEFT JOIN click_events ce ON ce.link_id = l.id
    GROUP BY u.id, u.name, u.email, u.plan, u.created_at
    ORDER BY total_clicks DESC
    LIMIT ${limit}
  `);

  res.json(rows.rows);
});

/* ── Platform Settings ──────────────────────────────────────────────── */

const LS_SETTING_KEYS = [
  "ls_api_key",
  "ls_store_id",
  "ls_webhook_secret",
  "ls_pro_variant_id",
  "ls_business_variant_id",
] as const;

type LsKey = typeof LS_SETTING_KEYS[number];

const LS_ENV_MAP: Record<LsKey, string> = {
  ls_api_key: "LEMONSQUEEZY_API_KEY",
  ls_store_id: "LEMONSQUEEZY_STORE_ID",
  ls_webhook_secret: "LEMONSQUEEZY_WEBHOOK_SECRET",
  ls_pro_variant_id: "LEMONSQUEEZY_PRO_VARIANT_ID",
  ls_business_variant_id: "LEMONSQUEEZY_BUSINESS_VARIANT_ID",
};

function maskSecret(v: string | null | undefined): string {
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return v.slice(0, 4) + "••••••••" + v.slice(-4);
}

async function getSettingValue(key: string): Promise<string | null> {
  const envKey = LS_ENV_MAP[key as LsKey];
  if (envKey && process.env[envKey]) return process.env[envKey]!;
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
  return row?.value ?? null;
}

router.get("/admin/settings/billing", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select().from(platformSettingsTable)
    .where(sql`key LIKE 'ls_%'`);

  const dbMap: Record<string, string> = {};
  for (const r of rows) dbMap[r.key] = r.value;

  const result: Record<string, { set: boolean; masked: string; source: "env" | "db" | "none" }> = {};

  for (const key of LS_SETTING_KEYS) {
    const envKey = LS_ENV_MAP[key];
    const envVal = process.env[envKey];
    const dbVal = dbMap[key];

    if (envVal) {
      result[key] = { set: true, masked: maskSecret(envVal), source: "env" };
    } else if (dbVal) {
      result[key] = { set: true, masked: maskSecret(dbVal), source: "db" };
    } else {
      result[key] = { set: false, masked: "", source: "none" };
    }
  }

  res.json(result);
});

router.post("/admin/settings/billing", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Partial<Record<LsKey, string>>;
  const saved: string[] = [];

  for (const key of LS_SETTING_KEYS) {
    const val = body[key];
    if (val !== undefined) {
      const trimmed = val.trim();
      if (trimmed === "") {
        await db.delete(platformSettingsTable).where(eq(platformSettingsTable.key, key));
      } else {
        await db.insert(platformSettingsTable)
          .values({ key, value: trimmed })
          .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: trimmed } });
        saved.push(key);
      }
    }
  }

  invalidateConfigCache();
  res.json({ ok: true, saved });
});

router.post("/admin/settings/billing/test", requireAdmin, async (req, res): Promise<void> => {
  const apiKey = await getSettingValue("ls_api_key");
  const storeId = await getSettingValue("ls_store_id");

  if (!apiKey) {
    res.status(422).json({ ok: false, error: "API key not configured" });
    return;
  }

  try {
    const r = await fetch("https://api.lemonsqueezy.com/v1/stores", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/vnd.api+json" },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      res.status(502).json({ ok: false, error: `Lemon Squeezy returned ${r.status}`, detail: text.slice(0, 200) });
      return;
    }
    const data = await r.json() as { data?: { id: string; attributes: { name: string } }[] };
    const stores = data.data ?? [];
    const matched = storeId ? stores.find((s) => s.id === storeId) : null;

    res.json({
      ok: true,
      stores: stores.map((s) => ({ id: s.id, name: s.attributes.name })),
      matchedStore: matched ? { id: matched.id, name: matched.attributes.name } : null,
    });
  } catch (err: unknown) {
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "Network error" });
  }
});

router.post("/admin/settings/billing/webhook-test", requireAdmin, async (req, res): Promise<void> => {
  const secret = await getSettingValue("ls_webhook_secret");
  res.json({ configured: !!secret });
});

export default router;

