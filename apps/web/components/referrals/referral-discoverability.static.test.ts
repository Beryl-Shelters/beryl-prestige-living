// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("referral discoverability entry points", () => {
  it("adds exactly one guest referral mini hero to the public homepage", () => {
    const homepage = source("app/page.tsx");
    const miniHero = source("components/referrals/guest-referral-mini-hero.tsx");
    const styles = source("app/globals.css");

    expect(homepage.match(/<GuestReferralMiniHero/g)).toHaveLength(1);
    expect(homepage).toContain('customerAppUrl("/refer/direct")');
    expect(miniHero).toContain('data-referral-entry="public-home"');
    expect(miniHero).toContain("Fill in their details");
    expect(miniHero).not.toContain("useAuth");
    expect(miniHero).not.toMatch(/href=.*\/(?:login|signup|onboarding)/);
    expect(styles).toContain("@media (max-width: 767px)");
    expect(styles).toContain("@media (max-width: 389px)");
  });

  it("keeps the canonical referral landing public", () => {
    expect(existsSync(resolve(process.cwd(), "app/refer/page.tsx"))).toBe(true);
    expect(source("proxy.ts")).not.toContain('"/refer"');
  });

  it("keeps all acquisition routes public while Marketplace remains Customer-auth-only", () => {
    const policy = source("lib/customer-route-policy.ts");
    const gate = source("components/auth/customer-route-gate.tsx");
    const proxy = source("proxy.ts");

    expect(policy).toContain('"/marketplace"');
    for (const route of ["/refer", "/refer/direct", "/r/"]) {
      expect(policy).not.toContain(`"${route}"`);
      expect(proxy).not.toContain(`"${route}"`);
    }
    expect(gate).toContain("isCustomerAuthRoute(pathname)");
  });

  it("exposes the canonical referral landing from public and buyer Marketplace navigation", () => {
    const header = source("components/marketplace/marketplace-header.tsx");
    expect(header).toContain('href={"/refer" as Route}');
    expect(header).toContain("Refer &amp; Earn");
    expect(header).toContain("useAuth");
  });

  it("routes the existing Seller navigation item to the same canonical landing", () => {
    const sellerShell = source("components/marketplace/seller-shell.tsx");
    expect(sellerShell).toContain('label: "Refer & Earn"');
    expect(sellerShell).toContain('href: "/refer"');
    expect(sellerShell).toContain('pathname === "/refer" || pathname === "/referrals"');
  });

  it("adds a public property-detail referral action without introducing a property referral submission contract", () => {
    const detail = source("components/marketplace/property-detail-screen.tsx");
    expect(detail).toContain('className="property-detail-refer-action"');
    expect(detail).toContain('href={"/refer" as Route}');
    expect(detail).not.toContain("generatePropertyReferralLink");
  });
});
