export type PublicProperty = {
  code: string;
  title: string;
  description: string;
  propertyType: string;
  propertySubtype: string;
  priceMinor: number;
  state: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  facilities: string[];
  listedAt: string | null;
  images: string[];
};

export type PublicPropertyDetail = PublicProperty & {
  occupancyType: string;
  ownershipType: string;
  hasLien: boolean;
  minimumDownPaymentMinor: number;
  location: string;
  landArea: number | null;
  yearBuilt: number | null;
};

export type PublicPropertyPage = {
  items: PublicProperty[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ComparedProperty = PublicProperty & {
  propertyStatus: "Available";
  unitSizeSqft: null;
  yearBuilt: number | null;
  minimumDownPaymentMinor: number;
};

export type PropertyFilters = {
  propertyType: string;
  propertySubtype: string;
  state: string;
  city: string;
  maxPrice: string;
  bedrooms: string;
  bathrooms: string;
  facility: string;
  sort: "latest" | "oldest" | "price_asc" | "price_desc";
};

export const emptyPropertyFilters: PropertyFilters = {
  propertyType: "",
  propertySubtype: "",
  state: "",
  city: "",
  maxPrice: "",
  bedrooms: "",
  bathrooms: "",
  facility: "",
  sort: "latest",
};
