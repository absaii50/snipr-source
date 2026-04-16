"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { SniprLogo } from "@/components/SniprLogo";
import { useAuth } from "@/hooks/use-auth";

export function PublicNavbar() {
  const { user, isLoading } = useAuth();
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <div className="sticky top-0 z-50 w-full">

      {/* ── Announcement banner ── */}
      {bannerVisible && (
        <div className="bg-[#0E1A24] border-b border-[#1C2E3E] px-4 py-2.5 flex items-center justify-center gap-3 relative">
          <div className="flex items-center gap-2.5 text-[12px] text-[#7BA8C4]">
            <Sparkles className="w-3.5 h-3.5 text-[#728DA7] flex-shrink-0" />
            <span className="bg-[#728DA7] text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full tracking-wide">NEW</span>
            <span>AI Link Insights are live — understand which links drive real conversions.</span>
            <a href="/signup" className="text-[#8BBAD4] hover:text-white font-semibold inline-flex items-center gap-1 transition-colors underline-offset-2 hover:underline">
              Try it free <ArrowRight className="w-3 h-3"/>
            </a>
          </div>
          <button
            onClick={() => setBannerVisible(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3A5A6E] hover:text-[#7BA8C4] transition-colors p-1 rounded"
          >
            <X className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}

      {/* ── Main navbar ── */}
      <header className="w-full border-b border-[#111118] bg-[#080708]/96 backdrop-blur-md">
        <div className="container mx-auto px-6 h-[60px] flex items-center justify-between max-w-6xl">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="bg-[#728DA7] text-white p-1.5 rounded-lg group-hover:bg-[#5a7a94] transition-colors flex items-center justify-center">
              <SniprLogo size={15} color="white" />
            </div>
            <span className="font-display font-bold text-[17px] text-[#EFEFF0] tracking-tight">Snipr</span>
            <span className="hidden sm:inline-flex text-[9px] font-bold text-[#728DA7] border border-[#728DA7]/25 px-1.5 py-0.5 rounded-full ml-0.5 tracking-wider">
              BETA
            </span>
          </Link>

          {/* Center nav links */}
          <nav className="hidden lg:flex items-center gap-0.5">
            <a
              href="/#features"
              onClick={(e) => {
                const el = document.getElementById("features");
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="text-[13px] font-medium text-[#666] hover:text-[#CCCCCC] transition-colors px-3.5 py-2 rounded-lg hover:bg-white/4 cursor-pointer"
            >
              Features
            </a>
            <Link
              href="/pricing"
              className="text-[13px] font-medium text-[#666] hover:text-[#CCCCCC] transition-colors px-3.5 py-2 rounded-lg hover:bg-white/4"
            >
              Pricing
            </Link>
          </nav>

          {/* Right CTAs */}
          <div className="flex items-center gap-2">
            {!isLoading && user ? (
              <Link href="/dashboard">
                <button className="inline-flex items-center gap-1.5 bg-[#728DA7] hover:bg-[#5a7a94] text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors">
                  Dashboard <ArrowRight className="w-3.5 h-3.5"/>
                </button>
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-[13px] font-medium text-[#666] hover:text-[#CCCCCC] transition-colors px-3 py-2 rounded-lg hover:bg-white/4">
                  Login
                </Link>
                <Link href="/signup">
                  <button className="inline-flex items-center gap-1.5 bg-[#728DA7] hover:bg-[#5a7a94] text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors">
                    Sign Up
                    <ArrowRight className="w-3.5 h-3.5 opacity-70"/>
                  </button>
                </Link>
              </>
            )}
          </div>

        </div>
      </header>
    </div>
  );
}
