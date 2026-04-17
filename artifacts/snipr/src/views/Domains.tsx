"use client";
import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetDomains, useDeleteDomain, getGetDomainsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Plus, Trash2, CheckCircle2, AlertCircle, Loader2,
  Settings2, ExternalLink, ArrowRight, Copy, CheckCircle,
  Shield, Zap, BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import DomainSetupWizard from "@/components/DomainSetupWizard";

function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1 ml-1 hover:opacity-80 transition-colors"
      style={{ color: "#FB923C" }}
      title="Copy"
    >
      <span className="font-mono text-[11px]">{value}</span>
      {copied
        ? <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
        : <Copy className="w-3 h-3 shrink-0 opacity-60" />}
    </button>
  );
}

export default function Domains() {
  const { data: domains, isLoading } = useGetDomains();
  const deleteMutation = useDeleteDomain();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDomain, setWizardDomain] = useState<{ id: string; domain: string; verified: boolean; purpose?: string } | null>(null);

  const openNewWizard = () => { setWizardDomain(null); setWizardOpen(true); };
  const openSetupWizard = (d: any) => {
    setWizardDomain({ id: d.id, domain: d.domain, verified: d.verified, purpose: d.purpose });
    setWizardOpen(true);
  };
  const closeWizard = () => { setWizardOpen(false); setWizardDomain(null); };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this custom domain? Existing links using it will stop working.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDomainsQueryKey() });
        toast({ title: "Domain removed" });
      },
      onError: () => toast({ title: "Error removing domain", variant: "destructive" }),
    });
  };

  // Platform domains (added by admin) are only for link creation — don't show in this tab
  const userDomains = domains?.filter((d) => !d.isPlatformDomain) ?? [];
  const verified = userDomains.filter((d) => d.verified);
  const pending  = userDomains.filter((d) => !d.verified);

  return (
    <ProtectedLayout>
      <div className="px-6 lg:px-8 py-6 max-w-[900px] mx-auto w-full">

        <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold tracking-tight text-[#FAFAFA]">Custom Domains</h1>
              <p className="text-[13px] mt-0.5 text-[#A1A1AA]">Use your own domain for branded short links</p>
            </div>
          </div>
          <button
            onClick={openNewWizard}
            className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-all shrink-0 hover:opacity-90 active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Domain
          </button>
        </div>

        {!isLoading && (!domains || domains.length === 0) && (
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: "60ms" }}>
            <div className="py-16 flex flex-col items-center justify-center text-center rounded-xl relative overflow-hidden bg-[#18181B] border border-[#27272A]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/5 via-transparent to-[#7C3AED]/5 pointer-events-none" />
              <div className="relative">
                <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-5" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
                  <Globe className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold mb-1 text-[#FAFAFA]">No custom domains yet</h3>
                <p className="text-[13px] max-w-sm mb-5 text-[#71717A]">
                  Use your own domain for short links — like <span className="font-mono px-1.5 py-0.5 rounded-lg text-[#A1A1AA] bg-[#27272A]">go.yourcompany.com/launch</span>
                </p>
                <button
                  onClick={openNewWizard}
                  className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}
                >
                  <Plus className="w-4 h-4" /> Add your first domain
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { step: "1", title: "Enter your domain", desc: "Type your domain or subdomain (e.g. go.company.com)", icon: Globe, color: "from-blue-900/30 to-blue-800/20", iconColor: "text-blue-400" },
                { step: "2", title: "Add a DNS record", desc: "Add one CNAME or A record at your registrar", icon: Shield, color: "from-amber-900/30 to-amber-800/20", iconColor: "text-amber-400" },
                { step: "3", title: "Start using it", desc: "Create short links and pick your domain", icon: Zap, color: "from-emerald-900/30 to-emerald-800/20", iconColor: "text-emerald-400" },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-4 rounded-xl text-center transition-all hover:-translate-y-0.5 bg-[#18181B] border border-[#27272A]"
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-3`}>
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <p className="text-[13px] font-semibold mb-1 text-[#FAFAFA]">{item.title}</p>
                  <p className="text-[11px] text-[#A1A1AA]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#3F3F46]" />
          </div>
        )}

        {!isLoading && domains && domains.length > 0 && (
          <div className="space-y-3 animate-fade-up" style={{ animationDelay: "60ms" }}>

            {pending.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 text-[#A1A1AA]">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> {pending.length} pending setup
                </p>
                <div className="space-y-2">
                  {pending.map((domain, i) => (
                    <div
                      key={domain.id}
                      className="rounded-xl overflow-hidden transition-all hover:-translate-y-0.5 animate-fade-up bg-[#18181B] border border-[#F59E0B]/15"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/15 flex items-center justify-center shrink-0">
                              <Globe className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-[15px] font-bold truncate text-[#FAFAFA]">{domain.domain}</h3>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[#F59E0B]/10 text-[#FB923C]">
                                  <AlertCircle className="w-3 h-3" /> PENDING
                                </span>
                              </div>
                              <p className="text-[12px] text-[#A1A1AA]">Added {format(new Date(domain.createdAt), "MMM d, yyyy")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => openSetupWizard(domain)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-[12px] font-semibold transition-all active:scale-[0.97] hover:opacity-90"
                              style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}
                            >
                              <Settings2 className="w-3.5 h-3.5" /> Complete Setup
                            </button>
                            <button
                              onClick={() => handleDelete(domain.id)}
                              disabled={deleteMutation.isPending}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-[#3F3F46] hover:text-[#F87171] transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3 bg-[#F59E0B]/6 border-t border-[#F59E0B]/15">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-amber-400/80 space-y-0.5">
                            <p className="font-semibold">DNS record required at your registrar:</p>
                            <p>
                              {domain.domain.split(".").length <= 2
                                ? <>Add an <strong>A record</strong> with name <CopyText value="@" /> pointing to the IP shown in setup.</>
                                : <>Add a <strong>CNAME record</strong> with name <CopyText value={domain.domain.split(".").slice(0, -2).join(".")} /> pointing to the value shown in setup.</>
                              }
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => openSetupWizard(domain)}
                          className="mt-2 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
                        >
                          View full instructions <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verified.length > 0 && (
              <div>
                {pending.length > 0 && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 mt-4 flex items-center gap-1.5 text-[#A1A1AA]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {verified.length} active
                  </p>
                )}
                <div className="space-y-2">
                  {verified.map((domain, i) => (
                    <div
                      key={domain.id}
                      className="rounded-xl p-5 transition-all hover:-translate-y-0.5 animate-fade-up bg-[#18181B] border border-[#27272A]"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 border border-[#10B981]/15 flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-[15px] font-bold truncate text-[#FAFAFA]">{domain.domain}</h3>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[#10B981]/10 text-[#34D399]">
                                <CheckCircle2 className="w-3 h-3" /> ACTIVE
                              </span>
                            </div>
                            <p className="text-[12px] text-[#A1A1AA]">
                              Connected {format(new Date(domain.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-[#27272A] text-[#3F3F46] hover:text-[#A1A1AA] transition-all"
                            title="Test domain"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDelete(domain.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-[#3F3F46] hover:text-[#F87171] transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {wizardOpen && (
        <DomainSetupWizard
          open={wizardOpen}
          onClose={closeWizard}
          domain={wizardDomain}
          mode="user"
          onVerified={() => queryClient.invalidateQueries({ queryKey: getGetDomainsQueryKey() })}
          onDomainCreated={() => queryClient.invalidateQueries({ queryKey: getGetDomainsQueryKey() })}
        />
      )}
    </ProtectedLayout>
  );
}
