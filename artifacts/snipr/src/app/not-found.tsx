import Link from "next/link";
import { Link2 } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#080708] flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 bg-[#728DA7] rounded-lg flex items-center justify-center">
          <Link2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-bold text-[18px] text-[#EFEFF0]">Snipr</span>
      </div>
      <h1 className="text-[80px] font-display font-bold text-[#EFEFF0] leading-none mb-4">404</h1>
      <p className="text-[17px] text-[#888] mb-8 text-center">
        This page doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-[#728DA7] hover:bg-[#5a7a94] text-white text-[14px] font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        Back to home
      </Link>
    </main>
  );
}
