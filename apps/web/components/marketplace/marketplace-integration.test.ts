// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Marketplace session and visual integration", () => {
  const search = source("components/marketplace/marketplace-screen.tsx");
  const detail = source("components/marketplace/property-detail-screen.tsx");
  const header = source("components/marketplace/marketplace-header.tsx");
  const buyer = source("app/(protected)/buyer/page.tsx");
  const seller = source("app/(protected)/seller/page.tsx");

  it("keeps Marketplace public while consuming the canonical customer session in its header", () => {
    expect(header).toContain("useAuth");
    expect(search).toContain("MarketplaceHeader");
    expect(source("proxy.ts")).not.toContain('"/marketplace"');
  });

  it("removes the invented hero and retains desktop result controls", () => {
    expect(search).not.toContain("Verified property marketplace");
    expect(search).not.toContain("Find a home you can trust");
    expect(search).toContain("Houses for Sale in Nigeria");
    expect(search).toContain("marketplace-view-toggle");
    expect(search).toContain("marketplace-filter-sidebar");
  });

  it("keeps core cards and detail architecture intact", () => {
    for (const field of ["coverImage", "verified", "photoCount", "askingPrice", "publicLocation"]) expect(search).toContain(field);
    expect(detail).toContain("DetailGallery");
    expect(detail).toContain("property-detail-action-panel");
  });

  it("redirects completed persona entry routes to implemented Marketplace destinations", () => {
    expect(buyer).toContain('redirect("/marketplace")');
    expect(seller).toContain('redirect("/seller/listings")');
  });
});
