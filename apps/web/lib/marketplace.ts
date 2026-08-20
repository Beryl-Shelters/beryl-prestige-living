import type {
  MarketplacePropertyCategory,
  MarketplaceSearchParams,
  MarketplaceSort
} from "@/lib/contracts";

export const MARKETPLACE_PAGE_SIZE = 12;

export type MarketplaceQueryState = {
  q: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  propertyType: string;
  category: "" | MarketplacePropertyCategory;
  condition: string;
  furnishing: string;
  bedrooms: string;
  sort: MarketplaceSort;
  page: number;
};

export type MarketplacePageSearchParams = Record<string, string | string[] | undefined>;

export const marketplaceDefaults: MarketplaceQueryState = {
  q: "",
  location: "",
  minPrice: "",
  maxPrice: "",
  propertyType: "",
  category: "",
  condition: "",
  furnishing: "",
  bedrooms: "",
  sort: "DEFAULT",
  page: 1
};

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const cleanText = (value: string | string[] | undefined) => first(value)?.trim() ?? "";
const nonNegativeInteger = (value: string | string[] | undefined) => {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed >= 0 ? String(parsed) : "";
};
const nonNegativePrice = (value: string | string[] | undefined) => {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
};
const positivePage = (value: string | string[] | undefined) => {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const marketplaceSorts = new Set<MarketplaceSort>([
  "DEFAULT",
  "PRICE_HIGH_TO_LOW",
  "PRICE_LOW_TO_HIGH",
  "BEDS",
  "MOST_RECENT"
]);

export function parseMarketplaceQuery(params: MarketplacePageSearchParams): MarketplaceQueryState {
  const sort = cleanText(params.sort) as MarketplaceSort;
  const category = cleanText(params.category);
  return {
    q: cleanText(params.q),
    location: cleanText(params.location),
    minPrice: nonNegativePrice(params.minPrice),
    maxPrice: nonNegativePrice(params.maxPrice),
    propertyType: cleanText(params.propertyType).toUpperCase(),
    category: category === "RESIDENTIAL" || category === "COMMERCIAL" ? category : "",
    condition: cleanText(params.condition).toUpperCase(),
    furnishing: cleanText(params.furnishing).toUpperCase(),
    bedrooms: cleanText(params.bedrooms) === "5+" ? "5+" : nonNegativeInteger(params.bedrooms),
    sort: marketplaceSorts.has(sort) ? sort : "DEFAULT",
    page: positivePage(params.page)
  };
}

export function marketplaceApiParams(state: MarketplaceQueryState): MarketplaceSearchParams {
  return {
    ...(state.q ? { q: state.q } : {}),
    ...(state.location ? { location: state.location } : {}),
    ...(state.minPrice ? { minPrice: Number(state.minPrice) } : {}),
    ...(state.maxPrice ? { maxPrice: Number(state.maxPrice) } : {}),
    ...(state.propertyType ? { propertyType: state.propertyType } : {}),
    ...(state.category ? { category: state.category } : {}),
    ...(state.condition ? { condition: state.condition } : {}),
    ...(state.furnishing ? { furnishing: state.furnishing } : {}),
    ...(state.bedrooms ? { bedrooms: state.bedrooms === "5+" ? "5+" : Number(state.bedrooms) } : {}),
    sort: state.sort,
    page: state.page,
    limit: MARKETPLACE_PAGE_SIZE
  };
}

export function marketplaceQueryString(state: MarketplaceQueryState) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.location) params.set("location", state.location);
  if (state.minPrice) params.set("minPrice", state.minPrice);
  if (state.maxPrice) params.set("maxPrice", state.maxPrice);
  if (state.propertyType) params.set("propertyType", state.propertyType);
  if (state.category) params.set("category", state.category);
  if (state.condition) params.set("condition", state.condition);
  if (state.furnishing) params.set("furnishing", state.furnishing);
  if (state.bedrooms) params.set("bedrooms", state.bedrooms);
  if (state.sort !== "DEFAULT") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  return query ? `/marketplace?${query}` : "/marketplace";
}

export const formatNaira = (value: number) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
}).format(value);

export const humanizeMarketplaceValue = (value: string) => value
  .toLowerCase()
  .split("_")
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(" ");
