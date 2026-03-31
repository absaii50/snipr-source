import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { getDomainVerifyToken, checkDomainDns } from "../lib/dns-utils";
import { invalidateConfigCache } from "../lib/config";
import crypto from "crypto";
import {
  db,
  usersTable,
  workspacesTable,
  linksTable,
  clickEventsTable,
  domainsTable,
  conversionsTable,
  platformSettingsTable,
  emailLogsTable,
  adminAuditLogTable,
  workspaceMembersTable,
} from "@workspace/db";
import { count, desc, eq, sql, ilike, isNull, isNotNull, and, inArray } from "drizzle-orm";
import { sendVerificationEmail, sendEmail } from "../lib/email";

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

async function logAuditAction(action: string, targetType: string | null, targetId: string | null, details: Record<string, unknown> | null, adminIp?: string) {
  try {
    await db.insert(adminAuditLogTable).values({ action, targetType, targetId, details, adminIp: adminIp ?? null });
  } catch {}
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
  await logAuditAction("change_plan", "user", req.params.id, { plan }, req.ip);
  res.json({ ok: true, plan });
});

router.patch("/admin/users/:id/suspend", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id;
  await db.update(usersTable).set({ suspendedAt: new Date() }).where(eq(usersTable.id, userId));
  await db.execute(sql`DELETE FROM session WHERE (sess::jsonb->>'userId')::text = ${userId}`);
  await logAuditAction("suspend_user", "user", userId, null, req.ip);
  res.json({ ok: true });
});

router.patch("/admin/users/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  await db.update(usersTable).set({ suspendedAt: null }).where(eq(usersTable.id, req.params.id));
  await logAuditAction("activate_user", "user", req.params.id, null, req.ip);
  res.json({ ok: true });
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id;
  await db.execute(sql`DELETE FROM session WHERE (sess::jsonb->>'userId')::text = ${userId}`);
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await logAuditAction("delete_user", "user", userId, null, req.ip);
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
  await logAuditAction("delete_link", "link", req.params.id, null, req.ip);
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

  // Block snipr.sh - it's the main app domain, not for redirects
  if (normalized === "snipr.sh" || normalized === "www.snipr.sh" || normalized.endsWith(".snipr.sh")) {
    res.status(422).json({ error: "snipr.sh is the main app domain and cannot be added for redirects." });
    return;
  }

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

  await logAuditAction("create_domain", "domain", created.id, { domain: normalized, workspaceId }, req.ip);
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
  await logAuditAction("delete_domain", "domain", req.params.id, null, req.ip);
  res.json({ ok: true });
});

/* ── Email Management ─────────────────────────────────────────────── */
router.get("/admin/email-stats", requireAdmin, async (req, res): Promise<void> => {
  const [[totalEmails], [todayEmails], [failedEmails], [totalUsers], [verifiedUsers]] = await Promise.all([
    db.select({ count: count() }).from(emailLogsTable),
    db.select({ count: count() }).from(emailLogsTable).where(sql`${emailLogsTable.createdAt} >= NOW() - INTERVAL '1 day'`),
    db.select({ count: count() }).from(emailLogsTable).where(eq(emailLogsTable.status, "failed")),
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.emailVerified, true)),
  ]);

  res.json({
    totalEmails: totalEmails.count,
    todayEmails: todayEmails.count,
    failedEmails: failedEmails.count,
    totalUsers: totalUsers.count,
    verifiedUsers: verifiedUsers.count,
    verificationRate: totalUsers.count > 0 ? Math.round((verifiedUsers.count / totalUsers.count) * 100) : 0,
  });
});

router.get("/admin/email-logs", requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;
  const typeFilter = req.query.type as string;
  const search = req.query.search as string;

  let query = db
    .select({
      id: emailLogsTable.id,
      to: emailLogsTable.to,
      subject: emailLogsTable.subject,
      type: emailLogsTable.type,
      status: emailLogsTable.status,
      resendId: emailLogsTable.resendId,
      error: emailLogsTable.error,
      createdAt: emailLogsTable.createdAt,
      userId: emailLogsTable.userId,
    })
    .from(emailLogsTable)
    .orderBy(desc(emailLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const conditions = [];
  if (typeFilter && typeFilter !== "all") {
    conditions.push(eq(emailLogsTable.type, typeFilter));
  }
  if (search) {
    conditions.push(ilike(emailLogsTable.to, `%${search}%`));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const logs = await query;
  const [[{ total }]] = await Promise.all([
    db.select({ total: count() }).from(emailLogsTable),
  ]);

  res.json({ logs, total, page, limit });
});

router.post("/admin/force-verify/:userId", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true, emailVerificationToken: null })
    .where(eq(usersTable.id, userId));

  await db.insert(emailLogsTable).values({
    userId,
    to: user.email,
    subject: "Admin force-verified email",
    type: "admin_force_verify",
    status: "sent",
  });

  await logAuditAction("force_verify_email", "user", userId, { email: user.email }, req.ip);
  res.json({ ok: true });
});

router.post("/admin/resend-verification/:userId", requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.emailVerified) {
    res.json({ ok: true, message: "Email already verified" });
    return;
  }

  const newToken = crypto.randomUUID();
  await db
    .update(usersTable)
    .set({ emailVerificationToken: newToken })
    .where(eq(usersTable.id, userId));

  await sendVerificationEmail({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerificationToken: newToken,
  });

  await logAuditAction("resend_verification", "user", userId, { email: user.email }, req.ip);
  res.json({ ok: true, message: "Verification email sent" });
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
  const links = linkRows.rows as Record<string, unknown>[];

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
  await logAuditAction("update_billing_settings", "settings", null, { saved }, req.ip);
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

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 1: Audit Log
   ══════════════════════════════════════════════════════════════════════ */

router.get("/admin/audit-log", requireAdmin, async (req, res): Promise<void> => {
  const action = (req.query.action as string) ?? "";
  const search = (req.query.search as string) ?? "";
  const from = (req.query.from as string) ?? "";
  const to = (req.query.to as string) ?? "";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (action) conditions.push(eq(adminAuditLogTable.action, action));
  if (search) conditions.push(sql`(${adminAuditLogTable.targetType}::text ILIKE ${"%" + search + "%"} OR ${adminAuditLogTable.targetId}::text ILIKE ${"%" + search + "%"} OR ${adminAuditLogTable.details}::text ILIKE ${"%" + search + "%"})`);
  if (from) conditions.push(sql`${adminAuditLogTable.createdAt} >= ${from}::timestamp`);
  if (to) conditions.push(sql`${adminAuditLogTable.createdAt} <= ${to}::timestamp`);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db
    .select()
    .from(adminAuditLogTable)
    .where(whereClause)
    .orderBy(desc(adminAuditLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(adminAuditLogTable).where(whereClause);

  res.json({ logs, total, page, limit });
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 2: System Health Monitor
   ══════════════════════════════════════════════════════════════════════ */

const SERVER_START_TIME = Date.now();

const responseTimeSamples: number[] = [];
function recordResponseTime(ms: number) {
  responseTimeSamples.push(ms);
  if (responseTimeSamples.length > 200) responseTimeSamples.shift();
}

router.get("/admin/health-detail", requireAdmin, async (req, res): Promise<void> => {
  const mem = process.memoryUsage();
  const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

  const dbQueryStart = Date.now();
  const [[sessionCount], [dbSize], [dbPoolInfo]] = await Promise.all([
    db.select({ count: count() }).from(sql`session`),
    db.execute(sql`SELECT pg_database_size(current_database()) as size`).then(r => r.rows),
    db.execute(sql`SELECT numbackends, xact_commit, xact_rollback, deadlocks FROM pg_stat_database WHERE datname = current_database()`).then(r => r.rows),
  ]);
  const dbLatencyMs = Date.now() - dbQueryStart;
  recordResponseTime(dbLatencyMs);

  const [[clicksToday], [usersToday]] = await Promise.all([
    db.select({ count: count() }).from(clickEventsTable).where(sql`${clickEventsTable.timestamp} >= NOW() - INTERVAL '1 day'`),
    db.select({ count: count() }).from(usersTable).where(sql`${usersTable.createdAt} >= NOW() - INTERVAL '1 day'`),
  ]);

  const pool = dbPoolInfo as Record<string, unknown> | undefined;
  const avgResponseMs = responseTimeSamples.length > 0
    ? Math.round(responseTimeSamples.reduce((a, b) => a + b, 0) / responseTimeSamples.length)
    : 0;

  const checks = {
    database: dbLatencyMs < 5000,
    memory: mem.heapUsed / mem.heapTotal < 0.95,
    uptime: uptime > 0,
  };
  const overallStatus = Object.values(checks).every(Boolean) ? "healthy" : "degraded";

  res.json({
    uptime,
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
    },
    activeSessions: sessionCount?.count ?? 0,
    dbSizeBytes: Number((dbSize as Record<string, unknown>)?.size ?? 0),
    dbSizeMb: Math.round(Number((dbSize as Record<string, unknown>)?.size ?? 0) / 1024 / 1024),
    dbPool: {
      activeConnections: Number(pool?.numbackends ?? 0),
      totalCommits: Number(pool?.xact_commit ?? 0),
      totalRollbacks: Number(pool?.xact_rollback ?? 0),
      deadlocks: Number(pool?.deadlocks ?? 0),
    },
    apiResponseTime: {
      avgMs: avgResponseMs,
      lastDbLatencyMs: dbLatencyMs,
      samples: responseTimeSamples.length,
    },
    clicksToday: clicksToday?.count ?? 0,
    usersToday: usersToday?.count ?? 0,
    nodeVersion: process.version,
    platform: process.platform,
    status: overallStatus,
    checks,
  });
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 3: User Impersonation
   ══════════════════════════════════════════════════════════════════════ */

interface ImpersonationData {
  userId: string;
  userName: string;
  userEmail: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  originalUserId: string | null;
  originalWorkspaceId: string | null;
}

router.post("/admin/users/:id/impersonate", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id;

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [ws] = await db.select({ id: workspacesTable.id, slug: workspacesTable.slug })
    .from(workspacesTable).where(eq(workspacesTable.userId, userId));

  const session = req.session as Record<string, unknown>;
  const impData: ImpersonationData = {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    workspaceId: ws?.id ?? null,
    workspaceSlug: ws?.slug ?? null,
    originalUserId: (session.userId as string) ?? null,
    originalWorkspaceId: (session.workspaceId as string) ?? null,
  };

  session.impersonating = impData;
  session.userId = user.id;
  session.workspaceId = ws?.id ?? null;

  await logAuditAction("impersonate_user", "user", userId, { userName: user.name }, req.ip);
  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
});

router.post("/admin/stop-impersonate", requireAdmin, async (req, res): Promise<void> => {
  const session = req.session as Record<string, unknown>;
  const imp = session.impersonating as ImpersonationData | undefined;
  if (imp) {
    session.userId = imp.originalUserId;
    session.workspaceId = imp.originalWorkspaceId;
    await logAuditAction("stop_impersonate", "user", imp.userId, { userName: imp.userName }, req.ip);
  }
  delete session.impersonating;
  res.json({ ok: true });
});

router.get("/admin/impersonation-status", requireAdmin, (req, res): void => {
  const imp = (req.session as Record<string, unknown>).impersonating as ImpersonationData | undefined;
  res.json({ impersonating: imp ?? null });
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 4: Bulk User Actions
   ══════════════════════════════════════════════════════════════════════ */

router.post("/admin/users/bulk", requireAdmin, async (req, res): Promise<void> => {
  const { action, userIds, plan } = req.body as { action: string; userIds: string[]; plan?: string };

  if (!action || !Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ error: "action and userIds[] required" });
    return;
  }

  let affected = 0;

  switch (action) {
    case "suspend":
      await db.update(usersTable).set({ suspendedAt: new Date() }).where(inArray(usersTable.id, userIds));
      for (const uid of userIds) {
        await db.execute(sql`DELETE FROM session WHERE (sess::jsonb->>'userId')::text = ${uid}`);
      }
      affected = userIds.length;
      await logAuditAction("bulk_suspend", "user", null, { count: affected, userIds }, req.ip);
      break;

    case "activate":
      await db.update(usersTable).set({ suspendedAt: null }).where(inArray(usersTable.id, userIds));
      affected = userIds.length;
      await logAuditAction("bulk_activate", "user", null, { count: affected, userIds }, req.ip);
      break;

    case "delete":
      for (const uid of userIds) {
        await db.execute(sql`DELETE FROM session WHERE (sess::jsonb->>'userId')::text = ${uid}`);
      }
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
      affected = userIds.length;
      await logAuditAction("bulk_delete", "user", null, { count: affected, userIds }, req.ip);
      break;

    case "change_plan":
      if (!plan || !["free", "pro", "business"].includes(plan)) {
        res.status(400).json({ error: "Invalid plan" });
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
      await db.update(usersTable).set(updates).where(inArray(usersTable.id, userIds));
      affected = userIds.length;
      await logAuditAction("bulk_plan_change", "user", null, { count: affected, plan, userIds }, req.ip);
      break;

    default:
      res.status(400).json({ error: "Unknown action" });
      return;
  }

  res.json({ ok: true, affected });
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 5: Link Health Checker
   ══════════════════════════════════════════════════════════════════════ */

router.post("/admin/links/health-check", requireAdmin, async (req, res): Promise<void> => {
  const { linkIds } = req.body as { linkIds?: string[] };

  let links;
  if (linkIds && linkIds.length > 0) {
    links = await db.select({ id: linksTable.id, slug: linksTable.slug, destinationUrl: linksTable.destinationUrl })
      .from(linksTable).where(inArray(linksTable.id, linkIds));
  } else {
    links = await db.select({ id: linksTable.id, slug: linksTable.slug, destinationUrl: linksTable.destinationUrl })
      .from(linksTable).where(eq(linksTable.enabled, true)).limit(50);
  }

  function isPrivateUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0") return true;
      if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return true;
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
      const parts = hostname.split(".");
      if (parts[0] === "10") return true;
      if (parts[0] === "172" && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) return true;
      if (parts[0] === "192" && parts[1] === "168") return true;
      if (hostname === "169.254.169.254") return true;
      if (hostname.includes("metadata.google") || hostname.includes("metadata.aws")) return true;
      return false;
    } catch { return true; }
  }

  const results: { id: string; slug: string; url: string; status: number | null; ok: boolean; error?: string; checkedAt: string }[] = [];

  for (const link of links) {
    if (isPrivateUrl(link.destinationUrl)) {
      results.push({
        id: link.id, slug: link.slug, url: link.destinationUrl,
        status: null, ok: false, error: "Blocked: private/internal URL",
        checkedAt: new Date().toISOString(),
      });
      continue;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(link.destinationUrl, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "Snipr-HealthChecker/1.0" },
      });
      clearTimeout(timeout);
      results.push({
        id: link.id, slug: link.slug, url: link.destinationUrl,
        status: r.status, ok: r.status >= 200 && r.status < 400,
        checkedAt: new Date().toISOString(),
      });
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error("Network error");
      results.push({
        id: link.id, slug: link.slug, url: link.destinationUrl,
        status: null, ok: false, error: err.name === "AbortError" ? "Timeout" : (err.message || "Network error"),
        checkedAt: new Date().toISOString(),
      });
    }
  }

  await logAuditAction("link_health_check", "link", null, { checked: results.length, broken: results.filter(r => !r.ok).length }, req.ip);
  res.json(results);
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 6: CSV Export
   ══════════════════════════════════════════════════════════════════════ */

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

router.get("/admin/export/users", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT u.id, u.name, u.email, u.plan, u.suspended_at, u.created_at, u.email_verified,
           w.name AS workspace_name, w.slug AS workspace_slug,
           COUNT(DISTINCT l.id)::int AS total_links,
           COUNT(ce.id)::int AS total_clicks
    FROM users u
    LEFT JOIN workspaces w ON w.user_id = u.id
    LEFT JOIN links l ON l.workspace_id = w.id
    LEFT JOIN click_events ce ON ce.link_id = l.id
    GROUP BY u.id, w.name, w.slug
    ORDER BY u.created_at DESC
  `);
  const csv = toCsv(["id","name","email","plan","suspended_at","created_at","email_verified","workspace_name","workspace_slug","total_links","total_clicks"], rows.rows as Record<string, unknown>[]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=snipr-users.csv");
  res.send(csv);
});

router.get("/admin/export/links", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT l.id, l.slug, l.destination_url, l.title, l.enabled, l.created_at, l.expires_at,
           u.email AS owner_email, u.plan AS owner_plan, w.name AS workspace_name,
           COUNT(ce.id)::int AS total_clicks
    FROM links l
    LEFT JOIN workspaces w ON w.id = l.workspace_id
    LEFT JOIN users u ON u.id = w.user_id
    LEFT JOIN click_events ce ON ce.link_id = l.id
    GROUP BY l.id, u.email, u.plan, w.name
    ORDER BY l.created_at DESC
  `);
  const csv = toCsv(["id","slug","destination_url","title","enabled","created_at","expires_at","owner_email","owner_plan","workspace_name","total_clicks"], rows.rows as Record<string, unknown>[]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=snipr-links.csv");
  res.send(csv);
});

router.get("/admin/export/clicks", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT ce.id, ce.timestamp, l.slug, ce.country, ce.city, ce.region, ce.device, ce.browser, ce.os, ce.referrer
    FROM click_events ce
    LEFT JOIN links l ON l.id = ce.link_id
    ORDER BY ce.timestamp DESC
    LIMIT 10000
  `);
  const csv = toCsv(["id","timestamp","slug","country","city","region","device","browser","os","referrer"], rows.rows as Record<string, unknown>[]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=snipr-clicks.csv");
  res.send(csv);
});

router.get("/admin/export/emails", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select({
    id: emailLogsTable.id, to: emailLogsTable.to, subject: emailLogsTable.subject,
    type: emailLogsTable.type, status: emailLogsTable.status, createdAt: emailLogsTable.createdAt,
    error: emailLogsTable.error,
  }).from(emailLogsTable).orderBy(desc(emailLogsTable.createdAt)).limit(5000);
  const csv = toCsv(["id","to","subject","type","status","createdAt","error"], rows as Record<string, unknown>[]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=snipr-emails.csv");
  res.send(csv);
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 7: Announcement Banner
   ══════════════════════════════════════════════════════════════════════ */

router.get("/admin/announcement", requireAdmin, async (req, res): Promise<void> => {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "announcement"));
  if (!row) { res.json({ enabled: false, text: "", type: "info" }); return; }
  try {
    res.json(JSON.parse(row.value));
  } catch {
    res.json({ enabled: false, text: "", type: "info" });
  }
});

router.post("/admin/announcement", requireAdmin, async (req, res): Promise<void> => {
  const { enabled, text, type } = req.body as { enabled: boolean; text: string; type: string };
  const value = JSON.stringify({ enabled: !!enabled, text: text || "", type: type || "info" });
  await db.insert(platformSettingsTable)
    .values({ key: "announcement", value })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value } });
  await logAuditAction("update_announcement", "platform", null, { enabled, text, type }, req.ip);
  res.json({ ok: true });
});

router.get("/announcement", async (_req, res): Promise<void> => {
  const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "announcement"));
  if (!row) { res.json({ enabled: false }); return; }
  try {
    const data = JSON.parse(row.value);
    if (!data.enabled) { res.json({ enabled: false }); return; }
    res.json(data);
  } catch {
    res.json({ enabled: false });
  }
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 8: Rate Limit Dashboard
   ══════════════════════════════════════════════════════════════════════ */

interface RateLimitEvent {
  path: string;
  ip: string;
  timestamp: string;
}

const rateLimitEvents: RateLimitEvent[] = [];
const RATE_LIMIT_EVENT_MAX = 500;
const rateLimitWhitelist: Set<string> = new Set();
const rateLimitOverrides: Map<string, number> = new Map();

export function recordRateLimitEvent(path: string, ip: string) {
  rateLimitEvents.push({ path, ip: ip.replace(/^::ffff:/, ""), timestamp: new Date().toISOString() });
  if (rateLimitEvents.length > RATE_LIMIT_EVENT_MAX) rateLimitEvents.shift();
}

export function isIpWhitelisted(ip: string): boolean {
  return rateLimitWhitelist.has(ip.replace(/^::ffff:/, ""));
}

export function getRateLimitOverride(name: string): number | undefined {
  return rateLimitOverrides.get(name);
}

router.get("/admin/rate-limits", requireAdmin, async (_req, res): Promise<void> => {
  const last24h = new Date(Date.now() - 86400000).toISOString();
  const recentEvents = rateLimitEvents.filter(e => e.timestamp >= last24h);
  const blockedByPath: Record<string, number> = {};
  for (const e of recentEvents) {
    blockedByPath[e.path] = (blockedByPath[e.path] || 0) + 1;
  }

  const defaultLimits = [
    { name: "API General", path: "/api/*", windowMs: 60000, max: 200, description: "Standard API endpoints" },
    { name: "Redirects", path: "/*", windowMs: 60000, max: 120, description: "Short link redirects" },
    { name: "Password Reset", path: "/api/auth/forgot-password", windowMs: 900000, max: 5, description: "Password reset requests" },
    { name: "Admin Login", path: "/api/admin/login", windowMs: 900000, max: 5, description: "Admin panel login" },
  ];

  const limits = defaultLimits.map(l => ({
    ...l,
    effectiveMax: rateLimitOverrides.get(l.name) ?? l.max,
    overridden: rateLimitOverrides.has(l.name),
  }));

  res.json({
    limits,
    whitelist: [...rateLimitWhitelist],
    recentBlocked: {
      total: recentEvents.length,
      byPath: blockedByPath,
      lastEvents: recentEvents.slice(-20),
    },
  });
});

router.post("/admin/rate-limits/whitelist", requireAdmin, async (req, res): Promise<void> => {
  const { ip, action } = req.body as { ip: string; action: "add" | "remove" };
  if (!ip || !action) { res.status(400).json({ error: "ip and action required" }); return; }
  const cleaned = ip.trim().replace(/^::ffff:/, "");
  if (action === "add") {
    rateLimitWhitelist.add(cleaned);
  } else {
    rateLimitWhitelist.delete(cleaned);
  }
  await logAuditAction("rate_limit_whitelist", "settings", null, { ip: cleaned, action }, req.ip);
  res.json({ ok: true, whitelist: [...rateLimitWhitelist] });
});

router.post("/admin/rate-limits/adjust", requireAdmin, async (req, res): Promise<void> => {
  const { name, max } = req.body as { name: string; max: number | null };
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  if (max === null || max === undefined) {
    rateLimitOverrides.delete(name);
  } else {
    rateLimitOverrides.set(name, Math.max(1, Math.min(10000, max)));
  }
  await logAuditAction("rate_limit_adjust", "settings", null, { name, max }, req.ip);
  res.json({ ok: true, overrides: Object.fromEntries(rateLimitOverrides) });
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 9: Workspace Inspector
   ══════════════════════════════════════════════════════════════════════ */

router.get("/admin/users/:id/workspace-detail", requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.id;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.userId, userId));

  let links: Record<string, unknown>[] = [];
  let domains: Record<string, unknown>[] = [];
  let members: Record<string, unknown>[] = [];
  let totalClicks = 0;
  let recentClicks: Record<string, unknown>[] = [];

  if (ws) {
    links = await db.execute(sql`
      SELECT l.id, l.slug, l.destination_url, l.title, l.enabled, l.created_at,
             COUNT(ce.id)::int AS total_clicks,
             MAX(ce.timestamp) AS last_click_at
      FROM links l
      LEFT JOIN click_events ce ON ce.link_id = l.id
      WHERE l.workspace_id = ${ws.id}
      GROUP BY l.id
      ORDER BY total_clicks DESC
    `).then(r => r.rows);

    domains = await db.select().from(domainsTable).where(eq(domainsTable.workspaceId, ws.id));

    members = await db.execute(sql`
      SELECT wm.role, u.name, u.email
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ${ws.id}
    `).then(r => r.rows);

    const [tc] = await db.select({ count: count() }).from(clickEventsTable)
      .where(sql`${clickEventsTable.linkId} IN (SELECT id FROM links WHERE workspace_id = ${ws.id})`);
    totalClicks = tc.count;

    recentClicks = await db.execute(sql`
      SELECT ce.timestamp, ce.country, ce.device, l.slug
      FROM click_events ce
      JOIN links l ON l.id = ce.link_id
      WHERE l.workspace_id = ${ws.id}
      ORDER BY ce.timestamp DESC
      LIMIT 20
    `).then(r => r.rows);
  }

  res.json({
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan, createdAt: user.createdAt, suspendedAt: user.suspendedAt, emailVerified: user.emailVerified },
    workspace: ws ? { id: ws.id, name: ws.name, slug: ws.slug, createdAt: ws.createdAt } : null,
    links,
    domains,
    members,
    totalClicks,
    recentClicks,
    summary: {
      totalLinks: links.length,
      activeLinks: links.filter((l) => l.enabled).length,
      totalClicks,
      totalDomains: domains.length,
      totalMembers: members.length,
    },
  });
});

/* ══════════════════════════════════════════════════════════════════════
   FEATURE 10: Mass Email / Platform Notifications
   ══════════════════════════════════════════════════════════════════════ */

router.post("/admin/notifications/preview", requireAdmin, async (req, res): Promise<void> => {
  const { planFilter, template, subject, body } = req.body as {
    planFilter: string; template: string; subject: string; body: string;
  };

  const conditions = [];
  if (planFilter && planFilter !== "all") {
    conditions.push(eq(usersTable.plan, planFilter));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ count: recipientCount }] = await db.select({ count: count() }).from(usersTable).where(whereClause);

  res.json({ recipientCount, subject, template });
});

router.post("/admin/notifications/send", requireAdmin, async (req, res): Promise<void> => {
  const { planFilter, template, subject, body } = req.body as {
    planFilter: string; template: string; subject: string; body: string;
  };

  if (!subject || !body) {
    res.status(400).json({ error: "Subject and body are required" });
    return;
  }

  const conditions = [];
  if (planFilter && planFilter !== "all") {
    conditions.push(eq(usersTable.plan, planFilter));
  }

  const sendWhereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable).where(sendWhereClause);

  const templateStyles: Record<string, { bgColor: string; accentColor: string; label: string }> = {
    maintenance: { bgColor: "#FEF3C7", accentColor: "#D97706", label: "Maintenance Notice" },
    feature: { bgColor: "#DBEAFE", accentColor: "#2563EB", label: "Feature Announcement" },
    security: { bgColor: "#FEE2E2", accentColor: "#DC2626", label: "Security Alert" },
    general: { bgColor: "#F3F4F6", accentColor: "#374151", label: "Platform Update" },
  };
  const style = templateStyles[template] || templateStyles.general;

  const htmlTemplate = `
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="background:${style.bgColor};padding:16px 24px;border-radius:12px 12px 0 0;border-bottom:3px solid ${style.accentColor};">
        <span style="font-size:12px;font-weight:700;color:${style.accentColor};text-transform:uppercase;letter-spacing:0.5px;">${style.label}</span>
      </div>
      <div style="padding:24px;background:#fff;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px;">
        <h2 style="margin:0 0 16px;color:#0A0A0A;font-size:18px;">${subject}</h2>
        <div style="color:#374151;font-size:14px;line-height:1.6;">${body.replace(/\n/g, "<br>")}</div>
        <hr style="border:0;border-top:1px solid #E5E7EB;margin:24px 0;">
        <p style="color:#9CA3AF;font-size:12px;margin:0;">Sent by Snipr Platform</p>
      </div>
    </div>
  `;

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await sendEmail({ to: user.email, subject, html: htmlTemplate, userId: user.id, type: `mass_${template}` });
      if (result.error) {
        failed++;
      } else {
        sent++;
      }
    } catch {
      failed++;
    }
  }

  await logAuditAction("mass_email", "platform", null, {
    template, subject, planFilter, recipientCount: users.length, sent, failed,
  }, req.ip);

  res.json({ ok: true, sent, failed, total: users.length });
});

export default router;

