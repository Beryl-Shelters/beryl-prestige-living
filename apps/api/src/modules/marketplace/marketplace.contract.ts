export const marketplacePropertyTypes = [
  "APARTMENT",
  "MINI_FLAT",
  "SELF_CONTAIN_STUDIO",
  "DUPLEX",
  "DETACHED_HOUSE",
  "SEMI_DETACHED_HOUSE",
  "TERRACE",
  "BUNGALOW"
] as const;

export type MarketplacePropertyType = typeof marketplacePropertyTypes[number];
export type MarketplacePropertyCategory = "RESIDENTIAL" | "COMMERCIAL";

export const marketplaceCategoryToStorage = (category: MarketplacePropertyCategory) =>
  category === "RESIDENTIAL" ? "residential" : "commercial";

export const marketplaceCategoryFromStorage = (category: unknown): MarketplacePropertyCategory | null => {
  if (typeof category !== "string") return null;
  const normalized = category.toLowerCase();
  if (normalized === "commercial") return "COMMERCIAL";
  if (normalized === "residential") return "RESIDENTIAL";
  return null;
};
