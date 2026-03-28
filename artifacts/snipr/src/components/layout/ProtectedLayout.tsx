"use client";
import { ReactNode, useEffect, useState } from "react";
import { ProtectedSidebar } from "./ProtectedSidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, error } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && (error || !user)) {
      router.push("/login");
    }
  }, [mounted, isLoading, error, user, router]);

  // Before mounting: return null (matches server-rendered null exactly — no hydration mismatch)
  if (!mounted) {
    return null;
  }

  // After mounting: show spinner while auth is loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F6F9]">
        <Loader2 className="w-6 h-6 animate-spin text-[#728DA7]" />
      </div>
    );
  }

  // Not authenticated: redirect is handled by useEffect above
  if (error || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#F6F6F9] text-[#0A0A0A]">
      <ProtectedSidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-[#F6F6F9]">
        {children}
      </main>
    </div>
  );
}
