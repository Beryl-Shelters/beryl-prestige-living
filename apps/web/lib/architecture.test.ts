// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("web authentication architecture", () => {
  const bridge = source("app/api/customer/[...path]/route.ts");
  const cookies = source("lib/server/session-cookies.ts");
  const client = source("lib/api/client.ts");
  const proxy = source("proxy.ts");
  const css = source("app/globals.css");
  const authProvider = source("context/auth-provider.tsx");

  it("connects every approved customer endpoint", () => {
    for (const [browserPath, upstreamPath] of [["/register", "auth/register"], ["/verify-email", "auth/verify-email"], ["/resend-verification-otp", "auth/resend-verification-otp"], ["/login", "auth/login"], ["/forgot-password", "auth/forgot-password"], ["/verify-password-reset-otp", "auth/verify-password-reset-otp"], ["/reset-password", "auth/reset-password"], ["/refresh", "auth/refresh"], ["/logout", "auth/logout"], ["/change-password", "auth/change-password"], ["/onboarding/status", "onboarding/status"], ["/onboarding/buyer", "onboarding/buyer"], ["/onboarding/seller", "onboarding/seller"], ["/personas", "personas"], ["/personas/activate", "personas/activate"], ["/personas/active", "personas/active"]]) {
      expect(bridge).toContain(upstreamPath);
      expect(client).toContain(browserPath);
    }
  });

  it("keeps customer tokens in HttpOnly cookies", () => {
    expect(cookies).toContain("httpOnly: true");
    expect(cookies).toContain("sameSite: \"lax\"");
    expect(client).not.toMatch(/localStorage/i);
  });

  it("never includes the signup password in persisted flow state", () => {
    const persistFunction = authProvider.slice(authProvider.indexOf("const persist"), authProvider.indexOf("const setPendingSignup"));
    expect(persistFunction).toContain("sessionStorage.setItem");
    expect(persistFunction).not.toMatch(/password/i);
  });

  it("contains no old customer-facing brand name in scoped web sources", () => {
    const files = ["README.md", ...["app", "components"].flatMap((directory) => readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx|md)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name)))];
    expect(files.map(source).join("\n")).not.toMatch(/Beryl Prestige Living/i);
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
    expect(proxy).toContain('"/seller/:path*"');
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

  it("constrains desktop auth artwork to the viewport without blocking form scroll", () => {
    const desktopCss = css.slice(css.indexOf("@media (min-width: 1024px)"));
    const artworkRule = desktopCss.match(/\.auth-artwork\s*\{([^}]*)\}/)?.[1] ?? "";
    const shellRule = desktopCss.match(/\.auth-shell\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(shellRule).toContain("grid-template-columns");
    expect(shellRule).toContain("align-items: start");
    expect(artworkRule).toContain("display: flex");
    expect(artworkRule).toContain("position: sticky");
    expect(artworkRule).toContain("height: 100svh");
    expect(artworkRule).toContain("min-height: 0");
    expect(artworkRule).toContain("align-self: start");
    expect(css).not.toMatch(/\.auth-shell\s*\{[^}]*overflow:\s*hidden/s);
  });
});
