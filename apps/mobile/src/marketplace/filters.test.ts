import {
  MARKETPLACE_PAGE_SIZE,
  dedupeProperties,
  digitsOnly,
  formatNaira,
  formatNumericInput,
  humanizeMarketplaceValue,
  isSafeMarketplaceReturnPath,
  marketplaceDefaults,
  marketplaceQuery,
  numericValue,
  queryString,
  validatePriceRange
} from "@/marketplace/filters";
import type { MarketplaceFilters, MarketplacePropertyCard } from "@/types/marketplace";

const filters = (overrides: Partial<MarketplaceFilters> = {}): MarketplaceFilters => ({ ...marketplaceDefaults, ...overrides });
const property = (id: string, title = id): MarketplacePropertyCard => ({
  id,
  referenceId: `REF-${id}`,
  title,
  askingPrice: 20_000_000,
  negotiable: false,
  propertyType: "APARTMENT",
  propertyCategory: "RESIDENTIAL",
  publicLocation: "Lekki, Lagos",
  bedrooms: 3,
  bathrooms: 3,
  toilets: 4,
  parkingSpaces: 2,
  coverImage: null,
  photoCount: 0,
  verified: true,
  publishedAt: null,
  saved: false
});

describe("mobile Marketplace filter and query helpers", () => {
  it("uses the approved mobile page size", () => expect(MARKETPLACE_PAGE_SIZE).toBe(10));
  it("removes non-digits from price input", () => expect(digitsOnly("₦ 12m,345.67")).toBe("1234567"));
  it("formats thousands while typing", () => expect(formatNumericInput("1000")).toBe("1,000"));
  it("formats millions while typing", () => expect(formatNumericInput("25000000")).toBe("25,000,000"));
  it("normalizes leading zeroes", () => expect(formatNumericInput("0001250")).toBe("1,250"));
  it("keeps an empty price empty", () => expect(formatNumericInput("")).toBe(""));
  it("converts a formatted price to a number", () => expect(numericValue("1,250,000")).toBe(1_250_000));
  it("returns undefined for a blank price", () => expect(numericValue("")).toBeUndefined());
  it("accepts an equal minimum and maximum", () => expect(validatePriceRange(filters({ minPrice: "5,000", maxPrice: "5,000" }))).toBe(""));
  it("accepts a larger maximum", () => expect(validatePriceRange(filters({ minPrice: "5,000", maxPrice: "10,000" }))).toBe(""));
  it("rejects a maximum below the minimum", () => expect(validatePriceRange(filters({ minPrice: "10,000", maxPrice: "5,000" }))).toMatch(/Maximum price/));
  it("omits blank search text", () => expect(marketplaceQuery(filters(), 1)).not.toHaveProperty("q"));
  it("trims submitted search text", () => expect(marketplaceQuery(filters({ q: "  Lekki  " }), 1)).toMatchObject({ q: "Lekki" }));
  it("maps minimum price without commas", () => expect(marketplaceQuery(filters({ minPrice: "1,000,000" }), 1)).toMatchObject({ minPrice: "1000000" }));
  it("maps maximum price without commas", () => expect(marketplaceQuery(filters({ maxPrice: "20,000,000" }), 1)).toMatchObject({ maxPrice: "20000000" }));
  it("maps multiple property types to the backend contract", () => expect(marketplaceQuery(filters({ propertyTypes: ["APARTMENT", "DUPLEX"] }), 1)).toMatchObject({ propertyType: "APARTMENT,DUPLEX" }));
  it.each(["1", "2", "3", "4", "5+"] as const)("maps the %s bedroom filter", bedrooms => expect(marketplaceQuery(filters({ bedrooms }), 1)).toMatchObject({ bedrooms }));
  it("maps multiple conditions", () => expect(marketplaceQuery(filters({ conditions: ["NEWLY_BUILT", "OFF_PLAN"] }), 1)).toMatchObject({ condition: "NEWLY_BUILT,OFF_PLAN" }));
  it("maps multiple furnishing values", () => expect(marketplaceQuery(filters({ furnishings: ["FULLY_FURNISHED", "UNFURNISHED"] }), 1)).toMatchObject({ furnishing: "FULLY_FURNISHED,UNFURNISHED" }));
  it.each(["DEFAULT", "PRICE_HIGH_TO_LOW", "PRICE_LOW_TO_HIGH", "BEDS", "MOST_RECENT"] as const)("maps the %s sort option", sort => expect(marketplaceQuery(filters({ sort }), 2)).toMatchObject({ sort }));
  it("maps page and limit", () => expect(marketplaceQuery(filters(), 3)).toMatchObject({ page: "3", limit: "10" }));
  it("encodes query values safely", () => expect(queryString({ q: "Lekki Phase 1", sort: "DEFAULT" })).toContain("q=Lekki+Phase+1"));
  it("formats Naira prices with grouping", () => expect(formatNaira(85000000)).toBe("₦85,000,000"));
  it("humanizes backend enum labels", () => expect(humanizeMarketplaceValue("SEMI_DETACHED_HOUSE")).toBe("Semi Detached House"));
  it("deduplicates paginated properties by id", () => expect(dedupeProperties([{ data: { properties: [property("a")], pagination: { page: 1, limit: 10, total: 2, total_pages: 2 } } }, { data: { properties: [property("a"), property("b")], pagination: { page: 2, limit: 10, total: 2, total_pages: 2 } } }]).map(item => item.id)).toEqual(["a", "b"]));
  it("keeps the newest duplicate returned by pagination", () => expect(dedupeProperties([{ data: { properties: [property("a", "Old")], pagination: { page: 1, limit: 10, total: 1, total_pages: 2 } } }, { data: { properties: [property("a", "New")], pagination: { page: 2, limit: 10, total: 1, total_pages: 2 } } }])[0]?.title).toBe("New"));
  it("accepts the Marketplace return path", () => expect(isSafeMarketplaceReturnPath("/marketplace")).toBe(true));
  it("accepts a property detail return path", () => expect(isSafeMarketplaceReturnPath("/marketplace/a1-b2")).toBe(true));
  it("accepts the saved route return path", () => expect(isSafeMarketplaceReturnPath("/saved")).toBe(true));
  it("rejects an external return URL", () => expect(isSafeMarketplaceReturnPath("https://evil.example/marketplace")).toBe(false));
  it("rejects protocol-relative redirects", () => expect(isSafeMarketplaceReturnPath("//evil.example")).toBe(false));
  it("rejects unrelated in-app paths", () => expect(isSafeMarketplaceReturnPath("/seller-dashboard")).toBe(false));
});
