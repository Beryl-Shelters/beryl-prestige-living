// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  formatNaira,
  marketplaceApiParams,
  marketplaceQueryString,
  parseMarketplaceQuery
} from "./marketplace";

describe("Marketplace query and display helpers", () => {
  it("restores supported URL state and rejects invalid values", () => {
    expect(parseMarketplaceQuery({ q: "  lekki ", minPrice: "1000", maxPrice: "bad", bedrooms: "3", sort: "MOST_RECENT", category: "RESIDENTIAL", page: "2" })).toMatchObject({
      q: "lekki", minPrice: "1000", maxPrice: "", bedrooms: "3", sort: "MOST_RECENT", category: "RESIDENTIAL", page: 2
    });
  });

  it("maps meaningful state to the backend contract without blank filters", () => {
    const query = parseMarketplaceQuery({ location: "Lagos", propertyType: "duplex", minPrice: "50000000" });
    expect(marketplaceApiParams(query)).toEqual({ location: "Lagos", minPrice: 50000000, propertyType: "DUPLEX", sort: "DEFAULT", page: 1, limit: 12 });
  });

  it("creates a shareable URL without default noise", () => {
    const state = parseMarketplaceQuery({ q: "Lekki", sort: "PRICE_LOW_TO_HIGH", page: "3" });
    expect(marketplaceQueryString(state)).toBe("/marketplace?q=Lekki&sort=PRICE_LOW_TO_HIGH&page=3");
    expect(marketplaceQueryString(parseMarketplaceQuery({}))).toBe("/marketplace");
  });

  it("formats prices consistently in Nigerian naira", () => {
    expect(formatNaira(125000000)).toMatch(/₦125,000,000/);
  });
});
