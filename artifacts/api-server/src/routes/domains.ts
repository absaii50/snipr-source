import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, domainsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getDomainVerifyToken, checkDomainDns } from "../lib/dns-utils";

const router: IRouter = Router();

router.get("/domains", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const domains = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.workspaceId, workspaceId))
    .orderBy(domainsTable.createdAt);
  res.json(domains);
});

router.post("/domains", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { domain, supportsSubdomains } = req.body as { domain?: string; supportsSubdomains?: boolean };

  if (!domain || typeof domain !== "string") {
    res.status(422).json({ error: "Validation error", message: "domain is required" });
    return;
  }

  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  // Block snipr.sh - it's the main app domain, not for redirects
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

  // SUBDOMAIN SUPPORT: Set isParentDomain if supportsSubdomains is enabled
  const isParent = supportsSubdomains === true;

  const [created] = await db
    .insert(domainsTable)
    .values({
      workspaceId,
      domain: normalized,
      isParentDomain: isParent,
      supportsSubdomains: isParent,
    })
    .returning();

  res.status(201).json(created);
});

// SUBDOMAIN SUPPORT: Update domain subdomain settings
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
    .set({
      isParentDomain: isParent,
      supportsSubdomains: isParent,
    })
    .where(eq(domainsTable.id, id))
    .returning();

  res.json(updated);
});

/* ── DNS Setup Info (for wizard) ─────────────────────────────────── */
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
  const subdomain = domain.domain.split(".").slice(0, -2).join(".") || "@";

  res.json({
    id: domain.id,
    domain: domain.domain,
    verified: domain.verified,
    token,
    cnameHost: subdomain,
    cnameTarget: "snipr.sh",
    txtHost: `_snipr-verify.${domain.domain}`,
    txtValue: token,
  });
});

/* ── DNS Check (for wizard) ──────────────────────────────────────── */
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

  res.json({
    domain: domain.domain,
    verified: domain.verified,
    token,
    ...dnsResult,
  });
});

/* ── Verify Domain (for wizard) ──────────────────────────────────── */
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
      message: "DNS records not found yet. Add the CNAME or TXT record and try again.",
      token,
    });
    return;
  }

  await db
    .update(domainsTable)
    .set({ verified: true })
    .where(eq(domainsTable.id, domain.id));

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
