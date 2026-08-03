// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("web authentication architecture", () => {
  const bridge = source("app/api/customer/[...path]/route.ts");
  const cookies = source("lib/server/session-cookies.ts");
  const client = source("lib/api/client.ts");
  const proxy = source("proxy.ts");
  const css = source("app/globals.css");

  it("connects every approved customer endpoint", () => {
    for (const endpoint of ["auth/register", "auth/verify-email", "auth/resend-verification-otp", "auth/login", "auth/forgot-password", "auth/verify-password-reset-otp", "auth/reset-password", "auth/refresh", "auth/logout", "auth/change-password", "onboarding/status", "onboarding/buyer", "onboarding/seller", "personas", "personas/activate", "personas/active"]) {
      expect(bridge).toContain(endpoint);
      expect(client).toContain(endpoint);
    }
  });

  it("keeps customer tokens in HttpOnly cookies", () => {
    expect(cookies).toContain("httpOnly: true");
    expect(cookies).toContain("sameSite: \"lax\"");
    expect(client).not.toMatch(/localStorage/i);
  });

  it("bridges refresh-token rotation and retries protected requests", () => {
    expect(bridge).toContain("refreshSession(refreshToken)");
    expect(bridge).toContain("backend.status === 401");
    expect(bridge).toContain("setSessionCookies(retried");
  });

  it("clears the session on logout and successful reset", () => {
    expect(bridge).toContain('path === "auth/logout"');
    expect(bridge).toContain("clearSessionCookies(response)");
    expect(bridge).toContain("SESSION_COOKIES.resetProof");
  });

  it("redirects unauthenticated protected routes", () => {
    expect(proxy).toContain('new URL("/login"');
    expect(proxy).toContain('["/buyer", "/seller", "/onboarding/:path*"]');
  });

  it("marks all scoped routes noindex and nofollow", () => {
    for (const layout of ["app/(auth)/layout.tsx", "app/(onboarding)/layout.tsx", "app/(protected)/layout.tsx"]) {
      expect(source(layout)).toContain("index: false");
      expect(source(layout)).toContain("follow: false");
    }
  });

  it("contains mobile, tablet and desktop responsive rules", () => {
    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toContain("@media (min-width: 1024px)");
    expect(css).toContain("overflow-x: hidden");
  });
});
