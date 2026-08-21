export type MarketplaceSort = "DEFAULT" | "PRICE_HIGH_TO_LOW" | "PRICE_LOW_TO_HIGH" | "BEDS" | "MOST_RECENT";
export type MarketplacePropertyCategory = "RESIDENTIAL" | "COMMERCIAL";
export type MarketplaceContactMethod = "WHATSAPP" | "CALL" | "EMAIL";

export type MarketplaceCoverImage = { id: string; url: string };
export type MarketplacePropertyCard = {
  id: string;
  referenceId: string;
  title: string;
  askingPrice: number;
  negotiable: boolean;
  propertyType: string;
  propertyCategory: MarketplacePropertyCategory;
  publicLocation: string;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  parkingSpaces: number | null;
  coverImage: MarketplaceCoverImage | null;
  photoCount: number;
  verified: boolean;
  publishedAt: string | null;
  saved: boolean;
};

export type MarketplacePagination = { page: number; limit: number; total: number; total_pages: number };
export type MarketplaceSearchResult = { properties: MarketplacePropertyCard[]; pagination: MarketplacePagination };
export type MarketplaceGalleryImage = { id: string; url: string; order: number; isCover: boolean };
export type MarketplaceInitialDeposit = { type: "AMOUNT" | "PERCENTAGE" | null; value: number | null };

export type MarketplacePropertyDetail = MarketplacePropertyCard & {
  description: string;
  numberOfFloors: number | null;
  parkingCapacity: number | null;
  condition: string | null;
  furnishing: string | null;
  initialDeposit: MarketplaceInitialDeposit | null;
  amenities: string[];
  images: MarketplaceGalleryImage[];
};

export type MarketplacePropertyDetailResult = { property: MarketplacePropertyDetail };
export type MarketplaceSavedPropertyMutation = { saved_property: { id: string; propertyId: string; savedAt: string } };
export type MarketplaceSavedProperty = { id: string; propertyId: string; savedAt: string; property: MarketplacePropertyCard };
export type MarketplaceSavedPropertyListResult = { saved_properties: MarketplaceSavedProperty[]; pagination: MarketplacePagination };
export type MarketplaceInterestRequest = { preferredContactMethod: MarketplaceContactMethod; message?: string };
export type MarketplaceInterestResult = {
  inquiryId: string;
  propertyId: string;
  referenceId: string;
  title: string;
  askingPrice: number;
  preferredContactMethod: MarketplaceContactMethod;
  submittedAt: string;
  nextAction: "KEEP_BROWSING";
};

export type MarketplaceFilters = {
  q: string;
  minPrice: string;
  maxPrice: string;
  propertyTypes: string[];
  bedrooms: "" | "1" | "2" | "3" | "4" | "5+";
  conditions: string[];
  furnishings: string[];
  sort: MarketplaceSort;
};
