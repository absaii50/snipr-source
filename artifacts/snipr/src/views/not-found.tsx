"use client";
import Link from "next/link";
import { ArrowLeft, Unlink } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F6F6F9]">
      <div className="text-center px-6 max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-[#EBEBF0] shadow-sm mb-6">
          <Unlink className="w-7 h-7 text-[#728DA7]" />
        </div>
        <h1 className="text-[32px] font-bold text-[#0A0A0A] mb-2 tracking-tight">
          Page Not Found
        </h1>
        <p className="text-[15px] text-[#6B6B7A] mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1A1A2E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
