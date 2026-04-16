import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, linksTable, linkRulesTable, pixelsTable, clickEventsTable, domainsTable } from "@workspace/db";
import { getLinkBySlug } from "../lib/link-cache";
import { trackClick } from "../lib/click-tracker";
import { buildPixelPage } from "../lib/pixels";
import { isBot } from "../lib/bot-detector";

const router: IRouter = Router();

/* ── In-memory domain cache (5 min TTL) ─────────────────────────────────── */
const _domainCache = new Map<string, { id: string; workspaceId: string; ts: number } | null>();
const DOMAIN_CACHE_TTL = 5 * 60 * 1000;

async function lookupDomainCached(host: string, subdomain: string | null, parentDomain: string): Promise<{ id: string; workspaceId: string } | null> {
  const now = Date.now();
  const cached = _domainCache.get(host);
  if (cached !== undefined && now - (cached?.ts ?? 0) < DOMAIN_CACHE_TTL) {
    return cached ? { id: cached.id, workspaceId: cached.workspaceId } : null;
  }
  let [rec] = await db
    .select({ id: domainsTable.id, workspaceId: domainsTable.workspaceId })
    .from(domainsTable)
    .where(and(eq(domainsTable.domain, host), eq(domainsTable.verified, true)));
  if (!rec && subdomain) {
    [rec] = await db
      .select({ id: domainsTable.id, workspaceId: domainsTable.workspaceId })
      .from(domainsTable)
      .where(and(eq(domainsTable.domain, parentDomain), eq(domainsTable.verified, true), eq(domainsTable.supportsSubdomains, true)));
  }
  const result = rec ? { id: rec.id, workspaceId: rec.workspaceId, ts: now } : null;
  _domainCache.set(host, result);
  return rec ? { id: rec.id, workspaceId: rec.workspaceId } : null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/<\//g, "<\\/");
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    // Strict fallback — only allow http/https prefixes
    return url.startsWith("http://") || url.startsWith("https://");
  }
}

/** Check if a deep link URL is safe — allows custom app schemes (myapp://) but blocks dangerous ones */
function isSafeDeepLink(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const dangerous = /^(javascript|data|vbscript|file):/i;
  if (dangerous.test(url)) return false;
  // Must contain :// to be a valid deep link scheme
  return url.includes("://");
}

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

/** Forward marketing tracking params from the short-link URL onto the destination URL.
 *  Only the standard Google/Meta analytics params are copied. The destination URL's
 *  own params always win — we never overwrite values the user already baked in. */
const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "fbclid", "ttclid", "msclkid",
] as const;

function mergeUtmIntoUrl(destination: string, sourceQuery: Record<string, any>): string {
  try {
    const url = new URL(destination);
    for (const key of TRACKING_PARAMS) {
      const raw = sourceQuery[key];
      // Handle array query (?a=1&a=2) by picking the first non-empty value
      const val = Array.isArray(raw) ? raw.find((v) => typeof v === "string" && v.length > 0) : raw;
      if (typeof val !== "string" || val.length === 0) continue;
      if (url.searchParams.has(key)) continue; // destination's own value wins
      url.searchParams.set(key, val);
    }
    return url.toString();
  } catch {
    return destination;
  }
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

function servePasswordPage(req: Parameters<Router["get"]>[1], res: Parameters<Router["get"]>[2], slug: string, error?: string, isCustomDomain?: boolean): void {
  const errorHtml = error ? `<p style="color:#dc2626;font-size:14px;margin:0 0 12px">${error}</p>` : "";
  const formAction = isCustomDomain ? `/${escapeHtml(slug)}` : `/r/${escapeHtml(slug)}`;
  (res as any).status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protected Link</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
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
  <form method="POST" action="${formAction}">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autofocus required placeholder="Enter password">
    <button type="submit">Unlock Link →</button>
  </form>
</div>
</body>
</html>`);
}

function serveDeepLinkPage(res: any, destination: string, iosDeepLink: string | null, androidDeepLink: string | null): void {
  const safeDest = escapeJsString(destination);
  const iosBlock = iosDeepLink && isSafeDeepLink(iosDeepLink)
    ? `if(/iPhone|iPad|iPod/i.test(ua)){window.location.href="${escapeJsString(iosDeepLink)}";setTimeout(function(){window.location.href="${safeDest}"},1500);return;}`
    : "";
  const androidBlock = androidDeepLink && isSafeDeepLink(androidDeepLink)
    ? `if(/Android/i.test(ua)){window.location.href="${escapeJsString(androidDeepLink)}";setTimeout(function(){window.location.href="${safeDest}"},1500);return;}`
    : "";
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.loader{text-align:center;color:#64748b;font-size:14px}
.spinner{width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="loader"><div class="spinner"></div>Opening app...</div>
<script>
(function(){
var ua=navigator.userAgent||"";
${iosBlock}
${androidBlock}
window.location.href="${safeDest}";
})();
</script>
</body>
</html>`);
}

function serveCloakedPage(res: any, destination: string): void {
  const safeDest = escapeHtml(destination);
  const safeDestJs = escapeJsString(destination);
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden}
iframe{display:block;width:100%;height:100%;border:none}
#loader{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;z-index:10}
.spin{width:28px;height:28px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:r .7s linear infinite;margin-bottom:12px}
@keyframes r{to{transform:rotate(360deg)}}
.msg{color:#94a3b8;font-size:13px;text-align:center}
</style>
</head>
<body>
<div id="loader"><div><div class="spin"></div><div class="msg">Loading…</div></div></div>
<iframe id="cf" src="${safeDest}" allow="fullscreen; payment" referrerpolicy="no-referrer" style="visibility:hidden"></iframe>
<script>
(function(){
  var f=document.getElementById("cf"),l=document.getElementById("loader");
  var t=setTimeout(function(){window.location.replace("${safeDestJs}");},8000);
  f.onload=function(){
    clearTimeout(t);
    try{var d=f.contentDocument||f.contentWindow.document;if(d&&d.body){f.style.visibility="visible";l.style.display="none";}}
    catch(e){f.style.visibility="visible";l.style.display="none";}
  };
  f.onerror=function(){clearTimeout(t);window.location.replace("${safeDestJs}");};
})();
</script>
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
<p>${escapeHtml(message)}</p>
</div>
</body>
</html>`);
}

/* ── Branded Landing Page for Custom Domains ───────────────────────────── */

function getCustomDomainLandingPage(domain: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(domain)} — Branded Short Domain</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔗</text></svg>">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;color:#0a0a0a}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:48px 40px;width:100%;max-width:480px;margin:24px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.04)}
.icon-wrap{width:72px;height:72px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
.icon-wrap svg{width:32px;height:32px;color:#10b981}
.badge{display:inline-flex;align-items:center;gap:6px;background:#ecfdf5;color:#059669;font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;margin-bottom:20px;letter-spacing:.5px}
.badge::before{content:'';width:6px;height:6px;background:#10b981;border-radius:50%}
h1{font-size:24px;font-weight:800;color:#0a0a0a;margin-bottom:24px;letter-spacing:-.5px}
h1::after{content:'';display:block;width:40px;height:3px;background:#e5e7eb;border-radius:2px;margin:16px auto 0}
.domain{font-weight:700;color:#0a0a0a}
.desc{font-size:14px;color:#6b7280;line-height:1.7;margin-bottom:8px}
.back-link{font-size:13px;color:#9ca3af}
.back-link a{color:#6b7280;text-decoration:underline;text-underline-offset:2px}
.back-link a:hover{color:#0a0a0a}
.divider{width:100%;height:1px;background:#f3f4f6;margin:28px 0}
.cta-text{font-size:15px;font-weight:600;color:#0a0a0a;margin-bottom:16px}
.btn{display:inline-flex;align-items:center;gap:8px;background:#0a0a0a;color:#fff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;transition:background .15s,transform .1s;letter-spacing:.3px}
.btn:hover{background:#1f1f1f;transform:translateY(-1px)}
.btn:active{transform:scale(.98)}
.footer{margin-top:32px;font-size:11px;color:#d1d5db;max-width:360px;line-height:1.6}
.powered{margin-top:16px;font-size:11px;color:#d1d5db}
.powered a{color:#9ca3af;text-decoration:none;font-weight:600}
.powered a:hover{color:#0a0a0a}
</style>
</head>
<body>
<div class="card">
  <div class="icon-wrap">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  </div>
  <div class="badge">ACTIVE</div>
  <h1>Branded Short Domain</h1>
  <p class="desc"><span class="domain">${escapeHtml(domain)}</span> is configured for link redirection.</p>
  <p class="back-link">If you arrived here by mistake, you can <a href="javascript:history.back()">go back</a>.</p>
  <div class="divider"></div>
  <p class="cta-text">Create your own branded short links</p>
  <a href="https://snipr.sh/signup" class="btn">GET STARTED</a>
</div>
<p class="footer">Domain owners can set up redirects for their main domain in Domain Settings for free</p>
<p class="powered">Powered by <a href="https://snipr.sh">Snipr</a></p>
</body>
</html>`;
}

function getCustomDomain404Page(domain: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link Not Found — ${escapeHtml(domain)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:48px 40px;width:100%;max-width:440px;margin:24px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.04)}
.icon-wrap{width:64px;height:64px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
.icon-wrap svg{width:28px;height:28px;color:#ef4444}
h1{font-size:22px;font-weight:800;color:#0a0a0a;margin-bottom:8px}
p{font-size:14px;color:#6b7280;line-height:1.6}
.back{margin-top:20px}
.back a{color:#6b7280;font-size:13px;text-decoration:underline;text-underline-offset:2px}
.back a:hover{color:#0a0a0a}
.powered{margin-top:24px;font-size:11px;color:#d1d5db}
.powered a{color:#9ca3af;text-decoration:none;font-weight:600}
.powered a:hover{color:#0a0a0a}
</style>
</head>
<body>
<div class="card">
  <div class="icon-wrap">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  </div>
  <h1>Link Not Found</h1>
  <p>This short link does not exist or has been removed from <strong>${escapeHtml(domain)}</strong>.</p>
  <p class="back"><a href="javascript:history.back()">Go back</a></p>
</div>
<p class="powered">Powered by <a href="https://snipr.sh">Snipr</a></p>
</body>
</html>`;
}

/* ── Custom Domain Routing ──────────────────────────────────────────────── */

router.use(async (req, res, next): Promise<void> => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") return next();

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

  // Skip system files but NOT empty slugs (we handle root path for custom domains)
  if (slug && (slug.includes(".") || slug === "favicon" || slug === "robots")) return next();

  // Extract subdomain and parent domain
  const { subdomain, domain: parentDomain } = extractSubdomainAndDomain(host);

  // Cached domain lookup — avoids DB hit on every request for the same domain
  const domainRecord = await lookupDomainCached(host, subdomain, parentDomain);
  if (!domainRecord) return next();

  // If no slug (root path "/"), serve branded landing page
  if (!slug) {
    res.status(200).send(getCustomDomainLandingPage(host));
    return;
  }

  // Look up link by slug and domain using the new (slug, domain_id) index
  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(
      eq(linksTable.slug, slug),
      eq(linksTable.domainId, domainRecord.id)
    ));

  if (!link || !link.enabled) {
    res.status(404).send(getCustomDomain404Page(host));
    return;
  }

  // Check link expiry
  if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
    if (link.fallbackUrl) {
      res.redirect(302, link.fallbackUrl);
    } else {
      serveGonePage(res, "This link has expired.", null);
    }
    return;
  }

  // Handle POST for password unlock on custom domains
  if (req.method === "POST" && link.passwordHash) {
    const { password } = ((req.body ?? {}) as { password?: string });
    if (!password) {
      servePasswordPage(req, res, slug, "Please enter a password.", true);
      return;
    }
    const valid = await bcrypt.compare(password, link.passwordHash);
    if (!valid) {
      servePasswordPage(req, res, slug, "Incorrect password. Please try again.", true);
      return;
    }
    if (!(req.session as any).unlockedLinks) {
      (req.session as any).unlockedLinks = {};
    }
    (req.session as any).unlockedLinks[link.id] = Date.now();
    // Save session before redirect so unlock persists
    req.session.save(() => {
      res.redirect(302, `/${slug}`);
    });
    return;
  }

  // Check password protection (custom domain — form posts to /:slug)
  if (link.passwordHash) {
    const unlockedLinks = (req.session as any).unlockedLinks as Record<string, number> | undefined;
    const unlockedTime = unlockedLinks?.[link.id];
    const UNLOCK_DURATION_MS = 30 * 60 * 1000;
    const isExpired = !unlockedTime || (Date.now() - unlockedTime) > UNLOCK_DURATION_MS;
    if (isExpired) {
      servePasswordPage(req, res, slug, undefined, true);
      return;
    }
  }

  // Check click limit
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

  // Compute bot check once — reused for tracking + redirect decision
  const bot = isBot(req as any);
  if (!bot) {
    setImmediate(() => { trackClick(req as any, link, req.query.qr === "1"); });
  }

  // Forward marketing params from the short-link URL to the destination (opt-in per link).
  const finalDestination = (link as any).propagateUtm
    ? mergeUtmIntoUrl(link.destinationUrl, req.query as Record<string, any>)
    : link.destinationUrl;

  if (link.iosDeepLink || link.androidDeepLink) {
    serveDeepLinkPage(res, finalDestination, link.iosDeepLink, link.androidDeepLink);
    return;
  }

  if (link.isCloaked) {
    serveCloakedPage(res, finalDestination);
    return;
  }

  if (link.hideReferrer) {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url=${escapeHtml(finalDestination)}"><title>Redirecting...</title></head><body></body></html>`);
    return;
  }

  // Bots/crawlers get a clean 301 for SEO link juice
  if (bot) {
    res.redirect(301, finalDestination);
    return;
  }
  // Real browsers get an instant HTML redirect — never cached by browser
  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(finalDestination)}"><script>window.location.replace("${escapeJsString(finalDestination)}")</script><title>Redirecting…</title></head><body></body></html>`);
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
    let userCity: string | null = null;
    let userRegion: string | null = null;
    let userDevice = "desktop";
    try {
      const geoip = (await import("geoip-lite")).default;
      const geo = geoip.lookup(ip);
      userCountry = geo?.country ?? null;
      userCity = geo?.city ?? null;
      userRegion = geo?.region ?? null;
    } catch {}
    try {
      const { UAParser } = await import("ua-parser-js");
      userDevice = new UAParser(req.headers["user-agent"]).getResult().device.type ?? "desktop";
    } catch {}

    const geoRules = rules.filter((r) => r.type === "geo");
    const cityRules = rules.filter((r) => r.type === "city");
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
      for (const rule of cityRules) {
        const cond = rule.conditions as any;
        const cities = (cond?.cities as string[] | undefined)?.map((c: string) => c.toLowerCase());
        const regions = (cond?.regions as string[] | undefined)?.map((r: string) => r.toLowerCase());
        if (cities && userCity && cities.includes(userCity.toLowerCase())) {
          destination = rule.destinationUrl;
          matched = true;
          break;
        }
        if (regions && userRegion && regions.includes(userRegion.toLowerCase())) {
          destination = rule.destinationUrl;
          matched = true;
          break;
        }
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
  const bot = isBot(req as any);

  // Fire click tracking asynchronously — skip bots
  if (!bot) {
    setImmediate(() => { trackClick(req as any, link, isQr); });
  }

  // Forward marketing params from the short-link URL to the destination (opt-in per link).
  if ((link as any).propagateUtm) {
    destination = mergeUtmIntoUrl(destination, req.query as Record<string, any>);
  }

  const pixels = await db
    .select()
    .from(pixelsTable)
    .where(eq(pixelsTable.workspaceId, link.workspaceId));

  if (pixels.length > 0) {
    res.send(buildPixelPage(pixels, destination));
    return;
  }

  if (link.iosDeepLink || link.androidDeepLink) {
    serveDeepLinkPage(res, destination, link.iosDeepLink, link.androidDeepLink);
    return;
  }

  if (link.isCloaked) {
    serveCloakedPage(res, destination);
    return;
  }

  if (link.hideReferrer) {
    res.setHeader("Referrer-Policy", "no-referrer");
    res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}"><title>Redirecting...</title></head><body></body></html>`);
    return;
  }

  // Bots/crawlers get a clean 301 for SEO link juice
  if (bot) {
    res.redirect(301, destination);
    return;
  }
  // Real browsers get an instant HTML redirect — never cached by browser
  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}"><script>window.location.replace("${escapeJsString(destination)}")</script><title>Redirecting…</title></head><body></body></html>`);
});

router.post("/r/:slug", async (req, res): Promise<void> => {
  const rawSlug = req.params.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const link = await getLinkBySlug(slug);

  if (!link || !link.passwordHash) {
    res.redirect(302, `/r/${slug}`);
    return;
  }

  const { password } = ((req.body ?? {}) as { password?: string });

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

  // Save session before redirect so unlock persists
  req.session.save(() => {
    res.redirect(302, `/r/${slug}`);
  });
});

export default router;
