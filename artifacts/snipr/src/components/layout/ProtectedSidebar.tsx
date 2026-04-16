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
  ChevronUp,
  ShieldAlert,
  Megaphone,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SniprLogo } from "@/components/SniprLogo";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Live",      href: "/live",      icon: Radio },
    ],
  },
  {
    label: "Links",
    items: [
      { label: "Links",       href: "/links",       icon: LinkIcon },
      { label: "Analytics",   href: "/analytics",   icon: BarChart3 },
      { label: "Domains",     href: "/domains",     icon: Globe },
      { label: "Pixels",      href: "/pixels",      icon: Zap },
      { label: "Organize",    href: "/organize",    icon: FolderOpen },
    ],
  },
  {
    label: "Monetise",
    items: [
      { label: "Conversions", href: "/conversions", icon: TrendingUp },
      { label: "Revenue",     href: "/revenue",     icon: DollarSign },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "AI Insights",  href: "/ai",           icon: Sparkles },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Team",         href: "/team",         icon: Users },
      { label: "Billing",      href: "/billing",      icon: CreditCard },
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
    <>
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" className="flex items-center gap-2.5 w-fit group" onClick={() => setMobileOpen(false)}>
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 group-hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", boxShadow: "0 2px 8px rgba(99,102,241,0.25)" }}
          >
            <SniprLogo size={16} color="white" />
          </div>
          <span className="font-[family-name:var(--font-space-grotesk)] font-extrabold text-[18px] tracking-[-0.02em] text-[#F1F5F9]">
            Snipr
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-[10px] hover:bg-[rgba(255,255,255,0.06)] text-[#64748B] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {impersonating && (
        <div className="mx-3 mt-2.5 px-3 py-2.5 rounded-[12px]" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.15)" }}>
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold">Impersonating</p>
              <p className="text-[10px] truncate text-amber-300">{impersonating.name}</p>
            </div>
          </div>
          <button onClick={stopImpersonation}
            className="mt-1.5 w-full px-2 py-1 text-[10px] font-semibold bg-amber-400/20 text-amber-300 rounded-[8px] hover:bg-amber-400/30 transition-colors">
            Return to Admin
          </button>
        </div>
      )}

      {announcement && (
        <div className={`mx-3 mt-2.5 px-3 py-2.5 rounded-[12px] flex items-center gap-2 text-xs ${
          announcement.type === "warning" ? "text-amber-400" : announcement.type === "success" ? "text-emerald-400" : announcement.type === "error" ? "text-red-400" : "text-blue-400"
        }`} style={{
          background: announcement.type === "warning" ? "rgba(251,191,36,0.08)"
            : announcement.type === "success" ? "rgba(52,211,153,0.08)"
            : announcement.type === "error" ? "rgba(248,113,113,0.08)"
            : "rgba(56,189,248,0.08)",
          border: `1px solid ${announcement.type === "warning" ? "rgba(251,191,36,0.12)" : announcement.type === "success" ? "rgba(52,211,153,0.12)" : announcement.type === "error" ? "rgba(248,113,113,0.12)" : "rgba(56,189,248,0.12)"}`,
        }}>
          <Megaphone className="w-3.5 h-3.5 shrink-0" />
          <span className="line-clamp-2 font-medium">{announcement.message}</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 overflow-y-auto custom-scrollbar pb-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 mb-2 text-[10px] font-bold tracking-[0.14em] uppercase text-[#475569]">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href} className="block" onClick={() => setMobileOpen(false)}>
                    <div
                      className="relative flex items-center gap-2.5 px-2.5 py-[8px] rounded-[12px] text-[13px] font-medium transition-all duration-200 cursor-pointer group"
                      style={active ? {
                        background: "rgba(129,140,248,0.12)",
                        boxShadow: "0 0 0 1px rgba(129,140,248,0.15), inset 0 1px 0 rgba(255,255,255,0.03)",
                        color: "#A5B4FC",
                        fontWeight: 600,
                      } : {}}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-full" style={{ background: "linear-gradient(180deg, #818CF8, #6366F1)" }} />
                      )}
                      <item.icon
                        className="w-[16px] h-[16px] flex-shrink-0 transition-all duration-200"
                        style={{ color: active ? "#818CF8" : undefined }}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      <span className={`flex-1 leading-none ${!active ? "text-[#64748B] group-hover:text-[#CBD5E1]" : ""}`}>{item.label}</span>
                      {active && (
                        <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)" }} />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="relative px-3 py-3" ref={profileRef} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {profileOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-[16px] overflow-hidden animate-scale-in z-10" style={{ background: "rgba(17,24,39,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <p className="text-[12px] font-semibold text-[#E2E8F0] truncate">{user?.name}</p>
              <p className="text-[11px] text-[#64748B] truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              <Link
                href="/settings"
                onClick={() => { setProfileOpen(false); setMobileOpen(false); }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium transition-all duration-200 text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[rgba(255,255,255,0.04)]"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Link>
              <button
                onClick={() => { logout(); setProfileOpen(false); setMobileOpen(false); }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium transition-all duration-200 text-[#64748B] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.06)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isLoggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[12px] transition-all duration-200"
          style={profileOpen ? { background: "rgba(255,255,255,0.06)" } : {}}
          onMouseEnter={e => { if (!profileOpen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={e => { if (!profileOpen) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <Avatar className="w-8 h-8 shrink-0 ring-2 ring-[rgba(255,255,255,0.08)] shadow-sm">
            <AvatarFallback className="text-white text-[10px] font-bold" style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)" }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden min-w-0 flex-1 text-left">
            <span className="text-[12.5px] font-semibold truncate text-[#E2E8F0] leading-tight">
              {user?.name}
            </span>
            <span className="text-[10.5px] truncate text-[#64748B] leading-tight">
              {user?.email}
            </span>
          </div>
          <ChevronUp
            className="w-3.5 h-3.5 text-[#475569] transition-transform duration-200 shrink-0"
            style={{ transform: profileOpen ? "rotate(0deg)" : "rotate(180deg)" }}
          />
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-[14px] border transition-all duration-200"
        aria-label="Open menu"
        style={{ background: "rgba(17,24,39,0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
      >
        <Menu className="w-5 h-5 text-[#94A3B8]" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed lg:sticky top-0 left-0 z-50 w-[260px] lg:w-[240px] flex flex-col h-screen shrink-0 transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        style={{
          background: "rgba(11,15,26,0.85)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
