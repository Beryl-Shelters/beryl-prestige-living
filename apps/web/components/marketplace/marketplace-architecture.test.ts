// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Marketplace W1 architecture boundaries", () => {
  const page = source("app/marketplace/page.tsx");
  const screen = source("components/marketplace/marketplace-screen.tsx");
  const propertyOptions = source("lib/marketplace-property-options.ts");
  const bridge = source("app/api/marketplace/route.ts");
  const proxy = source("proxy.ts");

  it("keeps the guest-capable Marketplace screen behind current-release auth-only metadata and routing", () => {
    expect(page).toContain("MarketplaceScreen");
    expect(page).toContain("index: false");
    expect(proxy).toContain('"/marketplace/:path*"');
  });

  it("uses the public same-origin BFF and server-only API configuration", () => {
    expect(bridge).toContain('backendApiUrl("marketplace/properties")');
    expect(screen).toContain("marketplaceApi.search");
    expect(bridge).toMatch(/authorization|cookies\(/i);
    expect(screen).not.toMatch(/dev-api\.berylshelter\.com|API_BASE_URL/);
  });

  it("does not consume Seller-private fields or implement W2 actions", () => {
    expect(screen).not.toMatch(/fullAddress|sellerContact|documentUrl|cloudinaryPublicId/i);
    expect(screen).not.toMatch(/fullAddress|sellerContact|documentUrl|cloudinaryPublicId/i);
  });

  it("keeps search, filtering, sorting and pagination server authoritative", () => {
    expect(screen).toContain('queryKey: ["marketplace-properties", params]');
    expect(screen).not.toContain("data.properties.filter");
    for (const key of ["q", "location", "minPrice", "maxPrice", "propertyType", "category", "condition", "furnishing", "bedrooms", "sort", "page", "limit"]) expect(bridge).toContain(`"${key}"`);
  });

  it("uses the now-supported PDF filter controls", () => {
    expect(screen).toContain('type="checkbox"');
    expect(screen).toContain("marketplace-bedroom-group");
    expect(screen).toContain('next.join(",")');
    expect(propertyOptions).toContain('["APARTMENT", "Flat / apartment"]');
    expect(screen).toMatch(/conditionOptions|furnishingOptions/);
  });

  it("keeps the PDF filter hierarchy and list verified state", () => {
    expect(screen.indexOf('legend>Property Type')).toBeLessThan(screen.indexOf('legend>Bedrooms'));
    expect(screen.indexOf('legend>Bedrooms')).toBeLessThan(screen.indexOf('legend>Condition'));
    expect(screen.indexOf('legend>Condition')).toBeLessThan(screen.indexOf('legend>Furnishing'));
    const styles = source("app/globals.css");
    expect(styles).toContain('.marketplace-list .marketplace-verified-badge{display:inline-flex;left:62px}');
  });

  it("keeps the interest confirmation above the sticky Marketplace header", () => {
    const styles = source("app/globals.css");
    expect(styles).toContain(".property-detail-action-panel:has(.property-detail-modal-backdrop)");
    expect(styles).toMatch(/property-detail-action-panel:has\(\.property-detail-modal-backdrop\)[\s\S]*?z-index:\s*120/);
  });
});
