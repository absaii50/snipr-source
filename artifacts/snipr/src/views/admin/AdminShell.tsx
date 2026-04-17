"use client";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, Link2, Globe, BarChart3,
  CreditCard, FileText, Sparkles, Settings, LogOut, ShieldCheck,
  ChevronRight, Menu, X, BookOpen, Mail, ScrollText, Bell, Search,
  LifeBuoy,
} from "lucide-react";
import { apiFetch } from "./utils";
import CommandPalette from "./CommandPalette";
import NotificationsDropdown from "./NotificationsDropdown";

export type AdminTab =
  | "overview" | "users" | "links" | "domains"
  | "analytics" | "plans" | "reports" | "email" | "support" | "ai" | "audit" | "settings" | "guide";

const NAV: { id: AdminTab; label: string; icon: React.ElementType; divider?: boolean }[] = [
  { id: "overview",  label: "Overview",    icon: LayoutDashboard },
  { id: "users",     label: "Users",       icon: Users },
  { id: "links",     label: "Links",       icon: Link2 },
  { id: "domains",   label: "Domains",     icon: Globe },
  { id: "analytics", label: "Analytics",   icon: BarChart3 },
  { id: "plans",     label: "Plans",       icon: CreditCard },
  { id: "reports",   label: "Reports",     icon: FileText },
  { id: "email",     label: "Email",       icon: Mail },
  { id: "support",   label: "Support",     icon: LifeBuoy },
  { id: "ai",        label: "AI Insights", icon: Sparkles },
  { id: "audit",     label: "Audit Log",   icon: ScrollText },
  { id: "settings",  label: "Settings",    icon: Settings },
  { id: "guide",     label: "How-To Guide", icon: BookOpen },
];

const TAB_TITLES: Record<AdminTab, { title: string; sub: string }> = {
  overview:  { title: "Platform Overview",   sub: "Real-time platform statistics" },
  users:     { title: "Users",               sub: "Manage all registered accounts" },
  links:     { title: "Links",               sub: "All short links across the platform" },
  domains:   { title: "Domains",             sub: "Custom domains connected by users" },
  analytics: { title: "Analytics",           sub: "Platform-wide traffic and engagement" },
  plans:     { title: "Plans & Subscriptions", sub: "User plan distribution overview" },
  reports:   { title: "Reports & Logs",      sub: "Recent platform activity" },
  email:     { title: "Email",              sub: "Email logs, verification, and delivery" },
  support:   { title: "Support Tickets",     sub: "Manage customer support conversations" },
  ai:        { title: "AI Insights",         sub: "Intelligent platform summaries" },
  audit:     { title: "Audit Log",           sub: "Track all admin actions and changes" },
  settings:  { title: "Settings",            sub: "Platform configuration and controls" },
  guide:     { title: "How-To Guide",        sub: "Setup instructions and platform documentation" },
};

interface Props {
  tab: AdminTab;
  setTab: (t: AdminTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function AdminShell({ tab, setTab, onLogout, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const pollNotifications = useCallback(() => {
    apiFetch("/admin/notifications")
      .then((d: any) => {
        const count = (d?.newSignups?.length || 0) + (d?.failedEmails?.length || 0);
        setNotifCount(count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    pollNotifications();
    const interval = setInterval(pollNotifications, 60000);
    return () => clearInterval(interval);
  }, [pollNotifications]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleLogout() {
    await apiFetch("/admin/logout", { method: "POST" });
    onLogout();
  }

  const { title, sub } = TAB_TITLES[tab];

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed h-full z-30 flex flex-col bg-white border-r border-[#E2E8F0] transition-transform duration-200
        w-56 lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#0A0A0A] leading-tight">Snipr Admin</div>
              <div className="text-[10px] text-[#8888A0] leading-tight">Platform Management</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all group ${
                tab === id
                  ? "bg-[#E8EEF4] text-[#4A7A94]"
                  : id === "guide"
                  ? "text-[#3A3A3E] hover:bg-amber-50 hover:text-amber-700"
                  : "text-[#3A3A3E] hover:bg-[#F4F4F6] hover:text-[#0A0A0A]"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${
                tab === id ? "text-[#728DA7]" :
                id === "guide" ? "text-amber-500 group-hover:text-amber-600" :
                "text-[#8888A0] group-hover:text-[#728DA7]"
              } transition-colors`} />
              <span className="truncate">{label}</span>
              {tab === id && <ChevronRight className="w-3 h-3 ml-auto text-[#728DA7]" />}
            </button>
          ))}
        </nav>

        <div className="px-2 pb-3 pt-2 border-t border-[#E2E8F0]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-[#3A3A3E] hover:bg-red-50 hover:text-red-600 transition-all group"
          >
            <LogOut className="w-4 h-4 text-[#8888A0] group-hover:text-red-500 transition-colors shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen lg:ml-56">
        <header className="bg-white border-b border-[#E2E8F0] px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-[#F4F4F6] transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-[#3A3A3E]" /> : <Menu className="w-5 h-5 text-[#3A3A3E]" />}
            </button>
            <div>
              <h1 className="text-base font-bold text-[#0A0A0A] leading-tight">{title}</h1>
              <p className="text-xs text-[#8888A0] leading-tight">{sub}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F4F6] rounded-lg hover:bg-[#E8EEF4] transition-colors text-xs text-[#8888A0]"
              title="Search (⌘K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search...</span>
              <kbd className="ml-1 px-1.5 py-0.5 bg-white rounded text-[10px] border border-[#E2E8F0]">⌘K</kbd>
            </button>
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) setNotifCount(0); }}
                className="p-2 rounded-lg hover:bg-[#F4F4F6] transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4 text-[#8888A0]" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
              </button>
              <NotificationsDropdown open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F4F6] rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-[#3A3A3E] font-medium">Live</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#0A0A0A] flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={(t) => {
          const [tabPart, queryPart] = t.split("?");
          setTab(tabPart as AdminTab);
          if (queryPart) {
            // Push with query params for tabs that support it
            window.history.replaceState(null, "", `/admin/${tabPart}?${queryPart}`);
            // Dispatch custom event so the tab can pick up the search
            window.dispatchEvent(new CustomEvent("admin-search", { detail: queryPart }));
          }
          setCmdPaletteOpen(false);
        }}
        onAction={(action) => {
          setCmdPaletteOpen(false);
          if (action === "export-users") window.open(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/export/users`, "_blank");
          if (action === "export-links") window.open(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/export/links`, "_blank");
          if (action === "refresh-data") window.location.reload();
        }}
      />
    </div>
  );
}
