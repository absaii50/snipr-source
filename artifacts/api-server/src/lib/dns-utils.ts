import { createHash } from "crypto";
import dns from "dns/promises";

// Your server IP - update this to match your production server
const SERVER_IP = process.env.SERVER_IP || "104.218.51.234";

export interface DnsCheckResult {
  cnameOk: boolean;
  cnameTarget: string | null;
  aRecordOk: boolean;
  aRecordIp: string | null;
  txtOk: boolean;
  txtFound: string | null;
  ready: boolean;
}

export function getDomainVerifyToken(domainId: string): string {
  return "sniprverify-" + createHash("sha256").update(domainId + "snipr-dns-verify-2025").digest("hex").slice(0, 16);
}

export async function checkDomainDns(domainName: string, token: string): Promise<DnsCheckResult> {
  let cnameOk = false;
  let txtOk = false;
  let aRecordOk = false;
  let cnameTarget: string | null = null;
  let txtFound: string | null = null;
  let aRecordIp: string | null = null;

  // Check CNAME record (for subdomains like go.example.com)
  try {
    const cnames = await dns.resolveCname(domainName);
    cnameTarget = cnames[0] ?? null;
    cnameOk = cnames.some((c) => c.toLowerCase().includes("snipr.sh") || c.toLowerCase().includes("replit"));
  } catch {}

  // Check A record (for root domains like example.com)
  if (!cnameOk) {
    try {
      const addresses = await dns.resolve4(domainName);
      aRecordIp = addresses[0] ?? null;
      aRecordOk = addresses.includes(SERVER_IP);
    } catch {}
  }

  // Check TXT verification record
  try {
    const txts = await dns.resolveTxt(`_snipr-verify.${domainName}`);
    txtFound = txts.flat()[0] ?? null;
    txtOk = txts.flat().includes(token);
  } catch {}

  return {
    cnameOk,
    cnameTarget,
    aRecordOk,
    aRecordIp,
    txtOk,
    txtFound,
    ready: cnameOk || aRecordOk || txtOk,
  };
}
