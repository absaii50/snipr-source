"use client";
import { useEffect, useState } from "react";
import {
  Search, CheckCircle2, Clock, Trash2, RefreshCw, Globe, AlertCircle,
  ChevronDown, ChevronRight, Copy, CheckCircle, Loader2, ShieldCheck, ShieldOff,
  Wifi, WifiOff, Plus, X,
} from "lucide-react";
import { apiFetch, fmtDate } from "../utils";
import DomainSetupWizard from "@/components/DomainSetupWizard";

interface AdminDomain {
  id: string;
  domain: string;
  verified: boolean;
  isParentDomain: boolean;
  supportsSubdomains: boolean;
  isPlatformDomain: boolean;
  createdAt: string;
  workspaceId: string;
  workspaceName: string;
  ownerName: string;
  ownerEmail: string;
  verificationToken: string;
}

interface WorkspaceOption {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
}

interface DnsCheckResult {
  domain: string;
  verified: boolean;
  token: string;
  cnameOk: boolean;
  cnameTarget: string | null;
  txtOk: boolean;
  txtFound: string | null;
  ready: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="ml-1 text-[#8888A0] hover:text-[#4A7A94] transition-colors" title="Copy">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function DnsInstructions({ domain, token }: { domain: string; token: string }) {
  const [tab, setTab] = useState<"cname" | "txt">("cname");
  const subdomain = domain.split(".").slice(0, -2).join(".") || "@";
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-[#6666A0] leading-relaxed">
        To verify this domain, the user must add one of these DNS records at their registrar:
      </p>
      <div className="flex gap-2">
        {(["cname", "txt"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t ? "bg-[#0A0A0A] text-white" : "bg-[#F4F4F6] text-[#3A3A3E] hover:bg-[#E8EEF4]"
            }`}
          >
            {t === "cname" ? "CNAME (recommended)" : "TXT Verification"}
          </button>
        ))}
      </div>

      {tab === "cname" ? (
        <div className="bg-[#F8F8FC] rounded-xl border border-[#E4E4EC] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F0F0F6] border-b border-[#E4E4EC]">
                {["Type", "Name / Host", "Value / Points To"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-[#8888A0] font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2.5 font-semibold text-[#4A7A94] font-mono">CNAME</td>
                <td className="px-4 py-2.5 font-mono text-[#0A0A0A]">
                  {subdomain}
                  <CopyButton value={subdomain} />
                </td>
                <td className="px-4 py-2.5 font-mono text-[#0A0A0A] flex items-center gap-1">
                  snipr.sh <CopyButton value="snipr.sh" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#F8F8FC] rounded-xl border border-[#E4E4EC] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F0F0F6] border-b border-[#E4E4EC]">
                {["Type", "Name / Host", "Value"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-[#8888A0] font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-2.5 font-semibold text-[#4A7A94] font-mono">TXT</td>
                <td className="px-4 py-2.5 font-mono text-[#0A0A0A]">
                  _snipr-verify.{domain}
                  <CopyButton value={`_snipr-verify.${domain}`} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1 font-mono text-[10px] text-[#0A0A0A] break-all">
                    {token}
                    <CopyButton value={token} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-[#8888A0]">
        DNS propagation takes 5 min – 48 hours. After the user adds the record, click <strong>Verify DNS</strong> to check automatically, or <strong>Force Verify</strong> to approve immediately.
      </p>
    </div>
  );
}

function DomainRow({ d, onDelete, onRefresh, onShowWizard }: {
  d: AdminDomain;
  onDelete: (id: string, domain: string) => void;
  onRefresh: () => void;
  onShowWizard: (d: AdminDomain) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<null | "verify" | "force" | "unverify" | "dns">(null);
  const [dnsResult, setDnsResult] = useState<DnsCheckResult | null>(null);
  const [dnsError, setDnsError] = useState<string | null>(null);

  async function checkDns() {
    setBusy("dns");
    setDnsError(null);
    try {
      const data = await apiFetch(`/admin/domains/${d.id}/dns-check`);
      setDnsResult(data);
    } catch (e: any) {
      setDnsError(e?.error ?? "DNS check failed");
    } finally {
      setBusy(null);
    }
  }

  async function verify(force = false) {
    setBusy(force ? "force" : "verify");
    setDnsError(null);
    try {
      await apiFetch(`/admin/domains/${d.id}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ force }),
      });
      onRefresh();
    } catch (e: any) {
      if (e?.error === "dns_not_configured") {
        setDnsError("DNS records not found yet. Add the CNAME or TXT record first, or use Force Verify to approve now.");
      } else {
        setDnsError(e?.message ?? e?.error ?? "Verification failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function unverify() {
    if (!confirm(`Revoke verification for "${d.domain}"?`)) return;
    setBusy("unverify");
    try {
      await apiFetch(`/admin/domains/${d.id}/unverify`, { method: "PATCH" });
      onRefresh();
    } catch {
      setDnsError("Failed to revoke verification");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <tr
        className="hover:bg-[#F8F8FC] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-[#8888A0] shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-[#8888A0] shrink-0" />}
            <Globe className="w-3.5 h-3.5 text-[#728DA7] shrink-0" />
            <span className="font-medium text-[#0A0A0A]">{d.domain}</span>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <div className="text-sm font-medium text-[#0A0A0A]">{d.ownerName}</div>
          <div className="text-xs text-[#8888A0]">{d.ownerEmail}</div>
        </td>
        <td className="px-5 py-3.5 text-[#3A3A3E] text-sm">{d.workspaceName}</td>
        <td className="px-5 py-3.5">
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              d.verified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}>
              {d.verified ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {d.verified ? "Verified" : "Pending"}
            </span>
            {d.supportsSubdomains && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                Wildcard
              </span>
            )}
            {d.isPlatformDomain && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700">
                Platform
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-3.5 text-xs text-[#8888A0]">{fmtDate(d.createdAt)}</td>
        <td className="px-5 py-3.5">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(d.id, d.domain); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-[#8888A0] hover:text-red-500 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[#F8FAFF]">
          <td colSpan={6} className="px-6 py-4 border-t border-[#E8EEF4]">
            <div className="space-y-4">
              <DnsInstructions domain={d.domain} token={d.verificationToken} />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {!d.verified && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onShowWizard(d); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-all"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Setup Guide
                  </button>
                )}
                <button
                  onClick={checkDns}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4F4F6] border border-[#E4E4EC] text-xs font-medium text-[#3A3A3E] hover:bg-[#E8EEF4] disabled:opacity-50 transition-all"
                >
                  {busy === "dns" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-[#728DA7]" />}
                  Check DNS
                </button>

                {!d.verified ? (
                  <>
                    <button
                      onClick={() => verify(false)}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-all"
                    >
                      {busy === "verify" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Verify DNS
                    </button>
                    <button
                      onClick={() => verify(true)}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-[#222] disabled:opacity-50 transition-all"
                    >
                      {busy === "force" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Force Verify
                    </button>
                  </>
                ) : (
                  <button
                    onClick={unverify}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-all"
                  >
                    {busy === "unverify" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                    Revoke Verification
                  </button>
                )}
              </div>

              {/* DNS Check Result */}
              {dnsResult && (
                <div className="bg-white rounded-xl border border-[#E4E4EC] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#0A0A0A]">DNS Check Results</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2.5 bg-[#F8F8FC] rounded-xl p-3 border border-[#E4E4EC]">
                      {dnsResult.cnameOk
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        : <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-semibold text-[#0A0A0A]">CNAME Record</p>
                        <p className="text-[#8888A0] mt-0.5">
                          {dnsResult.cnameOk
                            ? `→ ${dnsResult.cnameTarget}`
                            : dnsResult.cnameTarget
                            ? `Found: ${dnsResult.cnameTarget} (not pointing to snipr.sh)`
                            : "No CNAME record found"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 bg-[#F8F8FC] rounded-xl p-3 border border-[#E4E4EC]">
                      {dnsResult.txtOk
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        : <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-semibold text-[#0A0A0A]">TXT Record</p>
                        <p className="text-[#8888A0] mt-0.5">
                          {dnsResult.txtOk
                            ? "Token verified"
                            : dnsResult.txtFound
                            ? "Found but token mismatch"
                            : "No TXT record found"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs font-medium flex items-center gap-1.5 ${dnsResult.ready ? "text-green-600" : "text-amber-600"}`}>
                    {dnsResult.ready
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> DNS configured correctly — domain is ready to verify</>
                      : <><Clock className="w-3.5 h-3.5" /> DNS not propagated yet — use Force Verify to approve now</>}
                  </div>
                </div>
              )}

              {dnsError && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{dnsError}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AddDomainModal({ onClose, onAdded }: { onClose: () => void; onAdded: (created: any) => void }) {
  const [domain, setDomain] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [supportsSubdomains, setSupportsSubdomains] = useState(false);
  const [autoVerify, setAutoVerify] = useState(false);
  const [isPlatformDomain, setIsPlatformDomain] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [wsLoading, setWsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/admin/workspaces-list")
      .then((data) => { setWorkspaces(data); if (data.length > 0) setWorkspaceId(data[0].id); })
      .catch(() => setError("Failed to load workspaces"))
      .finally(() => setWsLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    if (!isPlatformDomain && !workspaceId) return;
    setError("");
    setLoading(true);
    try {
      const created = await apiFetch("/admin/domains", {
        method: "POST",
        body: JSON.stringify({ domain: domain.trim(), workspaceId: isPlatformDomain ? undefined : workspaceId, supportsSubdomains, autoVerify, isPlatformDomain }),
      });
      onAdded(created);
      onClose();
    } catch (err: any) {
      setError(err?.error ?? "Failed to add domain");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-[#E4E4EC] shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E4EC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0A0A0A] flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-[#0A0A0A]">Add Domain</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F4F4F6] transition-colors">
            <X className="w-4 h-4 text-[#8888A0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3A3A3E] mb-1.5">Domain Name</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4EC] bg-[#F8F8FC] text-[#0A0A0A] text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
              autoFocus
            />
            <p className="text-xs text-[#8888A0] mt-1">Enter the domain without protocol (e.g., example.com or go.example.com)</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl border border-[#728DA7]/40 bg-[#728DA7]/5">
              <input
                type="checkbox"
                checked={isPlatformDomain}
                onChange={(e) => setIsPlatformDomain(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#E4E4EC] text-[#728DA7] focus:ring-[#728DA7]/30"
              />
              <div>
                <p className="text-sm font-semibold text-[#0A0A0A]">Platform Domain (visible to all users)</p>
                <p className="text-xs text-[#8888A0] mt-0.5">All users will see this domain as an option when creating short links. No workspace required.</p>
              </div>
            </label>
          </div>

          {!isPlatformDomain && (
            <div>
              <label className="block text-sm font-medium text-[#3A3A3E] mb-1.5">Assign to Workspace</label>
              {wsLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#8888A0]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading workspaces...
                </div>
              ) : (
                <select
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E4EC] bg-[#F8F8FC] text-[#0A0A0A] text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.ownerEmail})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={supportsSubdomains}
                onChange={(e) => setSupportsSubdomains(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#E4E4EC] text-[#0A0A0A] focus:ring-[#728DA7]/30"
              />
              <div>
                <p className="text-sm font-medium text-[#3A3A3E] group-hover:text-[#0A0A0A] transition-colors">Enable Subdomain Support</p>
                <p className="text-xs text-[#8888A0] mt-0.5">Allow wildcard subdomains (*.example.com). Each subdomain can have independent short links.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={autoVerify}
                onChange={(e) => setAutoVerify(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#E4E4EC] text-[#0A0A0A] focus:ring-[#728DA7]/30"
              />
              <div>
                <p className="text-sm font-medium text-[#3A3A3E] group-hover:text-[#0A0A0A] transition-colors">Auto-Verify Domain</p>
                <p className="text-xs text-[#8888A0] mt-0.5">Skip DNS verification and mark as verified immediately. Only use if you control this domain.</p>
              </div>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E4E4EC] text-sm font-medium text-[#3A3A3E] hover:bg-[#F4F4F6] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !domain.trim() || !workspaceId}
              className="flex-1 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Adding..." : "Add Domain"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DomainsTab() {
  const [domains, setDomains] = useState<AdminDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "pending">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [wizardDomain, setWizardDomain] = useState<AdminDomain | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/admin/domains");
      setDomains(data);
    } catch (e: any) {
      setError(e?.error ?? "Failed to load domains");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function del(id: string, domain: string) {
    if (!confirm(`Remove domain "${domain}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/admin/domains/${id}`, { method: "DELETE" });
      setDomains((d) => d.filter((x) => x.id !== id));
    } catch {
      alert("Failed to remove domain. Please try again.");
    }
  }

  const filtered = domains.filter((d) => {
    const matchSearch = !search ||
      d.domain.toLowerCase().includes(search.toLowerCase()) ||
      d.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      d.ownerName.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "verified" && d.verified) ||
      (filter === "pending" && !d.verified);
    return matchSearch && matchFilter;
  });

  const counts = {
    all: domains.length,
    verified: domains.filter((d) => d.verified).length,
    pending: domains.filter((d) => !d.verified).length,
  };

  return (
    <div className="space-y-4">
      {/* How-To Banner */}
      <div className="bg-[#F0F4FF] border border-[#D0DCF4] rounded-2xl p-4 flex gap-3">
        <Globe className="w-5 h-5 text-[#4A7A94] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#1A2A3A]">Custom Domain Verification</p>
          <p className="text-xs text-[#4A6080] leading-relaxed">
            Click any domain row to expand DNS setup instructions and verification controls. Users must add a{" "}
            <strong>CNAME</strong> pointing to <code className="bg-white px-1 rounded border border-[#D0DCF4]">snipr.sh</code>{" "}
            or a <strong>TXT</strong> record with their verification token. Use <strong>Verify DNS</strong> to check records automatically, or <strong>Force Verify</strong> to approve immediately without waiting for DNS propagation.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {(["all", "verified", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filter === f ? "bg-[#0A0A0A] text-white" : "bg-white border border-[#E4E4EC] text-[#3A3A3E] hover:bg-[#F4F4F6]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                filter === f ? "bg-white/20 text-white" : "bg-[#F4F4F6] text-[#8888A0]"
              }`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domain or owner…"
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E4E4EC] bg-white text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
            />
          </div>
          <button onClick={load} className="p-2 rounded-xl border border-[#E4E4EC] bg-white hover:bg-[#F4F4F6] transition-all" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5 text-[#8888A0]" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#1A1A1A] active:scale-[0.98] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Domain
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddDomainModal
          onClose={() => setShowAddModal(false)}
          onAdded={(created) => { load(); setWizardDomain(created); }}
        />
      )}

      {wizardDomain && (
        <DomainSetupWizard
          open={true}
          onClose={() => setWizardDomain(null)}
          domain={wizardDomain}
          mode="admin"
          onVerified={load}
        />
      )}

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={load} className="ml-auto text-xs underline hover:no-underline">Retry</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="bg-[#F8F8FC] border-b border-[#E4E4EC]">
                {["Domain", "Owner", "Workspace", "Status", "Added", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#8888A0] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F6]">
              {loading && [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-[#F4F4F6] rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Globe className="w-8 h-8 text-[#C8C8D8] mx-auto mb-3" />
                    <p className="text-[#8888A0] text-sm">No custom domains found</p>
                    <p className="text-[#B0B0C0] text-xs mt-1">Users can add domains from their workspace settings</p>
                  </td>
                </tr>
              )}
              {!loading && filtered.map((d) => (
                <DomainRow key={d.id} d={d} onDelete={del} onRefresh={load} onShowWizard={setWizardDomain} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

