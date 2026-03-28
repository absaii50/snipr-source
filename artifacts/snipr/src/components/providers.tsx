"use client";

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect, type ReactNode } from "react";

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isAbortError(error)) return;
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isAbortError(error)) return;
      },
    }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (count, error) => (isAbortError(error) ? false : count < 1),
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        {mounted && <Toaster />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
