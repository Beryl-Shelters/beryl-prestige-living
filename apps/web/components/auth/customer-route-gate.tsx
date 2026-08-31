"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useAuth } from "@/context/auth-provider";
import { isCustomerAuthRoute, requiredOnboardingRoute } from "@/lib/customer-route-policy";
import { loginHrefFor } from "@/lib/return-to";

function RouteLoading() {
  return (
    <main className="seller-listing-loader" aria-live="polite">
      <p>Checking your account…</p>
    </main>
  );
}

export function CustomerRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, sessionLoading } = useAuth();
  const protectedRoute = isCustomerAuthRoute(pathname);
  const onboardingRoute = session ? requiredOnboardingRoute(session.nextAction) : null;
  const wrongOnboardingRoute = Boolean(onboardingRoute && pathname !== onboardingRoute);

  useEffect(() => {
    if (!protectedRoute || sessionLoading) return;
    if (!session) {
      const returnTo = `${pathname}${window.location.search}`;
      router.replace(loginHrefFor(returnTo) as Route);
      return;
    }
    if (onboardingRoute && pathname !== onboardingRoute) {
      router.replace(onboardingRoute);
    }
  }, [onboardingRoute, pathname, protectedRoute, router, session, sessionLoading]);

  if (!protectedRoute) return children;
  if (sessionLoading || !session || wrongOnboardingRoute) return <RouteLoading />;
  return children;
}
