"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-provider";
import { BuyerShell } from "./buyer-shell";
import { SellerShell } from "./seller-shell";

const isMarketplaceRoute = (pathname: string) =>
  pathname === "/marketplace" || pathname.startsWith("/marketplace/");

export function CustomerPersonaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();

  if (
    isMarketplaceRoute(pathname) &&
    session?.activePersona === "SELLER_DEVELOPER" &&
    session.nextAction === "OPEN_SELLER_DASHBOARD"
  ) {
    return <SellerShell>{children}</SellerShell>;
  }

  return <BuyerShell>{children}</BuyerShell>;
}
