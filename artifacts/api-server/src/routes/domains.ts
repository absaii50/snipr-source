import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, domainsTable, platformSettingsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getDomainVerifyToken, checkDomainDns, CNAME_TARGET } from "../lib/dns-utils";

const SERVER_IP = process.env.SERVER_IP || "163.245.216.153";

const router: IRouter = Router();

router.get("/domains", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  // Return workspace-specific domains + platform domains (shared across all users)
  const domains = await db
    .select()
    .from(domainsTable)
    .where(or(
      eq(domainsTable.workspaceId, workspaceId),
      eq(domainsTable.isPlatformDomain, true),
    ))
    .orderBy(domainsTable.createdAt);
  res.json(domains);
});

/* ── Default Domain ──────────────────────────────────────────────── */
router.get("/domains/default", requireAuth, async (_req, res): Promise<void> => {
  try {
    // 1. Check platform config for default_domain
    const [cfgRow] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "platform_config"));
    if (cfgRow) {
      const cfg = JSON.parse(cfgRow.value);
      if (cfg.default_domain) {
        const [dom] = await db
          .select({ id: domainsTable.id, domain: domainsTable.domain })
          .from(domainsTable)
          .where(and(eq(domainsTable.domain, cfg.default_domain), eq(domainsTable.verified, true)));
        if (dom) { res.json(dom); return; }
      }
    }
    // 2. Fallback: first verified platform domain
    const [firstPlatform] = await db
      .select({ id: domainsTable.id, domain: domainsTable.domain })
      .from(domainsTable)
      .where(and(eq(domainsTable.isPlatformDomain, true), eq(domainsTable.verified, true)))
      .orderBy(domainsTable.createdAt)
      .limit(1);
    if (firstPlatform) { res.json(firstPlatform); return; }
    res.json(null);
  } catch { res.json(null); }
});

router.post("/domains", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { domain, supportsSubdomains, purpose } = req.body as {
    domain?: string;
    supportsSubdomains?: boolean;
    purpose?: string;
  };

  if (!domain || typeof domain !== "string") {
    res.status(422).json({ error: "Validation error", message: "domain is required" });
    return;
  }

  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  // Block snipr.sh
  if (normalized === "snipr.sh" || normalized === "www.snipr.sh" || normalized.endsWith(".snipr.sh")) {
    res.status(422).json({ error: "Validation error", message: "snipr.sh is the main app domain and cannot be used for short link redirects." });
    return;
  }

  const [existing] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.domain, normalized));

  if (existing) {
    res.status(409).json({ error: "Conflict", message: "This domain is already registered." });
    return;
  }

  const isParent = supportsSubdomains === true;
  const validPurpose = purpose === "has_website" ? "has_website" : "links_only";

  const [created] = await db
    .insert(domainsTable)
    .values({
      workspaceId,
      domain: normalized,
      isParentDomain: isParent,
      supportsSubdomains: isParent,
      purpose: validPurpose,
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/domains/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const { supportsSubdomains } = req.body as { supportsSubdomains?: boolean };

  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(and(eq(domainsTable.id, id), eq(domainsTable.workspaceId, workspaceId)));

  if (!domain) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const isParent = supportsSubdomains === true;
  const [updated] = await db
    .update(domainsTable)
    .set({ isParentDomain: isParent, supportsSubdomains: isParent })
    .where(eq(domainsTable.id, id))
    .returning();

  res.json(updated);
});

/* ── DNS Setup Info (enhanced for wizard) ─────────────────────────── */
router.get("/domains/:id/setup-info", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(and(eq(domainsTable.id, id), eq(domainsTable.workspaceId, workspaceId)));

  if (!domain) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const token = getDomainVerifyToken(domain.id);
  const parts = domain.domain.split(".");
  const isRootDomain = parts.length <= 2;
  const rootDomain = isRootDomain ? domain.domain : parts.slice(-2).join(".");
  const cnameHost = isRootDomain ? "@" : parts.slice(0, -2).join(".");
  const purpose = domain.purpose || "links_only";

  // Build purpose-aware DNS records — always use A record for all domains
  const records: { type: string; name: string; value: string; priority?: string }[] = [];
  const warnings: string[] = [];
  const suggestedSubdomains: string[] = [];

  // Always A record — works for both root domains and subdomains
  records.push({ type: "A", name: isRootDomain ? "@" : cnameHost, value: SERVER_IP, priority: "Required" });

  if (purpose === "has_website") {
    if (isRootDomain) {
      warnings.push("Changing your A record will redirect ALL traffic from your root domain to Snipr. Your existing website will stop working on this domain.");
      warnings.push("We strongly recommend using a subdomain instead.");
      suggestedSubdomains.push(
        `go.${domain.domain}`,
        `link.${domain.domain}`,
        `to.${domain.domain}`,
        `s.${domain.domain}`,
      );
    } else {
      warnings.push("This subdomain will be used for short links. Your main website at " + rootDomain + " will not be affected.");
    }
  }

  // TXT verification always
  records.push({ type: "TXT", name: `_snipr-verify.${domain.domain}`, value: token, priority: "Optional" });

  const cloudflareUrl = `https://dash.cloudflare.com/?to=/:account/${rootDomain}/dns`;

  res.json({
    id: domain.id,
    domain: domain.domain,
    verified: domain.verified,
    token,
    purpose,
    domainType: isRootDomain ? "root" : "subdomain",
    isRootDomain,
    rootDomain,
    cnameHost,
    cnameTarget: CNAME_TARGET,
    txtHost: `_snipr-verify.${domain.domain}`,
    txtValue: token,
    recommendations: {
      records,
      warnings,
      suggestedSubdomains,
      cloudflareUrl,
    },
  });
});

/* ── DNS Check ────────────────────────────────────────────────────── */
router.get("/domains/:id/dns-check", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(and(eq(domainsTable.id, id), eq(domainsTable.workspaceId, workspaceId)));

  if (!domain) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const token = getDomainVerifyToken(domain.id);
  const dnsResult = await checkDomainDns(domain.domain, token);

  res.json({ domain: domain.domain, verified: domain.verified, token, ...dnsResult });
});

/* ── Verify Domain ────────────────────────────────────────────────── */
router.patch("/domains/:id/verify", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(and(eq(domainsTable.id, id), eq(domainsTable.workspaceId, workspaceId)));

  if (!domain) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const token = getDomainVerifyToken(domain.id);
  const dnsResult = await checkDomainDns(domain.domain, token);

  if (!dnsResult.ready) {
    res.status(422).json({
      error: "dns_not_configured",
      message: "DNS records not found yet. Add the A record pointing to our server IP and try again.",
      token,
    });
    return;
  }

  await db.update(domainsTable).set({ verified: true }).where(eq(domainsTable.id, domain.id));
  res.json({ ok: true, domain: domain.domain });
});

router.delete("/domains/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [domain] = await db
    .select()
    .from(domainsTable)
    .where(and(eq(domainsTable.id, id), eq(domainsTable.workspaceId, workspaceId)));

  if (!domain) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(domainsTable).where(eq(domainsTable.id, id));
  res.json({ message: "Domain removed" });
});

export default router;
