// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const request = (pathname: string, cookie?: string) => new NextRequest(`https://app.berylshelter.com${pathname}`, {
  headers: cookie ? { cookie } : undefined,
});

describe("current-release customer Web proxy", () => {
  it.each([
    "/marketplace",
    "/marketplace/11111111-1111-4111-8111-111111111111?from=saved",
    "/buyer",
    "/saved",
    "/seller/listings",
    "/seller/listings/new",
    "/seller/listings/11111111-1111-4111-8111-111111111111",
    "/seller/listings/11111111-1111-4111-8111-111111111111/edit",
  ])("redirects a logged-out request for %s to Login without rendering it", (pathname) => {
    const response = proxy(request(pathname));
    const expectedReturn = encodeURIComponent(pathname);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://app.berylshelter.com/login?returnTo=${expectedReturn}`);
  });

  it.each(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/privacy", "/terms", "/refer", "/refer/direct", "/r/CODE", "/referrals", "/referrals/track"])("keeps %s public", (pathname) => {
    const response = proxy(request(pathname));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows an access session and a refreshable session to reach bootstrap", () => {
    expect(proxy(request("/marketplace", "beryl_customer_access=access")).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/marketplace", "beryl_customer_refresh=refresh; beryl_customer_state=state")).headers.get("x-middleware-next")).toBe("1");
  });

  it("does not accept referral tracking or Admin cookies as Customer authentication", () => {
    for (const cookie of ["beryl_referral_tracking=tracking", "beryl_admin_access=admin"]) {
      expect(proxy(request("/marketplace", cookie)).headers.get("location")).toContain("/login?returnTo=%2Fmarketplace");
    }
  });
});
