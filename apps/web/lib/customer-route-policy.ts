import type { NextAction } from "./contracts";
import { routeForNextAction } from "./navigation";

const customerAuthPrefixes = [
  "/marketplace",
  "/buyer",
  "/saved",
  "/seller",
  "/onboarding",
] as const;

export function isCustomerAuthRoute(pathname: string) {
  return customerAuthPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function requiredOnboardingRoute(nextAction: NextAction) {
  return nextAction === "COMPLETE_BUYER_ONBOARDING" ||
    nextAction === "COMPLETE_SELLER_ONBOARDING"
    ? routeForNextAction(nextAction)
    : null;
}

export function loginDestination(nextAction: NextAction, returnTo: string | null) {
  return requiredOnboardingRoute(nextAction) ?? returnTo ?? routeForNextAction(nextAction);
}
