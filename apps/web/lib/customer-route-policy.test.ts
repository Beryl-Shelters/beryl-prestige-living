import { describe, expect, it } from "vitest";
import { isCustomerAuthRoute, loginDestination, requiredOnboardingRoute } from "./customer-route-policy";

describe("current-release customer route policy", () => {
  it.each([
    "/marketplace",
    "/marketplace/11111111-1111-4111-8111-111111111111",
    "/buyer",
    "/saved",
    "/seller",
    "/seller/listings",
    "/seller/listings/new",
    "/seller/listings/11111111-1111-4111-8111-111111111111",
    "/seller/listings/11111111-1111-4111-8111-111111111111/edit",
    "/onboarding/buyer",
    "/onboarding/seller",
  ])("classifies %s as customer-auth-only", (pathname) => {
    expect(isCustomerAuthRoute(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/verify-email",
    "/verify-reset-otp",
    "/reset-password",
    "/privacy",
    "/terms",
    "/refer",
    "/refer/direct",
    "/r/ABC123",
    "/referrals",
    "/referrals/track",
    "/api/locations/search",
  ])("keeps %s outside the customer auth gate", (pathname) => {
    expect(isCustomerAuthRoute(pathname)).toBe(false);
  });

  it("requires active-persona onboarding before a protected return destination", () => {
    expect(requiredOnboardingRoute("COMPLETE_BUYER_ONBOARDING")).toBe("/onboarding/buyer");
    expect(requiredOnboardingRoute("COMPLETE_SELLER_ONBOARDING")).toBe("/onboarding/seller");
    expect(loginDestination("COMPLETE_BUYER_ONBOARDING", "/marketplace")).toBe("/onboarding/buyer");
    expect(loginDestination("OPEN_BUYER_DASHBOARD", "/marketplace?q=lekki")).toBe("/marketplace?q=lekki");
    expect(loginDestination("OPEN_SELLER_DASHBOARD", null)).toBe("/seller/listings");
  });
});
