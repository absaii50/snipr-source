"use client";
import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetDomains, useDeleteDomain, getGetDomainsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Globe, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Settings2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import DomainSetupWizard from "@/components/DomainSetupWizard";

export default function Domains() {
  const { data: domains, isLoading } = useGetDomains();
  const deleteMutation = useDeleteDomain();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDomain, setWizardDomain] = useState<{ id: string; domain: string; verified: boolean; purpose?: string } | null>(null);

  const openNewWizard = () => { setWizardDomain(null); setWizardOpen(true); };
  const openSetupWizard = (d: any) => { setWizardDomain({ id: d.id, domain: d.domain, verified: d.verified, purpose: d.purpose }); setWizardOpen(true); };
  const closeWizard = () => { setWizardOpen(false); setWizardDomain(null); };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this custom domain? This might break existing links using it.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetDomainsQueryKey() }); toast({ title: "Domain removed" }); },
      onError: () => toast({ title: "Error removing domain", variant: "destructive" })
    });
  };

  const verified = domains?.filter((d) => d.verified) ?? [];
  const pending = domains?.filter((d) => !d.verified) ?? [];

  return (
    <ProtectedLayout>
      <div className="px-6 lg:px-8 py-6 max-w-[900px] mx-auto w-full">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-[#0A0A0A]">Custom Domains</h1>
            <p className="text-[13px] text-[#9CA3AF] mt-1">Use your own branding for short links</p>
          </div>
          <button onClick={openNewWizard}
            className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1F1F1F] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add Domain
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#D1D5DB]" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!domains || domains.length === 0) && (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-[#ECEDF0]">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-5">
              <Globe className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-[#0A0A0A] mb-1">No custom domains</h3>
            <p className="text-[13px] text-[#9CA3AF] max-w-sm mb-5">
              Add your own domain to build brand trust and increase click-through rates on your short links.
            </p>
            <button onClick={openNewWizard}
              className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all">
              <Plus className="w-4 h-4" /> Add your first domain
            </button>
          </div>
        )}

        {/* Domain List */}
        {!isLoading && domains && domains.length > 0 && (
          <div className="space-y-3">
            {/* Pending domains */}
            {pending.map((domain) => (
              <div key={domain.id} className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-bold text-[#0A0A0A] truncate">{domain.domain}</h3>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            <AlertCircle className="w-3 h-3" /> PENDING
                          </span>
                        </div>
                        <p className="text-[12px] text-[#9CA3AF]">Added {format(new Date(domain.createdAt), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openSetupWizard(domain)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white text-[12px] font-semibold transition-all active:scale-[0.97]">
                        <Settings2 className="w-3.5 h-3.5" /> Complete Setup
                      </button>
                      <button onClick={() => handleDelete(domain.id)} disabled={deleteMutation.isPending}
                        className="p-2 rounded-xl hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-700">DNS configuration required. Click "Complete Setup" to see instructions.</p>
                </div>
              </div>
            ))}

            {/* Verified domains */}
            {verified.map((domain) => (
              <div key={domain.id} className="bg-white border border-[#ECEDF0] rounded-2xl p-5 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-bold text-[#0A0A0A] truncate">{domain.domain}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED
                        </span>
                      </div>
                      <p className="text-[12px] text-[#9CA3AF]">Added {format(new Date(domain.createdAt), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-xl hover:bg-[#F3F4F6] text-[#D1D5DB] hover:text-[#6B7280] transition-all">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => handleDelete(domain.id)} disabled={deleteMutation.isPending}
                      className="p-2 rounded-xl hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Domain Setup Wizard */}
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
