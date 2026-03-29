"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Globe, CheckCircle2, Copy, CheckCircle, Loader2, X, ArrowRight, ArrowLeft,
  Wifi, WifiOff, ShieldCheck, PartyPopper, Link2, AlertTriangle, ExternalLink,
  Zap, Monitor,
} from "lucide-react";

interface DomainSetupWizardProps {
  open: boolean;
  onClose: () => void;
  domain?: { id: string; domain: string; verified: boolean; purpose?: string } | null;
  mode: "admin" | "user";
  onVerified?: () => void;
  onDomainCreated?: (domain: any) => void;
}

interface SetupInfo {
  token: string; cnameHost: string; cnameTarget: string;
  txtHost: string; txtValue: string; purpose: string;
  domainType: string; isRootDomain: boolean; rootDomain: string;
  recommendations: {
    records: { type: string; name: string; value: string; priority?: string }[];
    warnings: string[]; suggestedSubdomains: string[]; cloudflareUrl: string;
  };
}

interface DnsResult {
  cnameOk: boolean; cnameTarget: string | null;
  aRecordOk: boolean; aRecordIp: string | null;
  txtOk: boolean; txtFound: string | null; ready: boolean;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1.5 p-1 rounded-md hover:bg-gray-100 transition-colors" title="Copy">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

function StepBar({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                isDone ? "bg-emerald-500 text-white" : isActive ? "bg-[#0A0A0A] text-white shadow-md" : "bg-gray-100 text-gray-400"
              }`}>
                {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : step}
              </div>
              <span className={`text-[9px] font-medium ${isActive ? "text-[#0A0A0A]" : "text-gray-400"}`}>{labels[i]}</span>
            </div>
            {step < total && <div className={`w-6 h-0.5 rounded mb-4 ${step < current ? "bg-emerald-500" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function DomainSetupWizard({ open, onClose, domain, mode, onVerified, onDomainCreated }: DomainSetupWizardProps) {
  const initialStep = domain ? (domain.verified ? 5 : 3) : 1;
  const [step, setStep] = useState(initialStep);
  const [domainInput, setDomainInput] = useState("");
  const [parsedType, setParsedType] = useState<"root" | "subdomain" | null>(null);
  const [purpose, setPurpose] = useState<"links_only" | "has_website" | null>(null);
  const [currentDomain, setCurrentDomain] = useState(domain || null);
  const [setupInfo, setSetupInfo] = useState<SetupInfo | null>(null);
  const [dnsResult, setDnsResult] = useState<DnsResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCloudflare, setShowCloudflare] = useState(false);

  // Parse domain type
  useEffect(() => {
    const clean = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean || !clean.includes(".")) { setParsedType(null); return; }
    const parts = clean.replace(/^www\./, "").split(".");
    setParsedType(parts.length <= 2 ? "root" : "subdomain");
  }, [domainInput]);

  // Fetch setup info when domain is set
  const fetchSetupInfo = useCallback(async (domId: string) => {
    try {
      const r = await fetch(`/api/domains/${domId}/setup-info`, { credentials: "include" });
      if (r.ok) setSetupInfo(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (currentDomain?.id && step >= 3) fetchSetupInfo(currentDomain.id);
  }, [currentDomain?.id, step, fetchSetupInfo]);

  const normalizedInput = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const isValidDomain = normalizedInput.includes(".") && normalizedInput.length > 3 && !normalizedInput.endsWith(".snipr.sh") && normalizedInput !== "snipr.sh";

  async function createDomain(domainName: string, selectedPurpose: string) {
    setCreating(true); setError(null);
    try {
      const r = await fetch("/api/domains", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainName, purpose: selectedPurpose }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || data.error || "Failed to add domain"); setCreating(false); return; }
      setCurrentDomain(data);
      onDomainCreated?.(data);
      setStep(3);
    } catch { setError("Network error. Please try again."); }
    setCreating(false);
  }

  async function checkDns() {
    if (!currentDomain) return;
    setChecking(true); setError(null);
    try {
      const r = await fetch(`/api/domains/${currentDomain.id}/dns-check`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setDnsResult(data);
        if (!setupInfo && data.token) fetchSetupInfo(currentDomain.id);
      }
    } catch { setError("Failed to check DNS."); }
    setChecking(false);
  }

  async function verifyDomain(force = false) {
    if (!currentDomain) return;
    setVerifying(true); setError(null);
    try {
      const apiBase = mode === "admin" ? "/api/admin/domains" : "/api/domains";
      const r = await fetch(`${apiBase}/${currentDomain.id}/verify`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await r.json();
      if (data.ok) { setStep(5); onVerified?.(); } else { setError(data.message || "Verification failed."); }
    } catch { setError("Verification failed."); }
    setVerifying(false);
  }

  async function switchToSubdomain(subdomain: string) {
    if (!currentDomain) return;
    setCreating(true); setError(null);
    try {
      await fetch(`/api/domains/${currentDomain.id}`, { method: "DELETE", credentials: "include" });
      const r = await fetch("/api/domains", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: subdomain, purpose: purpose || "links_only" }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || "Failed"); setCreating(false); return; }
      setCurrentDomain(data); onDomainCreated?.(data);
      setSetupInfo(null); setDnsResult(null);
      fetchSetupInfo(data.id);
    } catch { setError("Network error."); }
    setCreating(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 max-h-[92vh] overflow-y-auto border border-gray-200"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0A0A0A] flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">
                {step <= 2 ? "Add Custom Domain" : step <= 4 ? "Domain Setup" : "Domain Connected"}
              </h2>
              {currentDomain && step >= 3 && (
                <p className="text-[11px] text-gray-400 font-mono">{currentDomain.domain}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {step <= 4 && <StepBar current={Math.min(step, 4)} total={4} labels={["Domain", "Purpose", "DNS", "Verify"]} />}

          {/* ═══ STEP 1: Enter Domain ═══ */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">What domain do you want to use?</h3>
                <p className="text-sm text-gray-500 mt-1">Enter your custom domain or subdomain</p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus value={domainInput}
                    onChange={(e) => { setDomainInput(e.target.value); setError(null); }}
                    placeholder="example.com or go.example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#0A0A0A]/5 transition-all"
                  />
                </div>
                {parsedType && isValidDomain && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      parsedType === "root" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    }`}>
                      {parsedType === "root" ? <Globe className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      {parsedType === "root" ? "Root domain" : `Subdomain of ${normalizedInput.split(".").slice(-2).join(".")}`}
                    </span>
                  </div>
                )}
                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              </div>

              <button onClick={() => { setError(null); setStep(2); }} disabled={!isValidDomain}
                className="w-full py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1F1F1F] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                Continue <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          )}

          {/* ═══ STEP 2: Choose Purpose ═══ */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">How will you use this domain?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This helps us give you the right DNS setup instructions
                </p>
              </div>

              <div className="space-y-3">
                {/* Card A: Only for links */}
                <button onClick={() => { setPurpose("links_only"); createDomain(normalizedInput, "links_only"); }} disabled={creating}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#0A0A0A] hover:bg-gray-50 transition-all group disabled:opacity-50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Link2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">Dedicated short link domain</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">This domain is empty and will only be used for short links</p>
                      <p className="text-[11px] text-gray-400 mt-1 font-mono">e.g., {normalizedInput}/my-link</p>
                    </div>
                  </div>
                </button>

                {/* Card B: Has website */}
                <button onClick={() => { setPurpose("has_website"); createDomain(normalizedInput, "has_website"); }} disabled={creating}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#0A0A0A] hover:bg-gray-50 transition-all group disabled:opacity-50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                      <Monitor className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">Domain with existing website</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">This domain already has a website or blog running on it</p>
                      <p className="text-[11px] text-gray-400 mt-1">We'll recommend the safest setup to avoid breaking your site</p>
                    </div>
                  </div>
                </button>
              </div>

              {creating && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting up domain...
                </div>
              )}
              {error && <p className="text-xs text-red-500 font-medium text-center">{error}</p>}

              <button onClick={() => setStep(1)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
              </button>
            </div>
          )}

          {/* ═══ STEP 3: DNS Setup ═══ */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Configure DNS Records</h3>
                <p className="text-sm text-gray-500 mt-0.5">Add these records at your domain registrar</p>
              </div>

              {/* Warnings */}
              {setupInfo?.recommendations.warnings.map((w, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl text-xs ${
                  w.includes("break") || w.includes("stop working")
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : w.includes("not be affected")
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border border-amber-200 text-amber-700"
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{w}</p>
                </div>
              ))}

              {/* Subdomain suggestions */}
              {setupInfo?.recommendations.suggestedSubdomains && setupInfo.recommendations.suggestedSubdomains.length > 0 && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Recommended: Use a subdomain instead</p>
                  <div className="flex flex-wrap gap-2">
                    {setupInfo.recommendations.suggestedSubdomains.map((sub) => (
                      <button key={sub} onClick={() => switchToSubdomain(sub)} disabled={creating}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-50">
                        <Link2 className="w-3 h-3" /> {sub}
                      </button>
                    ))}
                  </div>
                  {creating && <p className="text-[10px] text-blue-600 mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Switching...</p>}
                </div>
              )}

              {/* DNS Records Table */}
              {setupInfo?.recommendations.records.map((rec, i) => (
                <div key={i} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rec.type === "A" ? "bg-emerald-100 text-emerald-700" :
                      rec.type === "CNAME" ? "bg-blue-100 text-blue-700" :
                      "bg-purple-100 text-purple-700"
                    }`}>{rec.type}</span>
                    <span className="text-[10px] font-medium text-gray-500">{rec.priority || "Required"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-gray-200">
                    <div className="bg-white p-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Name / Host</p>
                      <p className="text-[13px] font-mono text-gray-900 flex items-center">{rec.name} <CopyBtn value={rec.name} /></p>
                    </div>
                    <div className="bg-white p-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Value / Points To</p>
                      <p className="text-[13px] font-mono text-gray-900 flex items-center break-all">{rec.value} <CopyBtn value={rec.value} /></p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Cloudflare Auto-Connect */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowCloudflare(!showCloudflare)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <span className="text-[13px] font-semibold text-gray-900">Using Cloudflare?</span>
                  </div>
                  <ArrowRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showCloudflare ? "rotate-90" : ""}`} />
                </button>
                {showCloudflare && (
                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Quickly configure DNS by opening your Cloudflare dashboard directly to the DNS settings page for this domain.</p>
                    <a href={setupInfo?.recommendations.cloudflareUrl || "#"} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F48120] hover:bg-[#E0740F] text-white text-xs font-semibold transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Cloudflare DNS Settings
                    </a>
                    <p className="text-[10px] text-gray-400">After adding the records in Cloudflare, come back and click "I've Added the Records"</p>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              {/* Navigation */}
              <div className="flex justify-between pt-1">
                {!domain && <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
                </button>}
                {domain && <div />}
                <button onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1F1F1F] transition-all active:scale-[0.98]">
                  I've Added the Records <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Verify ═══ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Verify DNS Configuration</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Checking <span className="font-mono font-semibold text-gray-700">{currentDomain?.domain}</span>
                </p>
              </div>

              {/* Check button */}
              <div className="flex justify-center">
                <button onClick={checkDns} disabled={checking}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-all">
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  {checking ? "Checking..." : "Check DNS Status"}
                </button>
              </div>

              {/* Results */}
              {dnsResult && (
                <div className="space-y-2">
                  <DnsStatusRow label="CNAME Record" ok={dnsResult.cnameOk}
                    detail={dnsResult.cnameOk ? `Pointing to ${dnsResult.cnameTarget}` : dnsResult.cnameTarget ? `Found: ${dnsResult.cnameTarget}` : "Not found"} />
                  <DnsStatusRow label="A Record" ok={dnsResult.aRecordOk}
                    detail={dnsResult.aRecordOk ? `Resolves to ${dnsResult.aRecordIp}` : dnsResult.aRecordIp ? `Found: ${dnsResult.aRecordIp}` : "Not found"} />
                  <DnsStatusRow label="TXT Verification" ok={dnsResult.txtOk}
                    detail={dnsResult.txtOk ? "Token verified" : dnsResult.txtFound ? "Token mismatch" : "Not found"} />

                  {dnsResult.ready ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg p-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> DNS configured correctly! Click "Verify Now" to complete.
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                      DNS records not propagated yet. This can take 5 minutes to 48 hours. Click "Check DNS Status" to retry.
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                {dnsResult?.ready && (
                  <button onClick={() => verifyDomain(false)} disabled={verifying}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.97]">
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Verify Now
                  </button>
                )}
                {mode === "admin" && (
                  <button onClick={() => verifyDomain(true)} disabled={verifying}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all">
                    <ShieldCheck className="w-4 h-4" /> Force Verify
                  </button>
                )}
              </div>

              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back to DNS
                </button>
                <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  I'll verify later
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 5: Done ═══ */}
          {step === 5 && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <PartyPopper className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Domain Connected!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg">{currentDomain?.domain || domain?.domain}</span>
                  {" "}is verified and ready
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase">What's Next?</p>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Link2 className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Create your first short link</p>
                    <p className="text-xs text-gray-500">Go to Links, create a new link, and select this domain in Advanced Settings.</p>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-gray-200 font-mono text-sm text-center text-gray-700">
                  https://{currentDomain?.domain || domain?.domain}/<span className="text-blue-600">your-slug</span>
                </div>
              </div>

              <button onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1F1F1F] transition-all active:scale-[0.98]">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DnsStatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${ok ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <WifiOff className="w-4 h-4 text-gray-400 shrink-0" />}
      <div className="text-xs min-w-0">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-gray-500 truncate">{detail}</p>
      </div>
    </div>
  );
}
