"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  BarChart3,
  Globe,
  Zap,
  FolderOpen,
  TrendingUp,
  DollarSign,
  Sparkles,
  Users,
  Plug,
  Radio,
  CreditCard,
  Menu,
  X,
  Settings,
  ChevronDown,
  ShieldAlert,
  Megaphone,
  Search,
  Command,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SniprLogo } from "@/components/SniprLogo";

/* ─── NAV CONFIG ─── */
const NAV_GROUPS = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Live",      href: "/live",      icon: Radio },
    ],
  },
  {
    title: "Links",
    items: [
      { label: "Links",     href: "/links",     icon: LinkIcon },
      { label: "Analytics",  href: "/analytics",  icon: BarChart3 },
      { label: "Domains",    href: "/domains",    icon: Globe },
      { label: "Pixels",     href: "/pixels",     icon: Zap },
      { label: "Organize",   href: "/organize",   icon: FolderOpen },
    ],
  },
  {
    title: "Monetise",
    items: [
      { label: "Conversions", href: "/conversions", icon: TrendingUp },
      { label: "Revenue",     href: "/revenue",     icon: DollarSign },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "AI Insights",  href: "/ai",           icon: Sparkles },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Team",         href: "/team",         icon: Users },
      { label: "Billing",      href: "/billing",      icon: CreditCard },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Support", href: "/support", icon: LifeBuoy },
    ],
  },
];

export function ProtectedSidebar() {
  const location = usePathname();
  const { user, logout, isLoggingOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [impersonating, setImpersonating] = useState<{ name: string } | null>(null);
  const [announcement, setAnnouncement] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/impersonation-status", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.impersonating) setImpersonating({ name: data.impersonating.userName || "User" });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/announcement")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.enabled && data?.text) setAnnouncement({ message: data.text, type: data.type || "info" });
      })
      .catch(() => {});
  }, []);

  async function stopImpersonation() {
    try {
      await fetch("/api/admin/stop-impersonate", { method: "POST", credentials: "include" });
      window.location.href = "/admin";
    } catch {}
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const isActive = (href: string) =>
    location === href ||
    (href === "/analytics" && location.startsWith("/analytics/")) ||
    (href === "/links" && location.startsWith("/links/"));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [profileOpen]);

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* ─── Workspace header ─── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setMobileOpen(false)}>
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105" style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}>
              <SniprLogo size={14} color="white" />
            </div>
            <span className="font-[family-name:var(--font-space-grotesk)] font-bold text-[15px] tracking-[-0.02em] text-[#FAFAFA]">
              Snipr
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#27272A] transition-all"
              title="Search (⌘K)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#27272A] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Impersonation banner ─── */}
      {impersonating && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-[#422006] border border-[#854D0E]/40">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#FDE68A]">Impersonating</p>
              <p className="text-[10px] truncate text-[#FCD34D]/70">{impersonating.name}</p>
            </div>
          </div>
          <button onClick={stopImpersonation}
            className="mt-1.5 w-full px-2 py-1 text-[10px] font-semibold text-[#FDE68A] rounded-md bg-[#854D0E]/30 hover:bg-[#854D0E]/50 transition-colors">
            Return to Admin
          </button>
        </div>
      )}

      {/* ─── Announcement ─── */}
      {announcement && (
        <div className={`mx-3 mb-2 px-3 py-2 rounded-lg flex items-start gap-2 text-[11px] leading-relaxed ${
          announcement.type === "warning" ? "bg-[#422006]/60 text-[#FDE68A] border border-[#854D0E]/30"
          : announcement.type === "success" ? "bg-[#052E16]/60 text-[#86EFAC] border border-[#166534]/30"
          : announcement.type === "error" ? "bg-[#450A0A]/60 text-[#FCA5A5] border border-[#991B1B]/30"
          : "bg-[#172554]/60 text-[#93C5FD] border border-[#1E3A5F]/30"
        }`}>
          <Megaphone className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2 font-medium">{announcement.message}</span>
        </div>
      )}

      {/* ─── Separator ─── */}
      <div className="mx-3 h-px bg-[#27272A]" />

      {/* ─── Navigation ─── */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 pt-3 pb-3">
        <div className="space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <p className="px-2 mb-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-[#52525B]">
                  {group.title}
                </p>
              )}
              <div className="space-y-[2px]">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                      <div
                        className={`relative flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer group/item ${
                          active
                            ? "text-[#FAFAFA] bg-[#27272A]"
                            : "text-[#A1A1AA] hover:text-[#E4E4E7] hover:bg-[#1C1C1E]"
                        }`}
                      >
                        {/* Active left edge glow */}
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                            style={{ background: "linear-gradient(180deg, #8B5CF6, #06B6D4)" }}
                          />
                        )}

                        <item.icon
                          className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                            active ? "text-[#A78BFA]" : "text-[#52525B] group-hover/item:text-[#71717A]"
                          }`}
                          strokeWidth={active ? 2 : 1.7}
                        />
                        <span className="truncate">{item.label}</span>

                        {/* Active dot */}
                        {active && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }} />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ─── Bottom section ─── */}
      <div className="mt-auto">
        {/* Settings shortcut */}
        <div className="px-3 pb-1">
          <Link href="/settings" onClick={() => { setMobileOpen(false); setProfileOpen(false); }}>
            <div
              className={`flex items-center gap-2.5 px-2 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer group/item ${
                isActive("/settings")
                  ? "text-[#FAFAFA] bg-[#27272A]"
                  : "text-[#A1A1AA] hover:text-[#E4E4E7] hover:bg-[#1C1C1E]"
              }`}
            >
              <Settings
                className={`w-4 h-4 shrink-0 ${isActive("/settings") ? "text-[#A78BFA]" : "text-[#52525B] group-hover/item:text-[#71717A]"}`}
                strokeWidth={isActive("/settings") ? 2 : 1.7}
              />
              <span className="truncate">Settings</span>
            </div>
          </Link>
        </div>

        {/* Separator */}
        <div className="mx-3 h-px bg-[#27272A]" />

        {/* ─── Profile ─── */}
        <div className="relative px-3 py-3" ref={profileRef}>
          {profileOpen && (
            <div
              className="absolute bottom-full left-3 right-3 mb-1.5 rounded-xl overflow-hidden z-10"
              style={{
                background: "#18181B",
                border: "1px solid #27272A",
                boxShadow: "0 -4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
              }}
            >
              <div className="p-3 border-b border-[#27272A]">
                <p className="text-[12px] font-semibold text-[#FAFAFA] truncate">{user?.name}</p>
                <p className="text-[11px] text-[#71717A] truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { logout(); setProfileOpen(false); setMobileOpen(false); }}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-[#A1A1AA] hover:text-[#FCA5A5] hover:bg-[#27272A] transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all duration-150 ${
              profileOpen ? "bg-[#27272A]" : "hover:bg-[#1C1C1E]"
            }`}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}
            >
              {initials}
            </div>
            <div className="flex flex-col overflow-hidden min-w-0 flex-1 text-left">
              <span className="text-[12px] font-semibold truncate text-[#E4E4E7] leading-tight">
                {user?.name}
              </span>
              <span className="text-[10px] truncate text-[#52525B] leading-tight">
                {user?.email}
              </span>
            </div>
            <ChevronDown
              className={`w-3 h-3 text-[#52525B] transition-transform duration-200 shrink-0 ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-200"
        aria-label="Open menu"
        style={{
          background: "#09090B",
          border: "1px solid #27272A",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        <Menu className="w-4 h-4 text-[#A1A1AA]" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          style={{ animation: "fadeIn 150ms ease-out" }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed lg:sticky top-0 left-0 z-50 w-[240px] h-screen shrink-0 transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        style={{
          background: "#09090B",
          borderRight: "1px solid #1C1C1E",
        }}
      >
        {sidebarContent}
      </aside>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
