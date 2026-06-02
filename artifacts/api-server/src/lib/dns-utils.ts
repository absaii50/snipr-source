import { createHash } from "crypto";
import dns from "dns/promises";

const SERVER_IP = process.env.SERVER_IP || "163.245.216.153";

export const CNAME_TARGET = process.env.CNAME_TARGET || "snipr.sh";

// The public resolvers we check propagation against
const RESOLVERS = [
  { name: "Google",    ip: "8.8.8.8",        flag: "🇺🇸" },
  { name: "Cloudflare",ip: "1.1.1.1",        flag: "🟠" },
  { name: "OpenDNS",   ip: "208.67.222.222", flag: "🔵" },
  { name: "Quad9",     ip: "9.9.9.9",        flag: "🟣" },
];

export interface ResolverResult {
  name: string;
  ip: string;
  flag: string;
  ok: boolean;
  found: string | null;
  error: "NXDOMAIN" | "TIMEOUT" | "SERVFAIL" | "WRONG_TARGET" | null;
  ttl: number | null;
}

export interface DnsCheckResult {
  // Legacy fields (backwards compat)
  cnameOk: boolean;
  cnameTarget: string | null;
  aRecordOk: boolean;
  aRecordIp: string | null;
  txtOk: boolean;
  txtFound: string | null;
  ready: boolean;
  // Enhanced fields
  checkType: "cname" | "a-record";
  expectedTarget: string;
  propagation: number;               // 0-100 percentage
  resolvers: ResolverResult[];
  txtResolvers: Pick<ResolverResult, "name" | "ip" | "flag" | "ok" | "found">[];
  diagnosis: string | null;          // human-readable root cause
  suggestions: string[];             // actionable fix steps
  checkedAt: string;                 // ISO timestamp
}

export function getDomainVerifyToken(domainId: string): string {
  return "sniprverify-" + createHash("sha256").update(domainId + "snipr-dns-verify-2025").digest("hex").slice(0, 16);
}

/** Recognized DNS providers and the URL pattern for their console. The
 *  matcher is fuzzy: we just check if any NS record contains the keyword.
 *  When we identify a provider the wizard shows a one-click "Open <provider>
 *  DNS console" button instead of generic instructions. */
const PROVIDERS: Array<{
  id: string;
  label: string;
  match: RegExp;
  consoleUrl: (rootDomain: string) => string;
  /** Short, registrar-accurate menu path the user needs to follow. */
  steps: string[];
}> = [
  { id: "cloudflare",   label: "Cloudflare",     match: /\.cloudflare\.com$|\.ns\.cloudflare\.com$/i,
    consoleUrl: (d) => `https://dash.cloudflare.com/?to=/:account/${d}/dns/records`,
    steps: ["Click DNS → Records → Add record", "Type: A · Name: paste below · IPv4 address: paste below", "Proxy status: DNS only (gray cloud) — switch to proxied AFTER SSL is active"],
  },
  { id: "godaddy",      label: "GoDaddy",        match: /\.domaincontrol\.com$/i,
    consoleUrl: (d) => `https://dcc.godaddy.com/domains/${d}/dns`,
    steps: ["Click DNS → Manage Zones → Add record", "Type: A · Name: paste below · Value: paste below · TTL: 1 hour"],
  },
  { id: "namecheap",    label: "Namecheap",      match: /\.registrar-servers\.com$|\.namecheap\.com$/i,
    consoleUrl: (d) => `https://ap.www.namecheap.com/domains/domaincontrolpanel/${d}/advancedns`,
    steps: ["Advanced DNS → Add New Record", "Type: A Record · Host: paste below · Value: paste below · TTL: Automatic"],
  },
  { id: "route53",      label: "AWS Route 53",   match: /\.awsdns-/i,
    consoleUrl: (d) => `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones?#ListRecordSets`,
    steps: ["Open the Hosted Zone for your domain → Create record", "Record type: A · Record name: paste below · Value: paste below"],
  },
  { id: "google",       label: "Google Domains", match: /\.googledomains\.com$|\.ns-google\.com$/i,
    consoleUrl: (d) => `https://domains.google.com/registrar/${d}/dns`,
    steps: ["DNS → Custom records → Add a new record", "Type: A · Host name: paste below · Data: paste below"],
  },
  { id: "vercel",       label: "Vercel",         match: /\.vercel-dns\.com$/i,
    consoleUrl: (d) => `https://vercel.com/dashboard/domains/${d}`,
    steps: ["Domain settings → DNS Records → Add", "Type: A · Name: paste below · Value: paste below"],
  },
  { id: "digitalocean", label: "DigitalOcean",   match: /\.digitalocean\.com$/i,
    consoleUrl: (d) => `https://cloud.digitalocean.com/networking/domains/${d}`,
    steps: ["Add record → A", "Hostname: paste below · Will direct to: paste below"],
  },
  { id: "squarespace",  label: "Squarespace",    match: /\.squarespacedns\.com$/i,
    consoleUrl: (_d) => `https://account.squarespace.com/domains`,
    steps: ["Open your domain → DNS Settings → Custom Records → Add a record", "Type: A · Host: paste below · Data: paste below"],
  },
  { id: "shopify",      label: "Shopify",        match: /\.shopifydns\.com$/i,
    consoleUrl: (_d) => `https://admin.shopify.com/settings/domains`,
    steps: ["Settings → Domains → click your domain → DNS settings → Add custom record", "Type: A · Name: paste below · Points to: paste below"],
  },
];

export interface DnsProviderHint {
  id: string;
  label: string;
  nameservers: string[];
  consoleUrl: string;
  steps: string[];
}

/** Look up the domain's NS records and match against the known providers.
 *  Returns null if we can't identify the provider — falls back to the
 *  generic "Add an A record at your DNS provider" copy in the wizard. */
export async function detectDnsProvider(domainName: string): Promise<DnsProviderHint | null> {
  // NS records live on the registered (apex) domain. For "links.example.com"
  // we want NS for "example.com". Strip subdomain prefixes.
  const parts = domainName.split(".");
  const root = parts.length > 2 ? parts.slice(-2).join(".") : domainName;

  try {
    const resolver = new dns.Resolver({ timeout: 3000 });
    resolver.setServers(["1.1.1.1", "8.8.8.8"]);
    const ns = await resolver.resolveNs(root);
    if (ns.length === 0) return null;

    for (const p of PROVIDERS) {
      if (ns.some((n) => p.match.test(n))) {
        return {
          id: p.id,
          label: p.label,
          nameservers: ns,
          consoleUrl: p.consoleUrl(root),
          steps: p.steps,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

const RESOLVER_TIMEOUT_MS = 4000;

async function resolveWithServer(
  serverIp: string,
  domainName: string,
  rrtype: "CNAME" | "A" | "TXT",
): Promise<{ records: string[][]; ttl: number | null }> {
  const resolver = new dns.Resolver({ timeout: RESOLVER_TIMEOUT_MS });
  resolver.setServers([serverIp]);

  const query = async (): Promise<{ records: string[][]; ttl: number | null }> => {
    if (rrtype === "CNAME") {
      const cnames = await resolver.resolveCname(domainName);
      return { records: cnames.map((c) => [c]), ttl: null };
    }
    if (rrtype === "A") {
      const addresses = await resolver.resolve4(domainName, { ttl: true }) as { address: string; ttl: number }[];
      return { records: addresses.map((a) => [a.address]), ttl: addresses[0]?.ttl ?? null };
    }
    if (rrtype === "TXT") {
      const txts = await resolver.resolveTxt(domainName);
      return { records: txts, ttl: null };
    }
    return { records: [], ttl: null };
  };

  const timeout = new Promise<{ records: string[][]; ttl: number | null }>((resolve) =>
    setTimeout(() => resolve({ records: [], ttl: null }), RESOLVER_TIMEOUT_MS + 500),
  );

  try {
    return await Promise.race([query(), timeout]);
  } catch {
    return { records: [], ttl: null };
  }
}

function classifyError(found: string | null, expected: string, rrtype: string): ResolverResult["error"] {
  if (found === null) return "NXDOMAIN";
  if (rrtype === "CNAME" || rrtype === "A") {
    const lc = found.toLowerCase().replace(/\.$/, "");
    const expectedLc = expected.toLowerCase();
    if (lc !== expectedLc) {
      return "WRONG_TARGET";
    }
  }
  return null;
}

function isCnameOk(cname: string): boolean {
  const lc = cname.toLowerCase().replace(/\.$/, "");
  return lc === CNAME_TARGET.toLowerCase();
}

function buildDiagnosis(resolvers: ResolverResult[], checkType: "cname" | "a-record"): { diagnosis: string | null; suggestions: string[] } {
  const allNotFound = resolvers.every((r) => r.error === "NXDOMAIN");
  const someOk = resolvers.some((r) => r.ok);
  const allOk = resolvers.every((r) => r.ok);
  const wrongTarget = resolvers.filter((r) => r.error === "WRONG_TARGET");

  if (allOk) return { diagnosis: null, suggestions: [] };

  if (allNotFound) {
    return {
      diagnosis: "No DNS record found yet on any resolver.",
      suggestions: [
        checkType === "cname"
          ? "Make sure you added a CNAME record — not an A record — for the exact hostname shown."
          : "Make sure you added an A record pointing to the correct IP address.",
        "Double-check the Name/Host field matches exactly (copy-paste from above).",
        "DNS changes can take 5–30 minutes. Wait a moment and re-check.",
        "Some registrars have a 'Save' or 'Publish' step — make sure you confirmed the change.",
      ],
    };
  }

  if (wrongTarget.length > 0) {
    const found = wrongTarget[0].found!;
    return {
      diagnosis: `Record found but pointing to wrong target: ${found}`,
      suggestions: [
        `Update the ${checkType === "cname" ? "CNAME value" : "A record IP"} to exactly: ${checkType === "cname" ? CNAME_TARGET : SERVER_IP}`,
        "Delete the existing record first, then re-add it with the correct value.",
        "Make sure no other conflicting records exist (e.g. old A records).",
      ],
    };
  }

  if (someOk && !allOk) {
    const okCount = resolvers.filter((r) => r.ok).length;
    return {
      diagnosis: `Propagating — ${okCount}/${resolvers.length} resolvers see the record so far.`,
      suggestions: [
        "DNS is spreading across the internet — this is normal and usually completes within 30 minutes.",
        "You can click Verify & Activate once all resolvers show green.",
      ],
    };
  }

  return { diagnosis: "DNS records found but not yet valid.", suggestions: [] };
}

/**
 * HTTP probe: detect Cloudflare-proxied (or other CDN-proxied) domains.
 * Makes a lightweight HEAD request to the domain and checks if our redirect
 * server is behind it by looking for the X-Powered-By: Express header and
 * the server responding on the expected port.
 */
async function httpProbeOk(domainName: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Try HTTPS first (most CDN proxies terminate SSL)
    const res = await fetch(`https://${domainName}/__snipr_healthcheck`, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "SniprDNSCheck/1.0" },
    });
    clearTimeout(timeout);
    // Our redirect server returns X-Powered-By: Express on all routes
    const poweredBy = res.headers.get("x-powered-by") || "";
    // Accept: the domain reaches an Express server (our redirect app)
    if (poweredBy.toLowerCase().includes("express")) return true;
    // Fallback: check via HTTP if HTTPS failed
    return false;
  } catch {
    // Try HTTP as fallback
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5000);
      const res2 = await fetch(`http://${domainName}/__snipr_healthcheck`, {
        method: "HEAD",
        redirect: "manual",
        signal: controller2.signal,
        headers: { "User-Agent": "SniprDNSCheck/1.0" },
      });
      clearTimeout(timeout2);
      const poweredBy2 = res2.headers.get("x-powered-by") || "";
      return poweredBy2.toLowerCase().includes("express");
    } catch {
      return false;
    }
  }
}

export async function checkDomainDns(domainName: string, token: string): Promise<DnsCheckResult> {
  // Always check A record — all custom domains (root + subdomain) use A record pointing to SERVER_IP
  const checkType: "cname" | "a-record" = "a-record";
  const txtName = `_snipr-verify.${domainName}`;

  // ── Run all resolver queries in parallel (primary + TXT) ───────────
  const [resolverResults, rawTxtResults] = await Promise.all([
    // Primary record check (CNAME or A) across all resolvers
    Promise.all(
      RESOLVERS.map(async (r): Promise<ResolverResult> => {
        if (checkType === "cname") {
          const { records } = await resolveWithServer(r.ip, domainName, "CNAME");
          const found = records[0]?.[0]?.replace(/\.$/, "") ?? null;
          const ok = found ? isCnameOk(found) : false;
          const error = ok ? null : classifyError(found, CNAME_TARGET, "CNAME");
          return { ...r, ok, found, error, ttl: null };
        } else {
          const { records, ttl } = await resolveWithServer(r.ip, domainName, "A");
          const found = records[0]?.[0] ?? null;
          const ok = found === SERVER_IP;
          const error = ok ? null : classifyError(found, SERVER_IP, "A");
          return { ...r, ok, found, error, ttl };
        }
      }),
    ),
    // TXT verification across first 2 resolvers
    Promise.all(
      RESOLVERS.slice(0, 2).map(async (r) => {
        const { records } = await resolveWithServer(r.ip, txtName, "TXT");
        const flat = records.flat();
        const found = flat[0] ?? null;
        const ok = flat.includes(token);
        return { name: r.name, ip: r.ip, flag: r.flag, ok, found };
      }),
    ),
  ]);

  let txtOk = false;
  let txtFound: string | null = null;
  const txtResolverResults = rawTxtResults.map((r) => {
    if (r.ok) { txtOk = true; txtFound = r.found; }
    if (!txtFound && r.found) txtFound = r.found;
    return r;
  });

  // ── Compute legacy fields ───────────────────────────────────────────
  const cnameOk = checkType === "cname" && resolverResults.some((r) => r.ok);
  let aRecordOk = checkType === "a-record" && resolverResults.some((r) => r.ok);
  const cnameTarget = checkType === "cname" ? (resolverResults.find((r) => r.found)?.found ?? null) : null;
  const aRecordIp = checkType === "a-record" ? (resolverResults.find((r) => r.found)?.found ?? null) : null;

  // ── HTTP probe for CDN-proxied domains (Cloudflare, etc.) ─────────
  // If A record shows an IP but it doesn't match our SERVER_IP, the domain
  // might be behind Cloudflare proxy. Do an HTTP probe to confirm our server
  // is actually reachable behind the proxy.
  let proxyDetected = false;
  if (!aRecordOk && !cnameOk && !txtOk && aRecordIp) {
    const probeResult = await httpProbeOk(domainName);
    if (probeResult) {
      aRecordOk = true;
      proxyDetected = true;
      // Mark all resolvers that found an IP as "ok" (they're proxied but working)
      resolverResults.forEach((r) => {
        if (r.found && !r.ok) { r.ok = true; r.error = null; }
      });
    }
  }

  const ready = cnameOk || aRecordOk || txtOk;

  // ── Propagation percentage ──────────────────────────────────────────
  const okCount = resolverResults.filter((r) => r.ok).length;
  const propagation = Math.round((okCount / RESOLVERS.length) * 100);

  // ── Diagnosis ──────────────────────────────────────────────────────
  let { diagnosis, suggestions } = buildDiagnosis(resolverResults, checkType);
  if (proxyDetected) {
    diagnosis = "Domain is behind a CDN/proxy (e.g. Cloudflare) — verified via HTTP probe.";
    suggestions = [];
  }

  return {
    cnameOk,
    cnameTarget,
    aRecordOk,
    aRecordIp,
    txtOk,
    txtFound,
    ready,
    checkType,
    expectedTarget: checkType === "cname" ? CNAME_TARGET : SERVER_IP,
    propagation,
    resolvers: resolverResults,
    txtResolvers: txtResolverResults,
    diagnosis,
    suggestions,
    checkedAt: new Date().toISOString(),
  };
}
