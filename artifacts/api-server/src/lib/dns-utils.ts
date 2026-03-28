import { createHash } from "crypto";
import dns from "dns/promises";

export interface DnsCheckResult {
  cnameOk: boolean;
  cnameTarget: string | null;
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
  let cnameTarget: string | null = null;
  let txtFound: string | null = null;

  try {
    const cnames = await dns.resolveCname(domainName);
    cnameTarget = cnames[0] ?? null;
    cnameOk = cnames.some((c) => c.toLowerCase().includes("snipr.sh") || c.toLowerCase().includes("replit"));
  } catch {}

  try {
    const txts = await dns.resolveTxt(`_snipr-verify.${domainName}`);
    txtFound = txts.flat()[0] ?? null;
    txtOk = txts.flat().includes(token);
  } catch {}

  return { cnameOk, cnameTarget, txtOk, txtFound, ready: cnameOk || txtOk };
}
