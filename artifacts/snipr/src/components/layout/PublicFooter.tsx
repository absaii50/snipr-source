"use client";
import Link from "next/link";
import { Link2 } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-[#080708] border-t border-[#111118]">
      <div className="container max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-[#728DA7] rounded-lg flex items-center justify-center group-hover:bg-[#5a7a94] transition-colors">
              <Link2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-[16px] text-[#EFEFF0] tracking-tight">Snipr</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {[
              { label: "Home",      href: "/" },
              { label: "Pricing",   href: "/pricing" },
              { label: "Privacy",   href: "/privacy" },
              { label: "Terms",     href: "/terms" },
              { label: "Cookies",   href: "/cookies" },
              { label: "Security",  href: "/security" },
              { label: "Contact",   href: "/contact" },
            ].map((l) => (
              <Link key={l.label} href={l.href} className="text-[13px] text-[#666] hover:text-[#CCCCCC] transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 pt-8 border-t border-[#111118] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[12px] text-[#5A5C60]" suppressHydrationWarning>
            © {new Date().getFullYear()} Snipr, Inc. All rights reserved.
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B9A6A] animate-pulse" />
            <span className="text-[12px] text-[#5A5C60]">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
