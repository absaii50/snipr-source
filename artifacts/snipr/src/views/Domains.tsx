"use client";
import { useState, type FormEvent } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetDomains, useCreateDomain, useDeleteDomain, getGetDomainsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Globe, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Settings2 } from "lucide-react";
import { format } from "date-fns";
import DomainSetupWizard from "@/components/DomainSetupWizard";

export default function Domains() {
  const { data: domains, isLoading } = useGetDomains();
  const createMutation = useCreateDomain();
  const deleteMutation = useDeleteDomain();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isAdding, setIsAdding] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [wizardDomain, setWizardDomain] = useState<{ id: string; domain: string; verified: boolean } | null>(null);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    createMutation.mutate({ data: { domain: newDomain } }, {
      onSuccess: (created: any) => {
        queryClient.invalidateQueries({ queryKey: getGetDomainsQueryKey() });
        setNewDomain("");
        setIsAdding(false);
        setWizardDomain(created);
      },
      onError: (err: any) => {
        toast({ title: "Failed to add domain", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this custom domain? This might break existing links using it.")) return;
    
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDomainsQueryKey() });
        toast({ title: "Domain removed" });
      },
      onError: () => toast({ title: "Error removing domain", variant: "destructive" })
    });
  };

  return (
    <ProtectedLayout>
      <div className="p-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-extrabold tracking-tight">Custom Domains</h1>
            <p className="text-muted-foreground mt-1 text-lg">Use your own branding for short links.</p>
          </div>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
              <Plus className="w-5 h-5 mr-2" /> Add Domain
            </Button>
          )}
        </div>

        {isAdding && (
          <Card className="mb-8 p-6 rounded-2xl border-primary/20 shadow-lg shadow-primary/5 animate-in slide-in-from-top-4 fade-in duration-300">
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div>
                <label htmlFor="domain" className="block text-sm font-semibold mb-2">Domain Name</label>
                <Input 
                  id="domain"
                  autoFocus
                  placeholder="go.yourcompany.com" 
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="max-w-md h-12 rounded-xl text-base bg-background shadow-sm"
                  disabled={createMutation.isPending}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={createMutation.isPending || !newDomain.trim()} className="rounded-xl h-11 px-6">
                  {createMutation.isPending ? "Adding..." : "Add Domain"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} disabled={createMutation.isPending} className="rounded-xl h-11">
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
          ) : !domains || domains.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center bg-card rounded-3xl border border-border shadow-sm">
              <div className="w-20 h-20 bg-primary/5 text-primary rounded-full flex items-center justify-center mb-6">
                <Globe className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold font-display mb-2">No custom domains</h3>
              <p className="text-muted-foreground max-w-md mb-6">Add your first custom domain to build brand trust and increase click-through rates.</p>
              <Button onClick={() => setIsAdding(true)} variant="outline" className="rounded-xl h-11 px-6">
                Add Your First Domain
              </Button>
            </div>
          ) : (
            domains.map((domain) => (
              <Card key={domain.id} className="p-6 rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl shrink-0 mt-1 md:mt-0 ${domain.verified ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold font-display">{domain.domain}</h3>
                        {domain.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                            <AlertCircle className="w-3.5 h-3.5" /> Unverified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Added on {format(new Date(domain.createdAt), "MMMM d, yyyy")}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 self-end md:self-auto">
                    <Button 
                      variant="ghost" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => handleDelete(domain.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove
                    </Button>
                  </div>
                </div>

                {!domain.verified && (
                  <div className="mt-6 p-4 bg-[#2E2E35] rounded-xl border border-border/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground text-sm">DNS setup required</p>
                        <p className="text-muted-foreground text-xs">Configure your DNS records to verify this domain.</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl shrink-0"
                      onClick={() => setWizardDomain(domain)}
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Complete Setup
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {wizardDomain && (
        <DomainSetupWizard
          open={true}
          onClose={() => setWizardDomain(null)}
          domain={wizardDomain}
          mode="user"
          onVerified={() => queryClient.invalidateQueries({ queryKey: getGetDomainsQueryKey() })}
        />
      )}
    </ProtectedLayout>
  );
}
