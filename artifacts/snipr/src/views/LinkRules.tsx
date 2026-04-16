"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetLink, useGetLinkRules, useSetLinkRules, getGetLinkRulesQueryKey, type CreateLinkRuleRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, GripVertical, Globe2, Smartphone, Shuffle, GitBranch, Loader2, Save, MapPin } from "lucide-react";

const RULE_TYPES = [
  { value: "geo", label: "Country Targeting", icon: Globe2, color: "text-[#728DA7] bg-[#728DA7]/10" },
  { value: "city", label: "City / Region", icon: MapPin, color: "text-teal-500 bg-teal-500/10" },
  { value: "device", label: "Device Redirect", icon: Smartphone, color: "text-green-500 bg-green-500/10" },
  { value: "ab", label: "A/B Test", icon: GitBranch, color: "text-purple-500 bg-purple-500/10" },
  { value: "rotator", label: "Rotator", icon: Shuffle, color: "text-orange-500 bg-orange-500/10" },
];

export default function LinkRules() {
  const rawParams = useParams();
  const id = (rawParams?.id as string) ?? "";
  const { data: link, isLoading: linkLoading } = useGetLink(id || "");
  const { data: fetchedRules, isLoading: rulesLoading } = useGetLinkRules(id || "");
  const setRulesMutation = useSetLinkRules();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rules, setRules] = useState<CreateLinkRuleRequest[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // New Rule State
  const [newType, setNewType] = useState<"geo" | "city" | "device" | "ab" | "rotator">("geo");
  const [newDest, setNewDest] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [geoCountries, setGeoCountries] = useState("");
  const [cityCities, setCityCities] = useState("");
  const [cityRegions, setCityRegions] = useState("");
  const [deviceMobile, setDeviceMobile] = useState(false);
  const [deviceTablet, setDeviceTablet] = useState(false);
  const [deviceDesktop, setDeviceDesktop] = useState(false);
  const [abWeight, setAbWeight] = useState("50");

  useEffect(() => {
    if (fetchedRules) {
      // Map API representation back to frontend state if needed
      setRules(fetchedRules.map(r => ({
        type: r.type as any,
        destinationUrl: r.destinationUrl,
        label: r.label || undefined,
        conditions: r.conditions as any,
        priority: r.priority
      })));
    }
  }, [fetchedRules]);

  const handleAddRule = () => {
    if (!newDest.trim()) {
      toast({ title: "Destination URL is required", variant: "destructive" });
      return;
    }

    let conditions: any = {};
    if (newType === "geo") {
      const list = geoCountries.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
      if (list.length === 0) { toast({ title: "Enter at least one country code", variant: "destructive" }); return; }
      conditions = { countries: list };
    } else if (newType === "city") {
      const cities = cityCities.split(",").map(s => s.trim()).filter(Boolean);
      const regions = cityRegions.split(",").map(s => s.trim()).filter(Boolean);
      if (cities.length === 0 && regions.length === 0) { toast({ title: "Enter at least one city or region", variant: "destructive" }); return; }
      conditions = { cities: cities.length > 0 ? cities : undefined, regions: regions.length > 0 ? regions : undefined };
    } else if (newType === "device") {
      const list = [];
      if (deviceMobile) list.push("mobile");
      if (deviceTablet) list.push("tablet");
      if (deviceDesktop) list.push("desktop");
      if (list.length === 0) { toast({ title: "Select at least one device type", variant: "destructive" }); return; }
      conditions = { devices: list };
    } else if (newType === "ab") {
      const weight = parseInt(abWeight);
      if (isNaN(weight) || weight <= 0 || weight > 100) { toast({ title: "Weight must be 1-100", variant: "destructive" }); return; }
      conditions = { weight };
    }

    const rule: CreateLinkRuleRequest = {
      type: newType,
      destinationUrl: newDest,
      label: newLabel.trim() || undefined,
      conditions,
      priority: rules.length // Append to bottom
    };

    setRules([...rules, rule]);
    setIsAdding(false);
    resetNewRule();
  };

  const resetNewRule = () => {
    setNewDest("");
    setNewLabel("");
    setGeoCountries("");
    setCityCities("");
    setCityRegions("");
    setDeviceMobile(false);
    setDeviceTablet(false);
    setDeviceDesktop(false);
    setAbWeight("50");
  };

  const handleRemoveRule = (index: number) => {
    const next = [...rules];
    next.splice(index, 1);
    setRules(next);
  };

  const handleMoveRule = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= rules.length) return;
    const next = [...rules];
    const temp = next[index];
    next[index] = next[index + direction];
    next[index + direction] = temp;
    // Re-assign priorities
    next.forEach((r, i) => r.priority = i);
    setRules(next);
  };

  const handleSaveAll = async () => {
    try {
      await setRulesMutation.mutateAsync({ id: id || "", data: { rules } });
      queryClient.invalidateQueries({ queryKey: getGetLinkRulesQueryKey(id || "") });
      toast({ title: "Routing rules saved successfully!" });
    } catch (err: any) {
      toast({ title: "Error saving rules", description: err.message, variant: "destructive" });
    }
  };

  const formatConditions = (r: CreateLinkRuleRequest) => {
    if (r.type === 'geo') return (r.conditions as any)?.countries?.join(', ');
    if (r.type === 'city') {
      const parts: string[] = [];
      const cities = (r.conditions as any)?.cities;
      const regions = (r.conditions as any)?.regions;
      if (cities?.length) parts.push(`Cities: ${cities.join(', ')}`);
      if (regions?.length) parts.push(`Regions: ${regions.join(', ')}`);
      return parts.join(' | ');
    }
    if (r.type === 'device') return (r.conditions as any)?.devices?.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
    if (r.type === 'ab') return `${(r.conditions as any)?.weight}% traffic`;
    return 'Any condition';
  };

  if (linkLoading || rulesLoading) {
    return (
      <ProtectedLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#818CF8]" />
        </div>
      </ProtectedLayout>
    );
  }

  if (!link) {
    return (
      <ProtectedLayout>
        <div className="p-8 text-center text-[#64748B] mt-20">Link not found.</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="p-8 pt-14 lg:pt-6 max-w-5xl mx-auto w-full">
        <Link href="/links" className="inline-flex items-center text-sm font-medium text-[#64748B] hover:text-[#E2E8F0] transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Links
        </Link>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-[14px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)" }}>
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-bold tracking-tight text-[#F1F5F9]">Smart Routing Rules</h1>
            <p className="text-[#64748B] text-sm">Configure conditional redirects for your link</p>
          </div>
        </div>

        <div
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 p-6 rounded-[20px]"
          style={{
            background: "rgba(17,24,39,0.65)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[#64748B] truncate">
              <span className="font-mono px-2 py-0.5 rounded-[8px] text-sm text-[#E2E8F0]" style={{ background: "rgba(255,255,255,0.05)" }}>/{link.slug}</span>
              <span className="text-sm">redirects to</span>
              <span className="text-sm truncate max-w-[300px]">{link.destinationUrl}</span>
            </div>
          </div>
          <div className="shrink-0 flex gap-3">
            <button
              onClick={handleSaveAll}
              disabled={setRulesMutation.isPending}
              className="inline-flex items-center h-11 px-6 text-white font-semibold rounded-[14px] hover:-translate-y-0.5 transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #818CF8, #A78BFA)",
                boxShadow: "0 4px 14px rgba(129,140,248,0.25)",
              }}
            >
              {setRulesMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Configuration
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-[14px] text-sm text-[#728DA7]" style={{ background: "rgba(114,141,167,0.05)", border: "1px solid rgba(114,141,167,0.2)" }}>
          <p><strong>Evaluation Order:</strong> Rules are evaluated from top to bottom. Country targeting matches first, then City/Region, then Device rules. If no targeting rules match, A/B and Rotator rules are evaluated as a group.</p>
        </div>

        <div className="space-y-4 mb-8">
          {rules.length === 0 ? (
            <div
              className="py-16 text-center rounded-[20px]"
              style={{
                background: "rgba(17,24,39,0.65)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "2px dashed rgba(255,255,255,0.1)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <Shuffle className="w-12 h-12 text-[#94A3B8]/30 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[#F1F5F9] mb-1">No rules active</h3>
              <p className="text-[#64748B] text-sm max-w-md mx-auto mb-4">All traffic currently goes to the default destination URL.</p>
            </div>
          ) : (
            rules.map((rule, index) => {
              const typeConfig = RULE_TYPES.find(t => t.value === rule.type)!;
              const Icon = typeConfig.icon;
              return (
                <div
                  key={index}
                  className="p-4 rounded-[20px] flex items-center gap-4 group hover:border-[#818CF8]/30 transition-colors"
                  style={{
                    background: "rgba(17,24,39,0.65)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
                  }}
                >
                  <div className="flex flex-col gap-1 items-center justify-center px-1">
                    <button onClick={() => handleMoveRule(index, -1)} disabled={index === 0} className="text-[#64748B] hover:text-[#E2E8F0] disabled:opacity-30 p-1">
                      <ArrowLeft className="w-3.5 h-3.5 rotate-90" />
                    </button>
                    <button onClick={() => handleMoveRule(index, 1)} disabled={index === rules.length - 1} className="text-[#64748B] hover:text-[#E2E8F0] disabled:opacity-30 p-1">
                      <ArrowLeft className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  </div>

                  <div className={`p-3 rounded-[14px] shrink-0 ${typeConfig.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold font-[family-name:var(--font-space-grotesk)] text-base text-[#F1F5F9]">{typeConfig.label}</span>
                        {rule.label && <span className="text-xs px-2 py-0.5 rounded-full text-[#94A3B8] truncate max-w-[120px]" style={{ background: "rgba(255,255,255,0.05)" }}>{rule.label}</span>}
                      </div>
                      <p className="text-sm font-medium text-[#818CF8] bg-[#818CF8]/5 inline-block px-2 py-0.5 rounded-md border border-[#818CF8]/10">
                        {formatConditions(rule)}
                      </p>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-xs text-[#64748B] uppercase tracking-wider font-semibold mb-0.5">Redirects To</span>
                      <span className="text-sm font-mono truncate text-[#E2E8F0]/80">{rule.destinationUrl}</span>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    <Button variant="ghost" size="icon" className="text-[#64748B] hover:text-destructive hover:bg-destructive/10 rounded-[14px]" onClick={() => handleRemoveRule(index)}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-8 rounded-[20px] text-[#64748B] hover:text-[#818CF8] transition-all flex items-center justify-center font-semibold"
            style={{
              background: "transparent",
              border: "2px dashed rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(129,140,248,0.5)";
              e.currentTarget.style.background = "rgba(129,140,248,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Plus className="w-5 h-5 mr-2" /> Add Routing Rule
          </button>
        ) : (
          <div
            className="p-6 rounded-[20px] animate-in slide-in-from-bottom-4 fade-in"
            style={{
              background: "rgba(17,24,39,0.65)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(129,140,248,0.3)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(129,140,248,0.08)",
            }}
          >
            <h3 className="text-xl font-[family-name:var(--font-space-grotesk)] font-bold mb-6 text-[#F1F5F9]">Configure New Rule</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#E2E8F0]">Rule Type</label>
                  <Select value={newType} onValueChange={(v: any) => { setNewType(v); resetNewRule(); }}>
                    <SelectTrigger className="rounded-[14px] h-11 text-[#E2E8F0]" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            <t.icon className="w-4 h-4 text-[#64748B]" /> {t.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#E2E8F0]">Label (Optional)</label>
                  <Input placeholder="e.g. European Traffic" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="rounded-[14px] h-11 text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-[#818CF8]/20" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>

              <div className="p-5 rounded-[14px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h4 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-4">Rule Conditions</h4>

                {newType === "geo" && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-sm font-semibold text-[#E2E8F0]">Target Countries</label>
                    <Input placeholder="US, GB, CA, AU" value={geoCountries} onChange={e => setGeoCountries(e.target.value)} className="rounded-[14px] h-11 text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-[#818CF8]/20" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                    <p className="text-xs text-[#64748B]">Enter 2-letter ISO country codes separated by commas.</p>
                  </div>
                )}

                {newType === "city" && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[#E2E8F0]">Target Cities</label>
                      <Input placeholder="New York, London, Tokyo" value={cityCities} onChange={e => setCityCities(e.target.value)} className="rounded-[14px] h-11 text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-[#818CF8]/20" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <p className="text-xs text-[#64748B]">Enter city names separated by commas. Matched against visitor GeoIP data.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[#E2E8F0]">Target Regions (optional)</label>
                      <Input placeholder="CA, TX, ON" value={cityRegions} onChange={e => setCityRegions(e.target.value)} className="rounded-[14px] h-11 text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-[#818CF8]/20" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <p className="text-xs text-[#64748B]">Enter region/state codes (e.g. CA for California). Used as fallback if no city match.</p>
                    </div>
                  </div>
                )}

                {newType === "device" && (
                  <div className="space-y-3 animate-in fade-in">
                    <label className="text-sm font-semibold mb-2 block text-[#E2E8F0]">Target Devices</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer p-3 rounded-[14px] hover:border-[#818CF8]/50 transition-colors" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Checkbox checked={deviceMobile} onCheckedChange={(c: boolean) => setDeviceMobile(c)} />
                        <span className="font-medium text-sm text-[#E2E8F0]">Mobile</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-3 rounded-[14px] hover:border-[#818CF8]/50 transition-colors" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Checkbox checked={deviceTablet} onCheckedChange={(c: boolean) => setDeviceTablet(c)} />
                        <span className="font-medium text-sm text-[#E2E8F0]">Tablet</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-3 rounded-[14px] hover:border-[#818CF8]/50 transition-colors" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Checkbox checked={deviceDesktop} onCheckedChange={(c: boolean) => setDeviceDesktop(c)} />
                        <span className="font-medium text-sm text-[#E2E8F0]">Desktop</span>
                      </label>
                    </div>
                  </div>
                )}

                {newType === "ab" && (
                  <div className="space-y-2 animate-in fade-in max-w-xs">
                    <label className="text-sm font-semibold text-[#E2E8F0]">Traffic Weight (%)</label>
                    <div className="relative">
                      <Input type="number" min="1" max="100" value={abWeight} onChange={e => setAbWeight(e.target.value)} className="rounded-[14px] h-11 pr-8 text-[#E2E8F0] focus:border-[#818CF8] focus:ring-[#818CF8]/20" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">%</span>
                    </div>
                    <p className="text-xs text-[#64748B]">Percentage of unrouted traffic to send here.</p>
                  </div>
                )}

                {newType === "rotator" && (
                  <div className="text-sm text-[#64748B] py-2 italic">
                    Rotator rules distribute traffic evenly among all active rotators. No specific conditions needed.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#E2E8F0]">Destination URL *</label>
                <Input placeholder="https://example.com/target" value={newDest} onChange={e => setNewDest(e.target.value)} className="rounded-[14px] h-12 text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-[#818CF8]/20" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(129,140,248,0.2)", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
              </div>

              <div className="flex gap-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  onClick={handleAddRule}
                  className="inline-flex items-center h-11 px-8 text-white font-semibold rounded-[14px] transition-all"
                  style={{
                    background: "linear-gradient(135deg, #818CF8, #A78BFA)",
                    boxShadow: "0 4px 14px rgba(129,140,248,0.25)",
                  }}
                >
                  Add Rule
                </button>
                <Button variant="ghost" onClick={() => setIsAdding(false)} className="rounded-[14px] h-11 text-[#64748B]">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
