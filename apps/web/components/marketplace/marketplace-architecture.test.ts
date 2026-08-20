// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Marketplace W1 architecture boundaries", () => {
  const page = source("app/marketplace/page.tsx");
  const screen = source("components/marketplace/marketplace-screen.tsx");
  const bridge = source("app/api/marketplace/route.ts");
  const proxy = source("proxy.ts");

  it("creates the public Marketplace route with indexable metadata", () => {
    expect(page).toContain("MarketplaceScreen");
    expect(page).toContain("index: true");
    expect(proxy).not.toContain('"/marketplace"');
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
    expect(screen).toContain('["APARTMENT", "Flat / apartment"]');
    expect(screen).toMatch(/conditionOptions|furnishingOptions/);
  });
});
