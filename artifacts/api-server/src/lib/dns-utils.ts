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
    if (lc !== expectedLc && !lc.endsWith(".replit.app") && !lc.endsWith(".replit.dev")) {
      return "WRONG_TARGET";
    }
  }
  return null;
}

function isCnameOk(cname: string): boolean {
  const lc = cname.toLowerCase().replace(/\.$/, "");
  return lc === CNAME_TARGET.toLowerCase() || lc.endsWith(".replit.app") || lc.endsWith(".replit.dev");
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

export async function checkDomainDns(domainName: string, token: string): Promise<DnsCheckResult> {
  const parts = domainName.split(".");
  const isRootDomain = parts.length <= 2;
  const checkType: "cname" | "a-record" = isRootDomain ? "a-record" : "cname";
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
  const aRecordOk = checkType === "a-record" && resolverResults.some((r) => r.ok);
  const cnameTarget = checkType === "cname" ? (resolverResults.find((r) => r.found)?.found ?? null) : null;
  const aRecordIp = checkType === "a-record" ? (resolverResults.find((r) => r.found)?.found ?? null) : null;
  const ready = cnameOk || aRecordOk || txtOk;

  // ── Propagation percentage ──────────────────────────────────────────
  const okCount = resolverResults.filter((r) => r.ok).length;
  const propagation = Math.round((okCount / RESOLVERS.length) * 100);

  // ── Diagnosis ──────────────────────────────────────────────────────
  const { diagnosis, suggestions } = buildDiagnosis(resolverResults, checkType);

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
