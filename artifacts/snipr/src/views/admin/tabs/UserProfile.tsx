"use client";
import { useEffect, useState } from "react";
import {
  X, Link2, BarChart3, TrendingDown, AlertCircle,
  Clock, ToggleLeft, Calendar, ChevronRight,
  MousePointerClick, Users, Globe, Smartphone,
  Crown, Check, Loader2,
} from "lucide-react";
import { apiFetch, fmtDate, fmtNum } from "../utils";

interface LinkRow {
  id: string;
  slug: string;
  destination_url: string;
  title: string | null;
  enabled: boolean;
  created_at: string;
  expires_at: string | null;
  click_limit: number | null;
  total_clicks: number;
  unique_clicks: number;
  last_click_at: string | null;
  top_country: string | null;
  top_device: string | null;
  top_referrer: string | null;
}

interface UserAnalytics {
  user: {
    id: string; name: string; email: string; plan: string;
    suspended_at: string | null; created_at: string;
    workspace_name: string; workspace_slug: string;
  };
  allLinks: LinkRow[];
  topLinks: LinkRow[];
  bottomLinks: LinkRow[];
  zeroClickLinks: LinkRow[];
  disabledLinks: LinkRow[];
  expiredLinks: LinkRow[];
  recentLinks: LinkRow[];
  recentlyClicked: LinkRow[];
  summary: {
    totalLinks: number; totalClicks: number;
    activeLinks: number; zeroClickCount: number;
  };
}

type ActiveTab = "top" | "zero" | "recent" | "disabled" | "all";

function PlanBadge({ plan }: { plan: string }) {
  const cfg = plan === "business" ? "bg-purple-50 text-purple-700 border-purple-200"
    : plan === "pro" ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg} capitalize`}>
      {plan}
    </span>
  );
}

function LinkCard({ link }: { link: LinkRow }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8F8FC] rounded-xl transition-colors">
      <div className="w-8 h-8 bg-[#EEF3F7] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Link2 className="w-3.5 h-3.5 text-[#728DA7]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs font-semibold text-[#0A0A0A]">
            snipr.sh/{link.slug}
          </span>
          {!link.enabled && (
            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-medium">off</span>
          )}
          {link.expires_at && new Date(link.expires_at) < new Date() && (
            <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">expired</span>
          )}
        </div>
        <a
          href={link.destination_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#8888A0] hover:text-[#728DA7] truncate block max-w-[280px] transition-colors"
        >
          {link.destination_url}
        </a>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#8888A0]">
          <span className="flex items-center gap-1 font-semibold text-[#728DA7]">
            <MousePointerClick className="w-3 h-3" />
            {fmtNum(link.total_clicks)} clicks
          </span>
          {link.unique_clicks > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {fmtNum(link.unique_clicks)} unique
            </span>
          )}
          {link.top_country && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {link.top_country}
            </span>
          )}
          {link.top_device && (
            <span className="flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              {link.top_device}
            </span>
          )}
          {link.last_click_at && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {fmtDate(link.last_click_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const PLANS = [
  { id: "free", label: "Free", color: "bg-gray-100 text-gray-600 border-gray-200", desc: "Basic access, limited links" },
  { id: "pro", label: "Pro", color: "bg-blue-50 text-blue-700 border-blue-200", desc: "Unlimited links, analytics" },
  { id: "business", label: "Business", color: "bg-purple-50 text-purple-700 border-purple-200", desc: "Custom domains, AI insights" },
] as const;

export default function UserProfile({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("top");
  const [changingPlan, setChangingPlan] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSuccess, setPlanSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/admin/users/${userId}/analytics`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function changePlan(newPlan: string) {
    if (!data) return;
    setPlanSaving(true);
    try {
      await apiFetch(`/admin/users/${userId}/plan`, { method: "PATCH", body: JSON.stringify({ plan: newPlan }) });
      setData((d) => d ? { ...d, user: { ...d.user, plan: newPlan } } : d);
      setPlanSuccess(true);
      setTimeout(() => { setPlanSuccess(false); setChangingPlan(false); }, 1500);
    } finally {
      setPlanSaving(false);
    }
  }

  const tabs: { id: ActiveTab; label: string; count?: number }[] = data ? [
    { id: "top", label: "Top Links", count: data.topLinks.length },
    { id: "zero", label: "No Clicks", count: data.zeroClickLinks.length },
    { id: "recent", label: "Recent", count: data.recentLinks.length },
    { id: "disabled", label: "Disabled", count: data.disabledLinks.length },
    { id: "all", label: "All Links", count: data.allLinks.length },
  ] : [];

  const displayLinks = data ? (
    activeTab === "top" ? data.topLinks :
    activeTab === "zero" ? data.zeroClickLinks :
    activeTab === "recent" ? data.recentLinks :
    activeTab === "disabled" ? data.disabledLinks :
    data.allLinks
  ) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[540px] h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#E4E4EC] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-[#8888A0]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">User Analytics</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#F4F4F6] text-[#8888A0] hover:text-[#0A0A0A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#728DA7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-[#8888A0] text-sm">
            Failed to load user data
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* User info */}
            <div className="px-6 py-5 bg-[#F8F8FC] border-b border-[#E4E4EC]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E8EEF4] flex items-center justify-center text-[#728DA7] text-lg font-bold shrink-0">
                  {data.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-base font-bold text-[#0A0A0A] truncate">{data.user.name}</h2>
                    <PlanBadge plan={data.user.plan} />
                    {data.user.suspended_at && (
                      <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-medium border border-red-200">suspended</span>
                    )}
                  </div>
                  <p className="text-xs text-[#8888A0] truncate">{data.user.email}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#8888A0]">
                    <Calendar className="w-3 h-3" />
                    Joined {fmtDate(data.user.created_at)}
                    {data.user.workspace_name && (
                      <>
                        <span className="text-[#D0D0D8]">·</span>
                        <span>Workspace: {data.user.workspace_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan management */}
              <div className="mt-3">
                {!changingPlan ? (
                  <button
                    onClick={() => setChangingPlan(true)}
                    className="flex items-center gap-1.5 text-xs text-[#728DA7] hover:text-[#4A7A94] font-medium transition-colors"
                  >
                    <Crown className="w-3 h-3" />
                    Change plan
                  </button>
                ) : (
                  <div className="bg-white border border-[#E4E4EC] rounded-xl p-3 mt-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#0A0A0A]">Change Plan</span>
                      {!planSaving && !planSuccess && (
                        <button onClick={() => setChangingPlan(false)} className="text-[10px] text-[#8888A0] hover:text-[#3A3A3E]">Cancel</button>
                      )}
                    </div>
                    {planSuccess ? (
                      <div className="flex items-center gap-2 text-green-600 text-xs py-1">
                        <Check className="w-4 h-4" />
                        Plan updated successfully!
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {PLANS.map((p) => (
                          <button
                            key={p.id}
                            disabled={planSaving || data.user.plan === p.id}
                            onClick={() => changePlan(p.id)}
                            className={`flex-1 flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-center transition-all disabled:cursor-not-allowed ${
                              data.user.plan === p.id
                                ? `${p.color} opacity-60 ring-2 ring-offset-1 ring-current`
                                : `border-[#E4E4EC] hover:border-[#728DA7] hover:bg-[#F8F8FC] text-[#3A3A3E]`
                            }`}
                          >
                            {planSaving && data.user.plan !== p.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <span className={`text-[10px] font-bold capitalize ${data.user.plan === p.id ? "" : ""}`}>{p.label}</span>
                            )}
                            <span className="text-[9px] text-[#8888A0] leading-tight">{p.desc}</span>
                            {data.user.plan === p.id && <span className="text-[8px] font-bold uppercase tracking-wide">Current</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {[
                  { label: "Links", value: data.summary.totalLinks, icon: Link2, color: "text-[#728DA7]", bg: "bg-[#EEF3F7]" },
                  { label: "Clicks", value: data.summary.totalClicks, icon: BarChart3, color: "text-[#2E9A72]", bg: "bg-[#E6F7F1]" },
                  { label: "Active", value: data.summary.activeLinks, icon: TrendingDown, color: "text-[#7C5CC4]", bg: "bg-[#F0EBF9]" },
                  { label: "0 Clicks", value: data.summary.zeroClickCount, icon: AlertCircle, color: "text-[#DC6B2F]", bg: "bg-[#FEF0E7]" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-white rounded-xl border border-[#E4E4EC] p-3 text-center">
                    <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center mx-auto mb-1.5`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    <div className="text-base font-bold text-[#0A0A0A] tabular-nums">{fmtNum(value)}</div>
                    <div className="text-[10px] text-[#8888A0]">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[#E4E4EC] px-4 pt-3 flex gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-medium whitespace-nowrap transition-all border-b-2 ${
                    activeTab === t.id
                      ? "text-[#4A7A94] border-[#728DA7] bg-[#F0F5F8]"
                      : "text-[#8888A0] border-transparent hover:text-[#3A3A3E]"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === t.id ? "bg-[#728DA7] text-white" : "bg-[#F4F4F6] text-[#8888A0]"
                    }`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Link list */}
            <div className="flex-1 p-3">
              {displayLinks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-10 h-10 bg-[#F4F4F6] rounded-full flex items-center justify-center mb-3">
                    <ToggleLeft className="w-5 h-5 text-[#8888A0]" />
                  </div>
                  <p className="text-sm text-[#8888A0]">No links in this category</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {displayLinks.map((link) => (
                    <LinkCard key={link.id} link={link} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
