// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("referral discoverability entry points", () => {
  it("keeps the canonical referral landing public", () => {
    expect(existsSync(resolve(process.cwd(), "app/refer/page.tsx"))).toBe(true);
    expect(source("proxy.ts")).not.toContain('"/refer"');
  });

  it("exposes the canonical referral landing from public and buyer Marketplace navigation", () => {
    const header = source("components/marketplace/marketplace-header.tsx");
    expect(header).toContain('href={"/refer" as Route}');
    expect(header).toContain("Refer &amp; Earn");
    expect(header).toContain("useAuth");
  });

  it("routes the existing Seller navigation item to the same canonical landing", () => {
    const sellerShell = source("components/marketplace/seller-shell.tsx");
    expect(sellerShell).toContain('{ label: "Refer & earn", icon: Gift, href: "/refer" }');
  });

  it("adds a public property-detail referral action without introducing a property referral submission contract", () => {
    const detail = source("components/marketplace/property-detail-screen.tsx");
    expect(detail).toContain('className="property-detail-refer-action"');
    expect(detail).toContain('href={"/refer" as Route}');
    expect(detail).not.toContain("generatePropertyReferralLink");
  });
});
