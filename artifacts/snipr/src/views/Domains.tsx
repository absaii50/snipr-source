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
      className="inline-flex items-center gap-1 ml-1 text-amber-600 hover:text-amber-800 transition-colors"
      title="Copy"
    >
      <span className="font-mono text-[11px]">{value}</span>
      {copied
        ? <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
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

  const verified = domains?.filter((d) => d.verified) ?? [];
  const pending = domains?.filter((d) => !d.verified) ?? [];

  return (
    <ProtectedLayout>
      <div className="px-6 lg:px-8 py-6 max-w-[900px] mx-auto w-full">

        <div className="flex items-start justify-between gap-4 mb-6 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-[#0A0A0A]">Custom Domains</h1>
            <p className="text-[13px] text-[#9CA3AF] mt-1">Use your own domain for branded short links</p>
          </div>
          <button
            onClick={openNewWizard}
            className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shrink-0 sf-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" /> Add Domain
          </button>
        </div>

        {!isLoading && (!domains || domains.length === 0) && (
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: "60ms" }}>
            <div className="py-16 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-[#ECEDF0] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-indigo-50/30 pointer-events-none" />
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-5 shadow-sm">
                  <Globe className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-[#0A0A0A] mb-1">No custom domains yet</h3>
                <p className="text-[13px] text-[#9CA3AF] max-w-sm mb-5">
                  Use your own domain for short links — like <span className="font-mono text-[#6B7280] bg-[#F1F5F9] px-1.5 py-0.5 rounded">go.yourcompany.com/launch</span>
                </p>
                <button
                  onClick={openNewWizard}
                  className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all sf-btn-primary"
                >
                  <Plus className="w-4 h-4" /> Add your first domain
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { step: "1", title: "Enter your domain", desc: "Type your domain or subdomain (e.g. go.company.com)", icon: Globe, color: "from-blue-50 to-blue-100", iconColor: "text-blue-500" },
                { step: "2", title: "Add a DNS record", desc: "Add one CNAME or A record at your registrar", icon: Shield, color: "from-amber-50 to-amber-100", iconColor: "text-amber-500" },
                { step: "3", title: "Start using it", desc: "Create short links and pick your domain", icon: Zap, color: "from-emerald-50 to-emerald-100", iconColor: "text-emerald-500" },
              ].map((item) => (
                <div key={item.step} className="p-4 bg-white rounded-xl border border-[#ECEDF0] text-center sf-card-hover">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-3`}>
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <p className="text-[13px] font-semibold text-[#0A0A0A] mb-1">{item.title}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#D1D5DB]" />
          </div>
        )}

        {!isLoading && domains && domains.length > 0 && (
          <div className="space-y-3 animate-fade-up" style={{ animationDelay: "60ms" }}>

            {pending.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {pending.length} pending setup
                </p>
                <div className="space-y-2">
                  {pending.map((domain, i) => (
                    <div key={domain.id} className="bg-white border border-amber-200/80 rounded-2xl overflow-hidden sf-card-hover animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center shrink-0">
                              <Globe className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-[15px] font-bold text-[#0A0A0A] truncate">{domain.domain}</h3>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">
                                  <AlertCircle className="w-3 h-3" /> PENDING
                                </span>
                              </div>
                              <p className="text-[12px] text-[#9CA3AF]">Added {format(new Date(domain.createdAt), "MMM d, yyyy")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => openSetupWizard(domain)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white text-[12px] font-semibold transition-all active:scale-[0.97]"
                            >
                              <Settings2 className="w-3.5 h-3.5" /> Complete Setup
                            </button>
                            <button
                              onClick={() => handleDelete(domain.id)}
                              disabled={deleteMutation.isPending}
                              className="p-2 rounded-xl hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3 bg-amber-50/60 border-t border-amber-100">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-amber-700 space-y-0.5">
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
                          className="mt-2 text-[11px] font-semibold text-amber-700 hover:text-amber-900 transition-colors inline-flex items-center gap-1"
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
                  <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide mb-2 mt-4 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {verified.length} active
                  </p>
                )}
                <div className="space-y-2">
                  {verified.map((domain, i) => (
                    <div key={domain.id} className="bg-white border border-[#ECEDF0] rounded-2xl p-5 sf-card-hover animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-[15px] font-bold text-[#0A0A0A] truncate">{domain.domain}</h3>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                                <CheckCircle2 className="w-3 h-3" /> ACTIVE
                              </span>
                            </div>
                            <p className="text-[12px] text-[#9CA3AF]">
                              Connected {format(new Date(domain.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl hover:bg-[#F3F4F6] text-[#D1D5DB] hover:text-[#6B7280] transition-all"
                            title="Test domain"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDelete(domain.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-xl hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 transition-all"
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
