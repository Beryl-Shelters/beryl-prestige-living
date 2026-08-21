import type { MarketplaceFilters, MarketplacePropertyCard, MarketplaceSearchResult } from "@/types/marketplace";

export const MARKETPLACE_PAGE_SIZE = 10;
export const marketplaceDefaults: MarketplaceFilters = {
  q: "",
  minPrice: "",
  maxPrice: "",
  propertyTypes: [],
  bedrooms: "",
  conditions: [],
  furnishings: [],
  sort: "DEFAULT"
};

export const propertyTypeOptions = [
  ["APARTMENT", "Flat / apartment"], ["MINI_FLAT", "Mini Flat"], ["SELF_CONTAIN_STUDIO", "Self-Contain / Studio"],
  ["DUPLEX", "Duplex"], ["DETACHED_HOUSE", "Detached House"], ["SEMI_DETACHED_HOUSE", "Semi-Detached House"],
  ["TERRACE", "Terrace House"], ["BUNGALOW", "Bungalow"]
] as const;
export const conditionOptions = [["NEWLY_BUILT", "Newly-Built"], ["OFF_PLAN", "Off-Plan"], ["UNDER_CONSTRUCTION", "Under Construction"], ["FAIRLY_USED", "Fairly-Used"]] as const;
export const furnishingOptions = [["FULLY_FURNISHED", "Fully Furnished"], ["UNFURNISHED", "Unfurnished"], ["SEMI_FURNISHED", "Semi Furnished"]] as const;
export const bedroomOptions = ["1", "2", "3", "4", "5+"] as const;

export const digitsOnly = (value: string) => value.replace(/\D/g, "");
export const formatNumericInput = (value: string) => {
  const digits = digitsOnly(value).replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
};
export const numericValue = (value: string) => {
  const digits = digitsOnly(value);
  return digits ? Number(digits) : undefined;
};
export const validatePriceRange = (filters: Pick<MarketplaceFilters, "minPrice" | "maxPrice">) => {
  const min = numericValue(filters.minPrice);
  const max = numericValue(filters.maxPrice);
  return min !== undefined && max !== undefined && min > max ? "Maximum price must be greater than or equal to minimum price." : "";
};

export const marketplaceQuery = (filters: MarketplaceFilters, page: number) => ({
  ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
  ...(numericValue(filters.minPrice) !== undefined ? { minPrice: String(numericValue(filters.minPrice)) } : {}),
  ...(numericValue(filters.maxPrice) !== undefined ? { maxPrice: String(numericValue(filters.maxPrice)) } : {}),
  ...(filters.propertyTypes.length ? { propertyType: filters.propertyTypes.join(",") } : {}),
  ...(filters.bedrooms ? { bedrooms: filters.bedrooms } : {}),
  ...(filters.conditions.length ? { condition: filters.conditions.join(",") } : {}),
  ...(filters.furnishings.length ? { furnishing: filters.furnishings.join(",") } : {}),
  sort: filters.sort,
  page: String(page),
  limit: String(MARKETPLACE_PAGE_SIZE)
});

export const queryString = (values: Record<string, string>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => params.set(key, value));
  return params.toString();
};
export const formatNaira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;
export const humanizeMarketplaceValue = (value: string) => value.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
export const dedupeProperties = (pages: Array<{ data?: MarketplaceSearchResult }>): MarketplacePropertyCard[] => {
  const byId = new Map<string, MarketplacePropertyCard>();
  pages.forEach(page => page.data?.properties.forEach(property => byId.set(property.id, property)));
  return [...byId.values()];
};
export const isSafeMarketplaceReturnPath = (value: unknown): value is string => typeof value === "string" && /^\/(?:marketplace(?:\/[-A-Za-z0-9]+)?|saved)$/.test(value);
