export const sellerPropertyTypes = [
  ["APARTMENT", "Flat / apartment"],
  ["MINI_FLAT", "Mini Flat"],
  ["SELF_CONTAIN_STUDIO", "Self-Contain / Studio"],
  ["DUPLEX", "Duplex"],
  ["DETACHED_HOUSE", "Detached House"],
  ["SEMI_DETACHED_HOUSE", "Semi-Detached House"],
  ["TERRACE", "Terrace House"],
  ["BUNGALOW", "Bungalow"]
] as const;

export type SellerPropertyType = typeof sellerPropertyTypes[number][0];
export const sellerPropertyTypeValues = sellerPropertyTypes.map(([value]) => value) as SellerPropertyType[];
