"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Globe, CheckCircle2, Copy, CheckCircle, Loader2, X, ArrowRight, ArrowLeft,
  ShieldCheck, PartyPopper, Link2, AlertTriangle, ExternalLink,
  Monitor, Info, Clock, ChevronDown, ChevronUp, HelpCircle, RefreshCw,
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
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-2 shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      title="Copy to clipboard"
    >
      {copied
        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5 text-gray-400" />}
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

function DnsStatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-sm ${
      ok ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
    }`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {ok
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />}
        <span className={`font-semibold text-[13px] ${ok ? "text-emerald-800" : "text-gray-600"}`}>{label}</span>
      </div>
      <span className={`text-[11px] font-mono truncate ${ok ? "text-emerald-600" : "text-gray-400"}`}>{detail}</span>
    </div>
  );
}

const REGISTRAR_GUIDES: { id: string; name: string; steps: string[] }[] = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    steps: [
      "Log in to dash.cloudflare.com and select your domain.",
      "Click DNS → Records in the left sidebar.",
      "Click Add record.",
      "Set Type, Name, and Content (Target) exactly as shown above.",
      "For TTL, choose Auto or set it to 300 (5 minutes).",
      "Click Save.",
    ],
  },
  {
    id: "namecheap",
    name: "Namecheap",
    steps: [
      "Log in to namecheap.com → Domain List → Manage next to your domain.",
      "Click Advanced DNS at the top.",
      "Under Host Records, click Add New Record.",
      "Choose the record type, enter the Host (Name) and Value, then save.",
      "TTL can be left at Automatic.",
    ],
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    steps: [
      "Log in to godaddy.com → My Products → DNS next to your domain.",
      "Click Add under DNS Records.",
      "Select the Type, enter the Name and Value, then Save.",
      "Set TTL to 600 seconds (10 min) or lower for faster propagation.",
    ],
  },
  {
    id: "google",
    name: "Google Domains / Squarespace",
    steps: [
      "Go to domains.squarespace.com (formerly Google Domains) and select your domain.",
      "Click DNS in the left menu.",
      "Scroll to Custom records → Manage custom records.",
      "Click Create new record, fill in the fields, and save.",
    ],
  },
  {
    id: "porkbun",
    name: "Porkbun",
    steps: [
      "Log in to porkbun.com → Account → Domain Management.",
      "Click DNS next to your domain.",
      "Select the record type from the dropdown, fill in Host and Answer/Value, click Add.",
    ],
  },
];

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
  const [activeRegistrar, setActiveRegistrar] = useState<string | null>(null);
  const [showTtlTip, setShowTtlTip] = useState(false);

  useEffect(() => {
    const clean = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean || !clean.includes(".")) { setParsedType(null); return; }
    const parts = clean.replace(/^www\./, "").split(".");
    setParsedType(parts.length <= 2 ? "root" : "subdomain");
  }, [domainInput]);

  const fetchSetupInfo = useCallback(async (domId: string) => {
    try {
      const r = await fetch(`/api/domains/${domId}/setup-info`, { credentials: "include" });
      if (r.ok) setSetupInfo(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (currentDomain?.id && step >= 3) fetchSetupInfo(currentDomain.id);
  }, [currentDomain?.id, step, fetchSetupInfo]);

  // Auto-check DNS when user enters the verify step
  useEffect(() => {
    if (step === 4 && currentDomain && !dnsResult && !checking) {
      checkDns();
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const cnameTarget = setupInfo?.cnameTarget || "snipr.sh";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[540px] mx-4 max-h-[92vh] overflow-y-auto border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
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
          {step <= 4 && (
            <StepBar current={Math.min(step, 4)} total={4} labels={["Domain", "Purpose", "DNS", "Verify"]} />
          )}

          {/* ═══ STEP 1: Enter Domain ═══ */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">What domain do you want to use?</h3>
                <p className="text-sm text-gray-500 mt-1">You can use a full domain or just a subdomain</p>
              </div>

              {/* Examples */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="font-semibold text-blue-800 mb-0.5">Subdomain (recommended)</p>
                  <p className="font-mono text-blue-600">go.yourdomain.com</p>
                  <p className="text-blue-500 mt-1">Works alongside your website</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-semibold text-gray-700 mb-0.5">Root domain</p>
                  <p className="font-mono text-gray-600">yourdomain.com</p>
                  <p className="text-gray-400 mt-1">Use a domain you don't have a site on</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus value={domainInput}
                    onChange={(e) => { setDomainInput(e.target.value); setError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && isValidDomain) setStep(2); }}
                    placeholder="go.example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#0A0A0A]/5 transition-all"
                  />
                </div>
                {parsedType && isValidDomain && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      parsedType === "root" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-600"
                    }`}>
                      {parsedType === "root" ? <Globe className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      {parsedType === "root" ? "Root domain detected" : `Subdomain of ${normalizedInput.split(".").slice(-2).join(".")}`}
                    </span>
                  </div>
                )}
                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              </div>

              <button
                onClick={() => { setError(null); setStep(2); }}
                disabled={!isValidDomain}
                className="w-full py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1F1F1F] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                Continue <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          )}

          {/* ═══ STEP 2: Choose Purpose ═══ */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">How will you use <span className="font-mono text-[#0A0A0A]">{normalizedInput}</span>?</h3>
                <p className="text-sm text-gray-500 mt-1">This helps us give you the safest DNS instructions</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setPurpose("links_only"); createDomain(normalizedInput, "links_only"); }}
                  disabled={creating}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#0A0A0A] hover:bg-gray-50 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Link2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">Dedicated short link domain</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">This domain isn't used for anything else — only short links</p>
                      <p className="text-[11px] text-emerald-600 font-medium mt-1.5">✓ Simplest setup</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => { setPurpose("has_website"); createDomain(normalizedInput, "has_website"); }}
                  disabled={creating}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-[#0A0A0A] hover:bg-gray-50 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                      <Monitor className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">Domain with existing website</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">This domain already has a website or blog on it</p>
                      <p className="text-[11px] text-amber-600 font-medium mt-1.5">⚠ We'll recommend a subdomain to avoid breaking your site</p>
                    </div>
                  </div>
                </button>
              </div>

              {creating && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting up domain…
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
                <h3 className="text-lg font-bold text-gray-900">Add these DNS records</h3>
                <p className="text-sm text-gray-500 mt-0.5">Log in to your domain registrar and add the record(s) below</p>
              </div>

              {/* What is this? */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                <p className="leading-relaxed">
                  <strong>What is a DNS record?</strong> It tells the internet where to send visitors when they type your domain.
                  Adding a CNAME record makes your domain point to Snipr so short links work.
                </p>
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
                  <p className="text-xs font-semibold text-blue-800 mb-2">Recommended: use a subdomain to protect your site</p>
                  <div className="flex flex-wrap gap-2">
                    {setupInfo.recommendations.suggestedSubdomains.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => switchToSubdomain(sub)}
                        disabled={creating}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-50"
                      >
                        <Link2 className="w-3 h-3" /> {sub}
                      </button>
                    ))}
                  </div>
                  {creating && <p className="text-[10px] text-blue-600 mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Switching…</p>}
                </div>
              )}

              {/* DNS Records */}
              <div className="space-y-3">
                {setupInfo?.recommendations.records.map((rec, i) => {
                  const isRequired = rec.priority === "Required";
                  return (
                    <div key={i} className={`rounded-xl border overflow-hidden ${isRequired ? "border-gray-300" : "border-dashed border-gray-200"}`}>
                      {/* Record header */}
                      <div className={`flex items-center justify-between px-4 py-2.5 ${isRequired ? "bg-gray-900" : "bg-gray-50 border-b border-gray-200"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rec.type === "A" ? "bg-emerald-400 text-emerald-900" :
                            rec.type === "CNAME" ? "bg-blue-400 text-blue-900" :
                            "bg-purple-300 text-purple-900"
                          }`}>{rec.type}</span>
                          <span className={`text-[11px] font-semibold ${isRequired ? "text-white" : "text-gray-500"}`}>
                            {isRequired ? "Required" : "Optional — for extra verification"}
                          </span>
                        </div>
                        {rec.type === "CNAME" && (
                          <span className="text-[10px] text-gray-300 font-mono hidden sm:block">
                            → points to Snipr servers
                          </span>
                        )}
                      </div>

                      {/* Record fields */}
                      <div className="grid grid-cols-2 gap-px bg-gray-200">
                        <div className="bg-white p-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Name / Host</p>
                          <div className="flex items-center">
                            <p className="text-[13px] font-mono text-gray-900 break-all">{rec.name}</p>
                            <CopyBtn value={rec.name} />
                          </div>
                          {rec.type === "CNAME" && (
                            <p className="text-[10px] text-gray-400 mt-1">Enter this in the "Host" or "Name" field</p>
                          )}
                          {rec.type === "A" && (
                            <p className="text-[10px] text-gray-400 mt-1">Use @ for root domain</p>
                          )}
                        </div>
                        <div className="bg-white p-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">
                            {rec.type === "CNAME" ? "Target / Points To" : rec.type === "A" ? "IP Address" : "Value"}
                          </p>
                          <div className="flex items-center">
                            <p className="text-[13px] font-mono text-gray-900 break-all">{rec.value}</p>
                            <CopyBtn value={rec.value} />
                          </div>
                          {rec.type === "CNAME" && (
                            <p className="text-[10px] text-gray-400 mt-1">Enter this in the "Target" or "Value" field</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TTL tip */}
              <button
                onClick={() => setShowTtlTip(!showTtlTip)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-[13px] font-semibold text-gray-700">TTL — how fast changes spread</span>
                </div>
                {showTtlTip ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showTtlTip && (
                <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-1.5">
                  <p>TTL (Time To Live) controls how quickly DNS changes take effect worldwide.</p>
                  <p>💡 <strong>Set TTL to 300</strong> (5 minutes) before making changes so you see results faster.</p>
                  <p className="text-gray-400">After your domain is working, you can raise TTL back to 3600 or higher.</p>
                </div>
              )}

              {/* Registrar guides */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <p className="px-4 py-2.5 text-[12px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                  Step-by-step guide for your registrar
                </p>
                <div className="flex flex-wrap gap-1.5 p-3">
                  {REGISTRAR_GUIDES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setActiveRegistrar(activeRegistrar === r.id ? null : r.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        activeRegistrar === r.id
                          ? "bg-[#0A0A0A] text-white border-[#0A0A0A]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
                {activeRegistrar && (() => {
                  const guide = REGISTRAR_GUIDES.find((r) => r.id === activeRegistrar);
                  if (!guide) return null;
                  return (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                      <ol className="space-y-2">
                        {guide.steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <span className="leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ol>
                      {activeRegistrar === "cloudflare" && setupInfo?.recommendations.cloudflareUrl && (
                        <a
                          href={setupInfo.recommendations.cloudflareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 rounded-lg bg-[#F48120] hover:bg-[#E0740F] text-white text-xs font-semibold transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open Cloudflare DNS for this domain
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Don't see your registrar */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <HelpCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <p className="text-xs text-gray-500">
                  Don't see your registrar above? Search for <strong>"how to add a CNAME record"</strong> on your registrar's support site — the steps are similar everywhere.
                </p>
              </div>

              {/* Propagation notice */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <strong>DNS changes take time.</strong> After saving, propagation typically takes 5–30 minutes, but can be up to 48 hours. Come back and click "Check DNS Status" once you've saved the record.
                </p>
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              {/* Navigation */}
              <div className="flex justify-between pt-1">
                {!domain && (
                  <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
                  </button>
                )}
                {domain && <div />}
                <button
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1F1F1F] transition-all active:scale-[0.98]"
                >
                  I've Added the Records <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Verify ═══ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Checking DNS for</h3>
                <p className="font-mono font-semibold text-gray-800 text-base mt-0.5">{currentDomain?.domain}</p>
              </div>

              {/* Auto-checking notice */}
              {checking && !dnsResult && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Checking your DNS records…</span>
                </div>
              )}

              {/* Check / Re-check button */}
              {(!checking || dnsResult) && (
                <div className="flex justify-center">
                  <button
                    onClick={checkDns}
                    disabled={checking}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-all"
                  >
                    {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {checking ? "Checking…" : dnsResult ? "Re-check DNS" : "Check DNS Status"}
                  </button>
                </div>
              )}

              {/* Results */}
              {dnsResult && (
                <div className="space-y-2">
                  {setupInfo?.isRootDomain === false && (
                    <DnsStatusRow
                      label="CNAME Record"
                      ok={dnsResult.cnameOk}
                      detail={dnsResult.cnameOk
                        ? `→ ${dnsResult.cnameTarget}`
                        : dnsResult.cnameTarget
                          ? `Found: ${dnsResult.cnameTarget} (expected: ${cnameTarget})`
                          : "Not found yet"}
                    />
                  )}
                  {setupInfo?.isRootDomain !== false && (
                    <DnsStatusRow
                      label="A Record"
                      ok={dnsResult.aRecordOk}
                      detail={dnsResult.aRecordOk
                        ? `IP: ${dnsResult.aRecordIp}`
                        : dnsResult.aRecordIp
                          ? `Found IP: ${dnsResult.aRecordIp} (may not match)`
                          : "Not found yet"}
                    />
                  )}
                  <DnsStatusRow
                    label="TXT Verification (optional)"
                    ok={dnsResult.txtOk}
                    detail={dnsResult.txtOk ? "Token matched" : dnsResult.txtFound ? "Token mismatch" : "Not found (optional)"}
                  />

                  {dnsResult.ready ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      DNS configured correctly! Click "Verify & Activate" below.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="font-semibold mb-1">Records not found yet</p>
                        <p>This is normal — DNS changes take 5 minutes to 48 hours to spread worldwide. Click "Re-check DNS" after a few minutes.</p>
                      </div>
                      <button
                        onClick={() => setStep(3)}
                        className="w-full text-xs text-blue-600 hover:text-blue-700 underline text-center transition-colors"
                      >
                        ← Go back to review the DNS records to add
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-500 font-medium text-center">{error}</p>}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {dnsResult?.ready && (
                  <button
                    onClick={() => verifyDomain(false)}
                    disabled={verifying}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.97]"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    {verifying ? "Verifying…" : "Verify & Activate"}
                  </button>
                )}
                {mode === "admin" && (
                  <button
                    onClick={() => verifyDomain(true)}
                    disabled={verifying}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all"
                  >
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
                  <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg">
                    {currentDomain?.domain || domain?.domain}
                  </span>{" "}
                  is verified and ready
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-left space-y-2">
                <p className="text-xs font-semibold text-gray-700">What's next?</p>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold">✓</span> Create short links and select this domain</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold">✓</span> Share links like <span className="font-mono">{currentDomain?.domain || domain?.domain}/your-link</span></li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 font-bold">✓</span> Track clicks and analytics per link</li>
                </ul>
              </div>

              <div className="flex gap-3 justify-center">
                <a
                  href={`https://${currentDomain?.domain || domain?.domain}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Test domain
                </a>
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1F1F1F] transition-all"
                >
                  Done <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
