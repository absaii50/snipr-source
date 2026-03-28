import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, linksTable, linkRulesTable, pixelsTable, clickEventsTable, domainsTable } from "@workspace/db";
import { getLinkBySlug } from "../lib/link-cache";
import { trackClick } from "../lib/click-tracker";
import { buildPixelPage } from "../lib/pixels";

const router: IRouter = Router();

/**
 * Extract subdomain and parent domain from a host
 * Examples:
 * - "go.example.com" -> { subdomain: "go", domain: "example.com" }
 * - "example.com" -> { subdomain: null, domain: "example.com" }
 * - "api.v2.example.com" -> { subdomain: "api.v2", domain: "example.com" }
 */
function extractSubdomainAndDomain(host: string): { subdomain: string | null; domain: string } {
  const parts = host.split(".");
  // Need at least 2 parts for a domain (example.com)
  if (parts.length < 2) {
    return { subdomain: null, domain: host };
  }
  // Take last 2 parts as domain, rest as subdomain
  const domain = parts.slice(-2).join(".");
  const subdomain = parts.slice(0, -2).join(".") || null;
  return { subdomain, domain };
}

function weightedRandom<T extends { conditions: any; destinationUrl: string }>(rules: T[]): T | null {
  const total = rules.reduce((sum, r) => sum + (Number(r.conditions?.weight) || 1), 0);
  let rand = Math.random() * total;
  for (const rule of rules) {
    rand -= Number(rule.conditions?.weight) || 1;
    if (rand <= 0) return rule;
  }
  return rules[rules.length - 1] ?? null;
}

function servePasswordPage(req: Parameters<Router["get"]>[1], res: Parameters<Router["get"]>[2], slug: string, error?: string): void {
  const errorHtml = error ? `<p style="color:#dc2626;font-size:14px;margin:0 0 12px">${error}</p>` : "";
  (res as any).status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protected Link</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:40px;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
h2{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:8px}
p.sub{font-size:14px;color:#64748b;margin-bottom:24px}
label{font-size:13px;font-weight:600;color:#334155;display:block;margin-bottom:6px}
input{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:15px;outline:none;transition:border-color .15s}
input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
button{margin-top:16px;width:100%;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:background .15s}
button:hover{background:#4f46e5}
.lock{font-size:40px;text-align:center;margin-bottom:20px}
</style>
</head>
<body>
<div class="card">
  <div class="lock">🔒</div>
  <h2>Password Required</h2>
  <p class="sub">This link is password protected. Enter the password to continue.</p>
  ${errorHtml}
  <form method="POST" action="/r/${slug}">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autofocus required placeholder="Enter password">
    <button type="submit">Unlock Link →</button>
  </form>
</div>
</body>
</html>`);
}

function serveGonePage(res: any, message: string, fallbackUrl?: string | null): void {
  if (fallbackUrl) {
    res.redirect(302, fallbackUrl);
    return;
  }
  res.status(410).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Link Unavailable</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.card{text-align:center;padding:40px;max-width:400px}h2{font-size:24px;font-weight:700;color:#0f172a;margin-bottom:12px}p{color:#64748b;font-size:15px}.emoji{font-size:48px;margin-bottom:20px}</style>
</head>
<body>
<div class="card">
<div class="emoji">🚫</div>
<h2>Link Unavailable</h2>
<p>${message}</p>
</div>
</body>
</html>`);
}

/* ── Custom Domain Routing ──────────────────────────────────────────────── */

router.use(async (req, res, next): Promise<void> => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const rawHost = (req.headers["x-forwarded-host"] as string | undefined) || (req.headers.host ?? "");
  const host = rawHost.split(":")[0].toLowerCase().trim();

  // Fast-exit for non-custom-domain hosts — no DB query needed
  if (
    !host || !host.includes(".") ||
    host.includes("localhost") || host.includes("127.0.0.1") ||
    host.includes(".replit.") || host.includes("replit.dev") ||
    host.includes("replit.app") || host.includes("snipr.sh")
  ) {
    return next();
  }

  const slug = req.path.slice(1).split("/")[0];
  if (!slug || slug.includes(".") || slug === "favicon" || slug === "robots") return next();

  // Extract subdomain and parent domain
  const { subdomain, domain: parentDomain } = extractSubdomainAndDomain(host);

  // Try exact domain match first (for single domain or exact subdomain match)
  let [domainRecord] = await db
    .select({ id: domainsTable.id, workspaceId: domainsTable.workspaceId })
    .from(domainsTable)
    .where(and(eq(domainsTable.domain, host), eq(domainsTable.verified, true)));

  // If no exact match and subdomain exists, try parent domain with wildcard support
  if (!domainRecord && subdomain) {
    [domainRecord] = await db
      .select({ id: domainsTable.id, workspaceId: domainsTable.workspaceId })
      .from(domainsTable)
      .where(and(
        eq(domainsTable.domain, parentDomain),
        eq(domainsTable.verified, true),
        eq(domainsTable.supportsSubdomains, true)
      ));
  }

  if (!domainRecord) return next();

  // Look up link by slug and domain
  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(
      eq(linksTable.slug, slug),
      eq(linksTable.workspaceId, domainRecord.workspaceId),
      eq(linksTable.domainId, domainRecord.id)
    ));

  if (!link || !link.enabled) {
    res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Not Found</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}.card{text-align:center;padding:40px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,.06)}h2{color:#0f172a;font-size:22px;margin-bottom:8px}p{color:#64748b;font-size:14px}</style></head><body><div class="card"><div style="font-size:48px;margin-bottom:16px">🔗</div><h2>Link not found</h2><p>This link does not exist or has been removed.</p></div></body></html>`);
    return;
  }

  setImmediate(() => { trackClick(req as any, link, false); });
  res.redirect(301, link.destinationUrl);
});

/* ── Standard Redirect ──────────────────────────────────────────────────── */

router.get("/r/:slug", async (req, res): Promise<void> => {
  const rawSlug = req.params.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  // Cache-first link lookup — skips DB round-trip for hot slugs
  const link = await getLinkBySlug(slug);

  if (!link) {
    res.status(404).send("Short link not found");
    return;
  }

  if (!link.enabled) {
    serveGonePage(res, "This link has been disabled.", link.fallbackUrl);
    return;
  }

  if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
    serveGonePage(res, "This link has expired.", link.fallbackUrl);
    return;
  }

  if (link.passwordHash) {
    const unlockedLinks = (req.session as any).unlockedLinks as Record<string, number> | undefined;
    const unlockedTime = unlockedLinks?.[link.id];

    // Check if link is unlocked and hasn't expired (30-minute window)
    const UNLOCK_DURATION_MS = 30 * 60 * 1000;
    const isExpired = !unlockedTime || (Date.now() - unlockedTime) > UNLOCK_DURATION_MS;

    if (isExpired) {
      servePasswordPage(req, res, slug);
      return;
    }
  }

  if (link.clickLimit !== null && link.clickLimit !== undefined) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(clickEventsTable)
      .where(eq(clickEventsTable.linkId, link.id));
    if (Number(value) >= link.clickLimit) {
      serveGonePage(res, "This link has reached its click limit.", link.fallbackUrl);
      return;
    }
  }

  const rules = await db
    .select()
    .from(linkRulesTable)
    .where(eq(linkRulesTable.linkId, link.id))
    .orderBy(linkRulesTable.priority);

  let destination = link.destinationUrl;

  if (rules.length > 0) {
    const ip = (req.headers["x-forwarded-for"] as string ?? req.ip ?? "").split(",")[0].trim();
    let userCountry: string | null = null;
    let userDevice = "desktop";
    try {
      const geoip = (await import("geoip-lite")).default;
      userCountry = geoip.lookup(ip)?.country ?? null;
    } catch {}
    try {
      const { UAParser } = await import("ua-parser-js");
      userDevice = new UAParser(req.headers["user-agent"]).getResult().device.type ?? "desktop";
    } catch {}

    const geoRules = rules.filter((r) => r.type === "geo");
    const deviceRules = rules.filter((r) => r.type === "device");
    const abRules = rules.filter((r) => r.type === "ab");
    const rotatorRules = rules.filter((r) => r.type === "rotator");

    let matched = false;

    for (const rule of geoRules) {
      const countries = (rule.conditions as any)?.countries as string[] | undefined;
      if (countries && userCountry && countries.map((c) => c.toUpperCase()).includes(userCountry.toUpperCase())) {
        destination = rule.destinationUrl;
        matched = true;
        break;
      }
    }

    if (!matched) {
      for (const rule of deviceRules) {
        const devices = (rule.conditions as any)?.devices as string[] | undefined;
        if (devices && devices.map((d) => d.toLowerCase()).includes(userDevice.toLowerCase())) {
          destination = rule.destinationUrl;
          matched = true;
          break;
        }
      }
    }

    if (!matched && abRules.length > 0) {
      const picked = weightedRandom(abRules);
      if (picked) { destination = picked.destinationUrl; matched = true; }
    }

    if (!matched && rotatorRules.length > 0) {
      const picked = rotatorRules[Math.floor(Math.random() * rotatorRules.length)];
      if (picked) { destination = picked.destinationUrl; }
    }
  }

  const isQr = req.query.qr === "1";

  // Fire click tracking asynchronously — never blocks the redirect
  setImmediate(() => { trackClick(req as any, link, isQr); });

  const pixels = await db
    .select()
    .from(pixelsTable)
    .where(eq(pixelsTable.workspaceId, link.workspaceId));

  if (pixels.length > 0) {
    res.send(buildPixelPage(pixels, destination));
    return;
  }

  res.redirect(301, destination);
});

router.post("/r/:slug", async (req, res): Promise<void> => {
  const rawSlug = req.params.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const link = await getLinkBySlug(slug);

  if (!link || !link.passwordHash) {
    res.redirect(302, `/r/${slug}`);
    return;
  }

  const { password } = req.body as { password?: string };

  if (!password) {
    servePasswordPage(req, res, slug, "Please enter a password.");
    return;
  }

  const valid = await bcrypt.compare(password, link.passwordHash);
  if (!valid) {
    servePasswordPage(req, res, slug, "Incorrect password. Please try again.");
    return;
  }

  // Store unlock timestamp for 30-minute expiration
  if (!(req.session as any).unlockedLinks) {
    (req.session as any).unlockedLinks = {};
  }
  (req.session as any).unlockedLinks[link.id] = Date.now();

  res.redirect(302, `/r/${slug}`);
});

export default router;
