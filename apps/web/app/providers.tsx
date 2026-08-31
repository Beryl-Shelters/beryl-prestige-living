"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/context/auth-provider";
import { CustomerRouteGate } from "@/components/auth/customer-route-gate";
import { BuyerShell } from "@/components/marketplace/buyer-shell";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } }));
  return <QueryClientProvider client={queryClient}><AuthProvider><CustomerRouteGate><BuyerShell>{children}</BuyerShell></CustomerRouteGate></AuthProvider></QueryClientProvider>;
}
