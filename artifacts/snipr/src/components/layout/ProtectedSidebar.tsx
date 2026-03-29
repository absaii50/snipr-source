"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  Link2,
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const isActive = (href: string) =>
    location === href ||
    (href === "/analytics" && location.startsWith("/analytics/")) ||
    (href === "/links" && location.startsWith("/links/"));

  return (
    <aside className="w-[232px] flex flex-col h-screen sticky top-0 shrink-0 z-10 bg-white border-r border-[#E4E8F0]">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-[#E4E8F0]">
        <Link href="/" className="flex items-center gap-2.5 w-fit group">
          <div className="w-8 h-8 rounded-xl bg-[#4F46E5] flex items-center justify-center transition-all group-hover:bg-[#4338CA] shrink-0 shadow-sm shadow-indigo-200">
            <Link2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-extrabold text-[19px] tracking-tight text-[#111827]">
            Snipr
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 pt-3 overflow-y-auto custom-scrollbar pb-4 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 mb-1 text-[10px] font-bold tracking-[0.15em] uppercase text-[#AAB3C2]">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div
                      className={[
                        "flex items-center gap-2.5 px-2.5 py-[7px] rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer group",
                        active
                          ? "bg-indigo-50 text-[#4338CA] font-semibold"
                          : "text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F9]",
                      ].join(" ")}
                    >
                      <item.icon
                        className={[
                          "w-[15px] h-[15px] flex-shrink-0 transition-colors",
                          active ? "text-[#4F46E5]" : "text-[#B4BAC8] group-hover:text-[#6B7280]",
                        ].join(" ")}
                      />
                      <span className="flex-1 leading-none">{item.label}</span>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-2.5 py-3 border-t border-[#E4E8F0] space-y-1">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#F3F4F9] transition-colors cursor-default">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="bg-[#4F46E5] text-white text-[10px] font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden min-w-0 flex-1">
            <span className="text-[12.5px] font-semibold truncate text-[#111827] leading-tight">
              {user?.name}
            </span>
            <span className="text-[10.5px] truncate text-[#9CA3AF] leading-tight">
              {user?.email}
            </span>
          </div>
        </div>
        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-xl text-[12.5px] font-medium transition-all duration-150 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-3.5 h-3.5" />
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </aside>
  );
}
