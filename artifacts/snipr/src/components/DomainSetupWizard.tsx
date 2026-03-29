"use client";
import { useEffect, useState } from "react";
import {
  Globe, CheckCircle2, Copy, CheckCircle, Loader2, X,
  ArrowRight, ArrowLeft, Wifi, WifiOff, ShieldCheck, PartyPopper, Link2,
} from "lucide-react";

interface DomainSetupWizardProps {
  open: boolean;
  onClose: () => void;
  domain: { id: string; domain: string; verified: boolean };
  mode: "admin" | "user";
  onVerified?: () => void;
}

interface SetupInfo {
  token: string;
  cnameHost: string;
  cnameTarget: string;
  txtHost: string;
  txtValue: string;
}

interface DnsResult {
  cnameOk: boolean;
  cnameTarget: string | null;
  aRecordOk: boolean;
  aRecordIp: string | null;
  txtOk: boolean;
  txtFound: string | null;
  ready: boolean;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1.5 p-1 rounded hover:bg-black/5 transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              isDone ? "bg-green-500 text-white" :
              isActive ? "bg-[#0A0A0A] text-white shadow-lg" :
              "bg-gray-100 text-gray-400"
            }`}>
              {isDone ? <CheckCircle className="w-4 h-4" /> : step}
            </div>
            {step < total && (
              <div className={`w-8 h-0.5 rounded ${step < current ? "bg-green-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DomainSetupWizard({ open, onClose, domain, mode, onVerified }: DomainSetupWizardProps) {
  const [step, setStep] = useState(domain.verified ? 4 : 1);
  const [dnsTab, setDnsTab] = useState<"cname" | "a" | "txt">("cname");
  const [setupInfo, setSetupInfo] = useState<SetupInfo | null>(null);
  const [dnsResult, setDnsResult] = useState<DnsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = mode === "admin" ? "/api/admin/domains" : "/api/domains";

  useEffect(() => {
    if (!open || domain.verified) return;
    fetch(`/api/domains/${domain.id}/setup-info`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSetupInfo(d))
      .catch(() => {});
  }, [open, domain.id, domain.verified]);

  async function checkDns() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${apiBase}/${domain.id}/dns-check`, { credentials: "include" });
      const d = await r.json();
      setDnsResult(d);
      if (!setupInfo && d.token) {
        setSetupInfo({
          token: d.token,
          cnameHost: domain.domain.split(".").slice(0, -2).join(".") || "@",
          cnameTarget: "snipr.sh",
          txtHost: `_snipr-verify.${domain.domain}`,
          txtValue: d.token,
        });
      }
    } catch {
      setError("Failed to check DNS. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyDomain(force = false) {
    setVerifying(true);
    setError(null);
    try {
      const r = await fetch(`${apiBase}/${domain.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force }),
      });
      const d = await r.json();
      if (d.ok) {
        setStep(4);
        onVerified?.();
      } else {
        setError(d.message || "Verification failed. DNS records not found yet.");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0A0A0A] flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Domain Setup</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <StepIndicator current={step} total={4} />

          {/* Step 1: Domain Added */}
          {step === 1 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Domain Added!</h3>
                <p className="text-gray-500 mt-1">
                  <span className="font-semibold text-gray-900">{domain.domain}</span> has been added to your account.
                </p>
              </div>
              <p className="text-sm text-gray-400">
                Next, you'll need to configure your DNS records so we can verify ownership and route traffic.
              </p>
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] transition-all"
              >
                Continue to DNS Setup <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2: Configure DNS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="text-xl font-bold text-gray-900">Configure DNS Records</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Add one of these records at your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap)
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-2 justify-center flex-wrap">
                {([
                  { key: "cname" as const, label: "CNAME (Subdomains)" },
                  { key: "a" as const, label: "A Record (Root Domain)" },
                  { key: "txt" as const, label: "TXT Verification" },
                ]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDnsTab(t.key)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      dnsTab === t.key ? "bg-[#0A0A0A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* DNS record table */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      {["Type", "Name / Host", "Value / Points To"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dnsTab === "cname" ? (
                      <tr>
                        <td className="px-4 py-3 font-bold text-blue-600 font-mono">CNAME</td>
                        <td className="px-4 py-3 font-mono text-gray-900 flex items-center">
                          {setupInfo?.cnameHost || "@"}
                          <CopyBtn value={setupInfo?.cnameHost || "@"} />
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-900">
                          <span className="flex items-center">
                            snipr.sh <CopyBtn value="snipr.sh" />
                          </span>
                        </td>
                      </tr>
                    ) : dnsTab === "a" ? (
                      <tr>
                        <td className="px-4 py-3 font-bold text-emerald-600 font-mono">A</td>
                        <td className="px-4 py-3 font-mono text-gray-900 flex items-center">
                          @ <CopyBtn value="@" />
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-900">
                          <span className="flex items-center">
                            104.218.51.234 <CopyBtn value="104.218.51.234" />
                          </span>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="px-4 py-3 font-bold text-purple-600 font-mono">TXT</td>
                        <td className="px-4 py-3 font-mono text-gray-900">
                          <span className="flex items-center text-[11px]">
                            {setupInfo?.txtHost || `_snipr-verify.${domain.domain}`}
                            <CopyBtn value={setupInfo?.txtHost || `_snipr-verify.${domain.domain}`} />
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-900">
                          <span className="flex items-center text-[11px] break-all">
                            {setupInfo?.txtValue || "Loading..."}
                            {setupInfo?.txtValue && <CopyBtn value={setupInfo.txtValue} />}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tip box */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                <Globe className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Which method should I use?</p>
                  <p className="mt-1"><strong>CNAME</strong> — Best for subdomains (go.example.com, links.example.com)</p>
                  <p className="mt-0.5"><strong>A Record</strong> — Best for root/apex domains (example.com, mysite.art)</p>
                  <p className="mt-0.5"><strong>TXT</strong> — Alternative verification if CNAME/A isn't possible</p>
                  <p className="mt-1.5 text-blue-500">Go to your registrar (Cloudflare, GoDaddy, Namecheap) → DNS settings → Add the record. Propagation takes 5 min – 48 hours.</p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] transition-all"
                >
                  I've Added the Record <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Verify Domain */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h3 className="text-xl font-bold text-gray-900">Verify Your Domain</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Let's check if your DNS records are configured correctly for <span className="font-semibold text-gray-900">{domain.domain}</span>
                </p>
              </div>

              {/* Check DNS button */}
              <div className="flex justify-center">
                <button
                  onClick={checkDns}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  {loading ? "Checking..." : "Check DNS Status"}
                </button>
              </div>

              {/* DNS Results */}
              {dnsResult && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`flex items-start gap-2 p-3 rounded-lg border ${dnsResult.cnameOk ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                      {dnsResult.cnameOk
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        : <WifiOff className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
                      <div className="text-xs">
                        <p className="font-semibold text-gray-900">CNAME</p>
                        <p className="text-gray-500 mt-0.5">
                          {dnsResult.cnameOk ? `→ ${dnsResult.cnameTarget}` :
                           dnsResult.cnameTarget ? `${dnsResult.cnameTarget}` : "Not found"}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-start gap-2 p-3 rounded-lg border ${dnsResult.aRecordOk ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                      {dnsResult.aRecordOk
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        : <WifiOff className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
                      <div className="text-xs">
                        <p className="font-semibold text-gray-900">A Record</p>
                        <p className="text-gray-500 mt-0.5">
                          {dnsResult.aRecordOk ? `→ ${dnsResult.aRecordIp}` :
                           dnsResult.aRecordIp ? `${dnsResult.aRecordIp}` : "Not found"}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-start gap-2 p-3 rounded-lg border ${dnsResult.txtOk ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                      {dnsResult.txtOk
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        : <WifiOff className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
                      <div className="text-xs">
                        <p className="font-semibold text-gray-900">TXT</p>
                        <p className="text-gray-500 mt-0.5">
                          {dnsResult.txtOk ? "Verified" :
                           dnsResult.txtFound ? "Mismatch" : "Not found"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {dnsResult.ready ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      DNS configured correctly! Click "Verify Now" to complete setup.
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600">
                      DNS not propagated yet. This can take 5 minutes to 48 hours. Try again later.
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">{error}</div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                {dnsResult?.ready && (
                  <button
                    onClick={() => verifyDomain(false)}
                    disabled={verifying}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-all"
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Verify Now
                  </button>
                )}
                {mode === "admin" && (
                  <button
                    onClick={() => verifyDomain(true)}
                    disabled={verifying}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Force Verify (Admin)
                  </button>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to DNS
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-all"
                >
                  I'll verify later
                </button>
              </div>
            </div>
          )}

          {/* Step 4: All Set */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <PartyPopper className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">All Set!</h3>
                <p className="text-gray-500 mt-1">
                  <span className="font-semibold text-gray-900">{domain.domain}</span> is verified and ready to use.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What's Next?</p>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Link2 className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Create short links</p>
                    <p className="text-xs text-gray-500">Go to Links and create a new short link. Select <span className="font-semibold">{domain.domain}</span> as the domain.</p>
                  </div>
                </div>
                <div className="mt-3 p-2.5 rounded-lg bg-white border border-gray-200 font-mono text-sm text-center text-gray-700">
                  https://{domain.domain}/<span className="text-blue-600">your-slug</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
